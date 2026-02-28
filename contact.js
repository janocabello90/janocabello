export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { nombre, email, tipo, mensaje } = req.body;

  if (!nombre || !email) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    // 1. Notificación a Jano via Resend
    const notif = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'web@janocabello.com',
        to: process.env.JANO_EMAIL,
        reply_to: email,
        subject: `📬 Nuevo contacto web — ${tipo || 'Sin tipo'}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;">
            <h2 style="color:#111;margin-bottom:24px;">Nuevo mensaje desde janocabello.com</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#777;width:140px;">Nombre</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:500;">${nombre}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#777;">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;"><a href="mailto:${email}" style="color:#e8920a;">${email}</a></td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#777;">Tipo</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${tipo || '—'}</td></tr>
              <tr><td style="padding:10px 16px 10px 0;color:#777;vertical-align:top;">Mensaje</td><td style="padding:10px 0;white-space:pre-wrap;">${mensaje || '—'}</td></tr>
            </table>
            <div style="margin-top:28px;">
              <a href="mailto:${email}?subject=Re: ${tipo || 'Tu mensaje'}" 
                 style="background:#e8920a;color:#111;padding:12px 24px;text-decoration:none;font-weight:600;font-size:14px;">
                Responder →
              </a>
            </div>
          </div>
        `,
      }),
    });

    if (!notif.ok) {
      const err = await notif.json();
      console.error('Resend error:', err);
      throw new Error('Error enviando email');
    }

    // 2. Registrar en Loops como lead (sin secuencia)
    await fetch('https://app.loops.so/api/v1/contacts/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        firstName: nombre.split(' ')[0],
        lastName: nombre.split(' ').slice(1).join(' ') || '',
        source: 'contacto-web',
        userGroup: tipo || 'contacto',
      }),
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
