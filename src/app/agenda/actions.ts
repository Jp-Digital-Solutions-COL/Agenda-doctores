"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CitaConRel, DoctorBasic, EstadoCita, PacienteBasic } from "./types";
import { sendConfirmacionCita } from "@/lib/email";

export async function getDoctoresActivos(): Promise<DoctorBasic[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  let query = supabase
    .from("doctores")
    .select("id, nombre, especialidad, activo, bloqueado_pago")
    .eq("activo", true)
    .order("nombre");

  if (profile?.rol === "secretaria") {
    const admin = createAdminClient();
    const { data: asignaciones } = await admin
      .from("secretaria_doctores")
      .select("doctor_id")
      .eq("secretaria_id", user.id);

    const ids = (asignaciones ?? []).map((a) => a.doctor_id);
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  }

  const { data } = await query;
  return (data ?? []) as DoctorBasic[];
}

export async function getPacientesBasic(): Promise<PacienteBasic[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pacientes")
    .select("id, nombre, telefono, email, cedula")
    .neq("nombre", "__bloqueo__")
    .order("nombre");
  return (data ?? []) as unknown as PacienteBasic[];
}

/** Citas en el rango [start, end] con joins. RLS filtra por consultorio. */
export async function getCitas(
  start: string,
  end: string
): Promise<CitaConRel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("citas")
    .select("*, doctores(id, nombre), pacientes(id, nombre, telefono, cedula, email)")
    .gte("inicio", start)
    .lte("inicio", end)
    .order("inicio");
  if (error) { console.error("getCitas error:", error.message); return []; }
  // Map placeholder patient rows to virtual "bloqueada" estado
  const rows = (data ?? []) as CitaConRel[];
  return rows.map((c) =>
    c.pacientes?.nombre === "__bloqueo__" ? { ...c, estado: "bloqueada" as const } : c
  );
}

/**
 * Horas disponibles para un doctor en una fecha.
 * dayStartISO = UTC ISO de la medianoche local del día (new Date(y,m-1,d).toISOString() en el cliente).
 * Excluye citaIdExcluir al reagendar.
 */
export async function getHorasDisponibles(
  doctorId: string,
  fecha: string,       // "YYYY-MM-DD" — para calcular dia_semana
  dayStartISO: string, // UTC ISO de medianoche local del día
  citaIdExcluir?: string
): Promise<{ slots: string[]; duracionCita: number }> {
  const supabase = await createClient();

  const [y, mo, d] = fecha.split("-").map(Number);
  const diaSemana = new Date(y, mo - 1, d).getDay();

  const { data: horarioData } = await supabase
    .from("horarios")
    .select("hora_inicio, hora_fin, duracion_cita")
    .eq("doctor_id", doctorId)
    .eq("dia_semana", diaSemana)
    .single();

  const horario = horarioData ?? { hora_inicio: "07:00", hora_fin: "20:00", duracion_cita: 30 };

  const dayEndISO = new Date(
    new Date(dayStartISO).getTime() + 24 * 3600 * 1000
  ).toISOString();

  let q = supabase
    .from("citas")
    .select("inicio, fin")
    .eq("doctor_id", doctorId)
    .gte("inicio", dayStartISO)
    .lt("inicio", dayEndISO)
    .neq("estado", "cancelada");

  if (citaIdExcluir) q = q.neq("id", citaIdExcluir);

  const { data: ocupadas } = await q;

  const [sh, sm] = horario.hora_inicio.split(":").map(Number);
  const [eh, em] = horario.hora_fin.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const dur = horario.duracion_cita;

  const dayStartMs = new Date(dayStartISO).getTime();
  const slots: string[] = [];

  for (let min = startMin; min + dur <= endMin; min += dur) {
    const slotStartMs = dayStartMs + min * 60000;
    const slotEndMs = dayStartMs + (min + dur) * 60000;

    const conflict = (ocupadas ?? []).some((c) => {
      const cStartMs = new Date(c.inicio).getTime();
      const cEndMs = new Date(c.fin).getTime();
      return slotStartMs < cEndMs && slotEndMs > cStartMs;
    });

    if (!conflict) {
      slots.push(
        `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
      );
    }
  }

  return { slots, duracionCita: dur };
}

export async function createCita(input: {
  doctorId: string;
  pacienteId: string;
  inicioISO: string;
  finISO: string;
  motivo: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("consultorio_id")
    .eq("id", user.id)
    .single();
  if (!profile?.consultorio_id) return { error: "Sin consultorio." };

  const { error } = await supabase.from("citas").insert({
    consultorio_id: profile.consultorio_id,
    doctor_id: input.doctorId,
    paciente_id: input.pacienteId,
    inicio: input.inicioISO,
    fin: input.finISO,
    motivo: input.motivo.trim() || null,
    estado: "programada",
    creado_por: user.id,
  });

  if (error) return { error: "No se pudo crear la cita." };
  revalidatePath("/agenda");
  return {};
}

export async function updateEstado(
  id: string,
  estado: EstadoCita
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("citas")
    .update({ estado })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el estado." };
  revalidatePath("/agenda");
  return {};
}

export async function reagendar(
  id: string,
  inicioISO: string,
  finISO: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("citas")
    .update({ inicio: inicioISO, fin: finISO })
    .eq("id", id);
  if (error) return { error: "No se pudo reagendar la cita." };
  revalidatePath("/agenda");
  return {};
}

export async function deleteCita(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("citas").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar la cita." };
  revalidatePath("/agenda");
  return {};
}

export async function bloquearHoras(input: {
  doctorId: string;
  inicioISO: string;
  finISO: string;
  motivo?: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("consultorio_id")
    .eq("id", user.id)
    .single();
  if (!profile?.consultorio_id) return { error: "Sin consultorio." };

  const admin = createAdminClient();

  // paciente_id is NOT NULL — use a per-consultorio placeholder patient
  let placeholderId: string;
  const { data: existing } = await admin
    .from("pacientes")
    .select("id")
    .eq("consultorio_id", profile.consultorio_id)
    .eq("nombre", "__bloqueo__")
    .maybeSingle();

  if (existing) {
    placeholderId = existing.id;
  } else {
    const { data: created, error: createErr } = await admin
      .from("pacientes")
      .insert({ nombre: "__bloqueo__", consultorio_id: profile.consultorio_id })
      .select("id")
      .single();
    if (createErr || !created) return { error: "No se pudo preparar el bloqueo." };
    placeholderId = created.id;
  }

  const { error } = await admin.from("citas").insert({
    consultorio_id: profile.consultorio_id,
    doctor_id: input.doctorId,
    paciente_id: placeholderId,
    inicio: input.inicioISO,
    fin: input.finISO,
    motivo: input.motivo?.trim() || null,
    estado: "programada",
    creado_por: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/agenda");
  return {};
}

export async function sendConfirmacionEmail(params: {
  doctorId: string;
  to: string;
  paciente: string;
  doctor: string;
  fecha: string;
  hora: string;
  motivo: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: doctorData } = await supabase
    .from("doctores")
    .select("foto_url, especialidad")
    .eq("id", params.doctorId)
    .single();

  return sendConfirmacionCita({
    to: params.to,
    paciente: params.paciente,
    doctor: params.doctor,
    especialidad: doctorData?.especialidad ?? null,
    fotoUrl: doctorData?.foto_url ?? null,
    fecha: params.fecha,
    hora: params.hora,
    motivo: params.motivo,
  });
}

export async function createPaciente(input: {
  nombre: string;
  telefono?: string;
  email?: string;
  cedula?: string;
}): Promise<{ data?: PacienteBasic; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("consultorio_id")
    .eq("id", user.id)
    .single();
  if (!profile?.consultorio_id) return { error: "Sin consultorio asignado." };

  const { data, error } = await supabase
    .from("pacientes")
    .insert({
      nombre: input.nombre.trim(),
      telefono: input.telefono?.trim() || null,
      email: input.email?.trim() || null,
      cedula: input.cedula?.trim() || null,
      consultorio_id: profile.consultorio_id,
    })
    .select("id, nombre, telefono, email, cedula")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/agenda");
  return { data: data as unknown as PacienteBasic };
}
