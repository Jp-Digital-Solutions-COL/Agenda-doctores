import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "Med-Agenda <onboarding@resend.dev>";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export async function sendConfirmacionCita(params: {
  to: string;
  paciente: string;
  doctor: string;
  especialidad: string | null;
  fotoUrl: string | null;
  fecha: string;
  hora: string;
  motivo: string | null;
  secretariaWA: string | null;
  secretariaEmail: string | null;
}): Promise<{ error?: string }> {
  const { to, paciente, doctor, especialidad, fotoUrl, fecha, hora, motivo, secretariaWA, secretariaEmail } = params;

  const fotoSrc = fotoUrl ?? `${APP_URL}/Med-Agenda_solo_logo.png`;
  const isLogoFallback = !fotoUrl;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recordatorio de cita</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1d4ed8;padding:24px 32px;text-align:center;">
              <img src="${APP_URL}/Med-Agenda_sin_slogan.png" alt="Med-Agenda" height="36"
                style="height:36px;width:auto;display:inline-block;" />
            </td>
          </tr>

          <!-- Doctor foto -->
          <tr>
            <td style="padding:36px 32px 8px;text-align:center;">
              <img src="${fotoSrc}" alt="${doctor}" width="100" height="100"
                style="width:100px;height:100px;border-radius:50%;object-fit:${isLogoFallback ? "contain" : "cover"};border:3px solid #e5e7eb;background:#f8fafc;display:inline-block;" />
              <p style="margin:16px 0 4px;font-size:17px;font-weight:700;color:#111827;">
                Dr. ${doctor}
              </p>
              ${especialidad
                ? `<p style="margin:0;font-size:13px;color:#6b7280;">${especialidad}</p>`
                : ""}
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:24px 32px 32px;">

              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">
                Recordatorio de cita
              </h2>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;text-align:center;">
                Hola <strong style="color:#374151;">${paciente}</strong>, le recordamos los detalles de su próxima cita.
              </p>

              <!-- Detalles -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f8fafc;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                    <span style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Fecha</span><br/>
                    <span style="font-size:15px;font-weight:600;color:#111827;text-transform:capitalize;">${fecha}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;${motivo ? "border-bottom:1px solid #e5e7eb;" : ""}">
                    <span style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Hora</span><br/>
                    <span style="font-size:15px;font-weight:600;color:#111827;">${hora}</span>
                  </td>
                </tr>
                ${motivo
                  ? `<tr>
                  <td style="padding:12px 16px;">
                    <span style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Motivo</span><br/>
                    <span style="font-size:14px;color:#374151;">${motivo}</span>
                  </td>
                </tr>`
                  : ""}
              </table>

              <!-- Contacto -->
              <p style="margin:24px 0 14px;font-size:13px;color:#374151;text-align:center;">
                Si necesita cancelar o reprogramar su cita, contáctenos:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  ${secretariaWA ? `<td style="padding-right:8px;">
                    <a href="https://wa.me/${secretariaWA.replace(/\D/g, '')}"
                      target="_blank"
                      style="display:inline-block;padding:10px 20px;background:#25D366;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
                      WhatsApp
                    </a>
                  </td>` : ""}
                  ${secretariaEmail ? `<td>
                    <a href="mailto:${secretariaEmail}"
                      style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
                      Correo electrónico
                    </a>
                  </td>` : ""}
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;text-align:center;font-style:italic;">
                Este mensaje es un envío automático. Por favor no responda directamente a este correo, ya que no es un canal de comunicación con el especialista.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Enviado por <strong style="color:#6b7280;">Med-Agenda</strong> · Sistema de gestión médica
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Recordatorio de cita – Dr. ${doctor}`,
    html,
  });

  if (error) return { error: error.message };
  return {};
}
