/**
 * SMTP mailer for Microsoft 365 / Office 365 (SMTP AUTH client submission).
 *
 * Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Same pattern as workxpace — STARTTLS on 587, SSL on 465.
 *
 * Send is best-effort: failures are logged and return false so callers
 * can fail closed (OTP) without throwing through the request path.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

function readSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  const port = Number(process.env.SMTP_PORT?.trim() || '587');

  if (!host || !user || !pass || !from) return null;
  if (!Number.isFinite(port) || port <= 0) return null;

  return { host, port, user, pass, from };
}

/** True when all required SMTP env vars are present. */
export function isEmailConfigured(): boolean {
  return readSmtpConfig() !== null;
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const config = readSmtpConfig();
  if (!config) return null;

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.port === 587,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  return cachedTransporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildDefaultHtml(subject: string, text: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Helvetica,Arial,sans-serif;line-height:1.5;color:#111827">
  <h2 style="font-size:18px;margin:0 0 12px">${escapeHtml(subject)}</h2>
  <p style="margin:0;white-space:pre-wrap">${escapeHtml(text)}</p>
</body>
</html>`;
}

/**
 * Send one email via SMTP. Returns false (without throwing) when SMTP is
 * not configured or the provider rejects the message.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const config = readSmtpConfig();
  const transporter = getTransporter();
  if (!config || !transporter) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[email] SMTP not configured; skipping send', {
        subject: input.subject,
      });
    }
    return false;
  }

  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!recipients.length) return false;

  try {
    await transporter.sendMail({
      from: config.from,
      to: recipients.join(', '),
      subject: input.subject,
      text: input.text,
      html: input.html ?? buildDefaultHtml(input.subject, input.text),
    });
    return true;
  } catch (error) {
    console.error('[email] send failed', {
      subject: input.subject,
      to: recipients,
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }
}

export function escapeEmailHtml(value: string): string {
  return escapeHtml(value);
}
