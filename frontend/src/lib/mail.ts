import nodemailer from "nodemailer";

interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const from =
  process.env.EMAIL_FROM ||
  process.env.SMTP_FROM ||
  "noreply@platzhalter.local";

export async function sendMail(options: SendMailOptions): Promise<void> {
  if (process.env.USESEND_API_KEY) {
    await sendViaUseSend(options);
  } else {
    await sendViaSMTP(options);
  }
}

async function sendViaUseSend(options: SendMailOptions): Promise<void> {
  const baseURL = process.env.USESEND_URL;
  if (!baseURL) {
    throw new Error("USESEND_URL is required when USESEND_API_KEY is set");
  }

  const res = await fetch(`${baseURL}/api/v1/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.USESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`useSend API error (${res.status}): ${body}`);
  }
}

let smtpTransport: nodemailer.Transporter | null = null;

function getSMTPTransport(): nodemailer.Transporter {
  if (!smtpTransport) {
    const port = Number(process.env.SMTP_PORT || 1025);
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "127.0.0.1",
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
        : undefined,
    });
  }
  return smtpTransport;
}

async function sendViaSMTP(options: SendMailOptions): Promise<void> {
  await getSMTPTransport().sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}
