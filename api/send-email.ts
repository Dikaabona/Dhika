import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, html, attachments } = req.body;

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "RESEND_API_KEY is not configured" });
  }

  try {
    const formattedAttachments = (attachments || []).map((att: any) => ({
      ...att,
      content: att.content ? Buffer.from(att.content, 'base64') : undefined
    }));

    const { data, error } = await resend.emails.send({
      from: "HR Visibel <onboarding@resend.dev>",
      to,
      subject,
      html,
      attachments: formattedAttachments,
    });

    if (error) {
      return res.status(400).json({ error });
    }

    res.status(200).json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
