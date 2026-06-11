// Email transaccional vía Resend (https://resend.com) usando su API REST
// con fetch — sin añadir dependencias.
//
// Opcional: si RESEND_API_KEY no está configurado, las funciones hacen
// no-op silencioso (no rompen el flujo de signup).
//
// Env vars:
//   RESEND_API_KEY   — la API key de Resend
//   EMAIL_FROM       — remitente verificado, ej. "AuraFood <hola@tu-dominio.com>"
//   NEXT_PUBLIC_APP_URL — base URL para los links (ej. https://aurafood.app)

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
};

async function sendEmail({ to, subject, html }: SendArgs): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "AuraFood <onboarding@resend.dev>";
  if (!apiKey) {
    // Sin configurar → no-op. El signup sigue funcionando.
    return false;
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendWelcomeEmail(args: {
  to: string;
  ownerName: string;
  restaurantName: string;
  slug: string;
}): Promise<boolean> {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://aurafood-ten.vercel.app";
  const adminUrl = `${base}/r/${args.slug}/admin/menu`;
  const menuUrl = `${base}/r/${args.slug}/menu`;

  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#242424">
    <div style="text-align:center;padding:24px 0">
      <div style="font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#C9A961">— AuraFood —</div>
      <h1 style="font-size:24px;color:#cf5f37;margin:8px 0">¡Bienvenido, ${escapeHtml(args.ownerName)}!</h1>
    </div>
    <p>Tu restaurante <strong>${escapeHtml(args.restaurantName)}</strong> ya está listo en AuraFood. Tienes <strong>14 días gratis</strong> para probarlo todo.</p>
    <div style="margin:24px 0;text-align:center">
      <a href="${adminUrl}" style="background:#cf5f37;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;display:inline-block;font-weight:600">Configurar mi restaurante</a>
    </div>
    <p style="font-size:14px;color:#6f6f6b">Tu menú digital (QR) está en:<br/>
      <a href="${menuUrl}" style="color:#cf5f37">${menuUrl}</a>
    </p>
    <hr style="border:none;border-top:1px solid #e7e5e2;margin:24px 0"/>
    <p style="font-size:12px;color:#9a9a96">¿Dudas? Responde a este correo. — Equipo AuraFood</p>
  </div>`;

  return sendEmail({
    to: args.to,
    subject: `¡${args.restaurantName} está listo en AuraFood! 🎉`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
