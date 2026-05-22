import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

// Formato "lunes 23 de junio de 2025" en es-MX
function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

// Formato "09:00"
function formatHora(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

function emailHtml(
  nombrePaciente: string,
  nombreDoctor: string,
  fecha: string,
  hora: string
): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:4px">Recordatorio de cita médica</h2>
  <p style="color:#555;margin-top:0">Te recordamos que tienes una cita programada para mañana.</p>

  <table style="width:100%;border-collapse:collapse;margin-top:20px">
    <tr>
      <td style="padding:10px 12px;background:#f5f5f5;border-radius:6px 6px 0 0;font-weight:600">
        Paciente
      </td>
      <td style="padding:10px 12px;background:#f5f5f5;border-radius:6px 6px 0 0">
        ${nombrePaciente}
      </td>
    </tr>
    <tr>
      <td style="padding:10px 12px;border-top:1px solid #e5e5e5;font-weight:600">Doctor</td>
      <td style="padding:10px 12px;border-top:1px solid #e5e5e5">${nombreDoctor}</td>
    </tr>
    <tr>
      <td style="padding:10px 12px;border-top:1px solid #e5e5e5;font-weight:600">Fecha</td>
      <td style="padding:10px 12px;border-top:1px solid #e5e5e5;text-transform:capitalize">
        ${fecha}
      </td>
    </tr>
    <tr>
      <td style="padding:10px 12px;border-top:1px solid #e5e5e5;border-radius:0 0 6px 6px;font-weight:600">
        Hora
      </td>
      <td style="padding:10px 12px;border-top:1px solid #e5e5e5;border-radius:0 0 6px 6px">
        ${hora}
      </td>
    </tr>
  </table>

  <p style="margin-top:24px;font-size:13px;color:#888">
    Si necesitas cancelar o reagendar, comunícate con el consultorio a la brevedad.
  </p>
</body>
</html>`;
}

export async function GET(request: Request) {
  // ── Autenticación ─────────────────────────────────────────
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = createAdminClient(); // se salta el RLS

  // ── Ventana de tiempo: mañana en UTC ──────────────────────
  const ahora = new Date();
  const manana = new Date(
    Date.UTC(
      ahora.getUTCFullYear(),
      ahora.getUTCMonth(),
      ahora.getUTCDate() + 1
    )
  );
  const pasadoManana = new Date(manana.getTime() + 24 * 3600 * 1000);

  // ── Citas programadas para mañana ─────────────────────────
  const { data: citas, error: citasError } = await supabase
    .from("citas")
    .select(
      `id, inicio,
       doctores  ( nombre ),
       pacientes ( nombre, email )`
    )
    .eq("estado", "programada")
    .gte("inicio", manana.toISOString())
    .lt("inicio", pasadoManana.toISOString());

  if (citasError) {
    console.error("[recordatorios] Error al consultar citas:", citasError);
    return Response.json({ error: "Error al consultar citas" }, { status: 500 });
  }

  const resultados: { citaId: string; estado: "enviado" | "sin_email" | "error"; detalle?: string }[] = [];

  for (const cita of citas ?? []) {
    const paciente = (cita.pacientes as unknown) as { nombre: string; email: string | null } | null;
    const doctor   = (cita.doctores  as unknown) as { nombre: string } | null;

    if (!paciente?.email) {
      resultados.push({ citaId: cita.id, estado: "sin_email" });
      continue;
    }

    // ── Evitar duplicados ────────────────────────────────────
    const { data: yaEnviado } = await supabase
      .from("recordatorios")
      .select("id")
      .eq("cita_id", cita.id)
      .eq("tipo", "email")
      .maybeSingle();

    if (yaEnviado) {
      resultados.push({ citaId: cita.id, estado: "enviado", detalle: "ya enviado" });
      continue;
    }

    // ── Enviar email ─────────────────────────────────────────
    const fecha = formatFecha(cita.inicio);
    const hora  = formatHora(cita.inicio);

    const { error: resendError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Agenda Médica <recordatorios@resend.dev>",
      to:   paciente.email,
      subject: `Recordatorio: cita mañana a las ${hora}`,
      html: emailHtml(paciente.nombre, doctor?.nombre ?? "tu doctor", fecha, hora),
    });

    const estadoEnvio = resendError ? "error" : "enviado";

    if (resendError) {
      console.error("[recordatorios] Resend error para cita", cita.id, resendError);
    }

    // ── Registrar en recordatorios ───────────────────────────
    const { error: insertError } = await supabase.from("recordatorios").insert({
      cita_id:    cita.id,
      tipo:       "email",
      estado:     estadoEnvio,
      enviado_en: new Date().toISOString(),
    });

    if (insertError) {
      console.error("[recordatorios] Error al insertar registro:", insertError);
    }

    resultados.push({
      citaId: cita.id,
      estado: estadoEnvio,
      ...(resendError ? { detalle: resendError.message } : {}),
    });
  }

  const enviados  = resultados.filter((r) => r.estado === "enviado").length;
  const sinEmail  = resultados.filter((r) => r.estado === "sin_email").length;
  const errores   = resultados.filter((r) => r.estado === "error").length;

  console.log(`[recordatorios] Procesadas ${citas?.length ?? 0} citas — enviados: ${enviados}, sin email: ${sinEmail}, errores: ${errores}`);

  return Response.json({ ok: true, enviados, sinEmail, errores, total: citas?.length ?? 0 });
}
