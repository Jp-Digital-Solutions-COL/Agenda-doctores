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
                      style="display:inline-block;padding:10px 18px;background:#25D366;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;line-height:1;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="#ffffff" style="display:inline-block;vertical-align:middle;margin-right:6px;margin-top:-1px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg><span style="vertical-align:middle;">WhatsApp</span>
                    </a>
                  </td>` : ""}
                  ${secretariaEmail ? `<td>
                    <a href="mailto:${secretariaEmail}"
                      style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;line-height:1;">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:6px;margin-top:-1px;"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg><span style="vertical-align:middle;">Correo electrónico</span>
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
