/**
 * SMTP mailer for Microsoft 365 / Office 365 (SMTP AUTH client submission).
 *
 * Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Same pattern as workxpace — STARTTLS on 587, SSL on 465.
 *
 * Send is best-effort: failures are logged and return false so callers
 * can fail closed (OTP) without throwing through the request path.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

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

const SMTP_CONNECTION_TIMEOUT_MS = 8_000;
const SMTP_SOCKET_TIMEOUT_MS = 12_000;

let cachedTransporter: Transporter | null = null;

/**
 * Pin SMTP to an A record. Node 18+ Happy Eyeballs can pick AAAA first;
 * TQA then fails with ENETUNREACH on IPv6 while `nc` on another host
 * succeeds on IPv4. Connecting to the IPv4 literal matches `nc`.
 */
async function resolveSmtpConnectHost(hostname: string): Promise<{
  connectHost: string;
  servername: string;
}> {
  if (isIP(hostname) === 4) {
    return { connectHost: hostname, servername: hostname };
  }

  const { address } = await dnsLookup(hostname, { family: 4 });
  return { connectHost: address, servername: hostname };
}

async function getTransporter(): Promise<Transporter | null> {
  const config = readSmtpConfig();
  if (!config) return null;

  if (!cachedTransporter) {
    let connectHost = config.host;
    let servername = config.host;
    try {
      const resolved = await resolveSmtpConnectHost(config.host);
      connectHost = resolved.connectHost;
      servername = resolved.servername;
    } catch (error) {
      console.error('[email] IPv4 DNS lookup failed', {
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }

    const options: SMTPTransport.Options = {
      host: connectHost,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.port === 587,
      connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
      tls: { servername },
      auth: {
        user: config.user,
        pass: config.pass,
      },
    };
    cachedTransporter = nodemailer.createTransport(options);
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
  const transporter = await getTransporter();
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
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }
}

export function escapeEmailHtml(value: string): string {
  return escapeHtml(value);
}
