// Recibe los leads del diagnóstico de la landing.
// Sin dependencias npm: Telegram y Resend se llaman con fetch directo.
//
// Variables de entorno en Vercel:
//   TELEGRAM_BOT_TOKEN  (obligatoria — canal principal)
//   TELEGRAM_CHAT_ID    (obligatoria — canal principal)
//   RESEND_API_KEY      (opcional — solo si el dominio está verificado en Resend)
//   OWNER_EMAIL         (opcional — destino del email, por defecto desarrollo@mblcorporacion.es)

const esc = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const clean = (s, max = 500) => String(s == null ? '' : s).trim().slice(0, max);

async function enviarTelegram(lead) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, motivo: 'sin credenciales de Telegram' };

  const texto =
    `🔔 <b>Nuevo lead — MBL Studio</b>\n\n` +
    `👤 <b>${esc(lead.nombre)}</b>\n` +
    `🏢 ${esc(lead.empresa)}\n` +
    `📞 ${esc(lead.telefono)}\n` +
    (lead.email ? `✉️ ${esc(lead.email)}\n` : '') +
    `💬 Prefiere: ${esc(lead.preferencia || 'no indicado')}\n\n` +
    `<b>Diagnóstico</b>\n` +
    `• Le quita tiempo: ${esc(lead.q1)}\n` +
    `• Equipo: ${esc(lead.q2)}\n` +
    `• Objetivo: ${esc(lead.q3)}\n` +
    `• Sector: ${esc(lead.sector || lead.sector_form || 'no indicado')}\n` +
    (lead.extra ? `\n📝 ${esc(lead.extra)}\n` : '') +
    `\n🌐 Origen: ${esc(lead.origen || 'directo')}`;

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!r.ok) return { ok: false, motivo: `Telegram respondió ${r.status}` };
  return { ok: true };
}

async function enviarEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin RESEND_API_KEY' };

  const destino = process.env.OWNER_EMAIL || 'desarrollo@mblcorporacion.es';
  const filas = [
    ['Nombre', lead.nombre],
    ['Empresa', lead.empresa],
    ['Teléfono', lead.telefono],
    ['Email', lead.email || '—'],
    ['Prefiere contacto por', lead.preferencia || '—'],
    ['Le quita tiempo', lead.q1],
    ['Tamaño del equipo', lead.q2],
    ['Objetivo', lead.q3],
    ['Sector', lead.sector || lead.sector_form || '—'],
    ['Comentario', lead.extra || '—'],
    ['Origen', lead.origen || 'directo'],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 14px;border-bottom:1px solid #eee;color:#666">${esc(k)}</td>` +
        `<td style="padding:8px 14px;border-bottom:1px solid #eee"><b>${esc(v)}</b></td></tr>`
    )
    .join('');

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'MBL Studio <noreply@mblcorporacion.es>',
      to: [destino],
      reply_to: lead.email || undefined,
      subject: `[Lead] ${lead.empresa || lead.nombre} — ${lead.telefono}`,
      html:
        `<div style="font-family:system-ui,sans-serif;max-width:600px">` +
        `<h2 style="margin:0 0 4px">Nuevo lead del diagnóstico</h2>` +
        `<p style="color:#666;margin:0 0 20px">Recibido desde landing.mblcorporacion.es</p>` +
        `<table style="width:100%;border-collapse:collapse;font-size:14px">${filas}</table>` +
        `</div>`,
    }),
  });

  if (!r.ok) return { ok: false, motivo: `Resend respondió ${r.status}` };
  return { ok: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  // Honeypot: campo invisible que solo rellenan los bots.
  // Devolvemos 200 para que el bot crea que ha funcionado y no reintente.
  if (clean(body.website)) return res.status(200).json({ ok: true });

  const lead = {
    nombre: clean(body.nombre, 120),
    empresa: clean(body.empresa, 160),
    telefono: clean(body.telefono, 40),
    email: clean(body.email, 160),
    preferencia: clean(body.preferencia, 40),
    sector: clean(body.sector, 60),
    sector_form: clean(body.sector_form, 60),
    q1: clean(body.q1, 200),
    q2: clean(body.q2, 200),
    q3: clean(body.q3, 200),
    extra: clean(body.extra, 1500),
    origen: clean(body.origen, 200),
  };

  if (!lead.nombre || !lead.empresa || !lead.telefono) {
    return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
  }

  const [telegram, email] = await Promise.allSettled([enviarTelegram(lead), enviarEmail(lead)]);
  const ok = (r) => r.status === 'fulfilled' && r.value.ok;

  // Con que UNO de los dos canales llegue, el lead está a salvo.
  if (!ok(telegram) && !ok(email)) {
    const motivos = [telegram, email]
      .map((r) => (r.status === 'fulfilled' ? r.value.motivo : r.reason?.message))
      .filter(Boolean)
      .join(' | ');
    console.error('[lead] no se pudo entregar:', motivos, lead);
    return res.status(502).json({ ok: false, error: 'No se pudo entregar el aviso' });
  }

  return res.status(200).json({ ok: true });
};
