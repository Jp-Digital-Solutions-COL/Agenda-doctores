"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

type EstadoSuscripcion = "prueba" | "activo" | "suspendido";

async function assertSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (profile?.rol !== "superadmin") redirect("/inicio");
}

export async function updateConsultorio(
  id: string,
  data: {
    estado_suscripcion?: EstadoSuscripcion;
    precio_por_doctor?: number;
    notas_admin?: string;
  }
) {
  await assertSuperadmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("consultorios")
    .update(data)
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar el consultorio." };
  return { ok: true };
}

// ── Equipo ────────────────────────────────────────────────────────────

export type SecretariaItem = { id: string; email: string; nombre: string };
export type DoctorItem = {
  id: string;
  nombre: string;
  especialidad: string | null;
  activo: boolean;
};
export type AsignacionItem = { secretaria_id: string; doctor_id: string };

export async function getSecretarias(
  consultorioId: string
): Promise<SecretariaItem[]> {
  await assertSuperadmin();
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, nombre")
    .eq("consultorio_id", consultorioId)
    .eq("rol", "secretaria");

  if (!profiles?.length) return [];

  const profileMap = new Map(profiles.map((p) => [p.id, p.nombre as string]));
  const { data: usersData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  return (usersData?.users ?? [])
    .filter((u) => profileMap.has(u.id))
    .map((u) => ({ id: u.id, email: u.email ?? "", nombre: profileMap.get(u.id) ?? "" }));
}

export async function createSecretaria(
  consultorioId: string,
  email: string,
  password: string,
  nombre: string
): Promise<{ error?: string }> {
  await assertSuperadmin();
  const admin = createAdminClient();

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) {
    if (authError.message.includes("already registered"))
      return { error: "Ya existe un usuario con ese correo." };
    return { error: authError.message };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      { id: authData.user.id, consultorio_id: consultorioId, rol: "secretaria", nombre: nombre.trim() },
      { onConflict: "id", ignoreDuplicates: false }
    );

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: `No se pudo crear el perfil: ${profileError.message}` };
  }

  return {};
}

export async function getDoctoresConsultorio(
  consultorioId: string
): Promise<DoctorItem[]> {
  await assertSuperadmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("doctores")
    .select("id, nombre, especialidad, activo")
    .eq("consultorio_id", consultorioId)
    .order("nombre");

  return (data ?? []) as DoctorItem[];
}

export async function createDoctor(
  consultorioId: string,
  nombre: string,
  especialidad?: string
): Promise<{ error?: string }> {
  await assertSuperadmin();
  const admin = createAdminClient();

  const { error } = await admin.from("doctores").insert({
    consultorio_id: consultorioId,
    nombre: nombre.trim(),
    especialidad: especialidad?.trim() || null,
    activo: true,
  });

  if (error) return { error: "No se pudo crear el doctor." };
  return {};
}

export async function getAsignaciones(
  consultorioId: string
): Promise<AsignacionItem[]> {
  await assertSuperadmin();
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("consultorio_id", consultorioId)
    .eq("rol", "secretaria");

  if (!profiles?.length) return [];

  const ids = profiles.map((p) => p.id);
  const { data } = await admin
    .from("secretaria_doctores")
    .select("secretaria_id, doctor_id")
    .in("secretaria_id", ids);

  return (data ?? []) as AsignacionItem[];
}

export async function toggleAsignacion(
  secretariaId: string,
  doctorId: string,
  asignar: boolean
): Promise<{ error?: string }> {
  await assertSuperadmin();
  const admin = createAdminClient();

  if (asignar) {
    const { error } = await admin
      .from("secretaria_doctores")
      .upsert({ secretaria_id: secretariaId, doctor_id: doctorId });
    if (error) return { error: "No se pudo asignar." };
  } else {
    const { error } = await admin
      .from("secretaria_doctores")
      .delete()
      .eq("secretaria_id", secretariaId)
      .eq("doctor_id", doctorId);
    if (error) return { error: "No se pudo desasignar." };
  }

  return {};
}
