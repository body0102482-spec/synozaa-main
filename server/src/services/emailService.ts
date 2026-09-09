import nodemailer from 'nodemailer';
import {
  buildOtpEmailHtml,
  buildOtpEmailText,
  buildPasswordResetEmailHtml,
  buildPasswordResetEmailText,
  getOtpEmailSubject,
  getPasswordResetEmailSubject,
  getEmailSiteUrl,
  normalizeEmailLang,
  type EmailLang,
} from './emailTemplates.js';

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP is not configured');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 20_000,
  });
}

export async function sendOtpEmail(
  to: string,
  code: string,
  firstName: string,
  lang: EmailLang = 'en',
) {
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const fromName = process.env.SMTP_FROM_NAME || 'Synoza';
  const siteUrl = getEmailSiteUrl();
  const emailLang = normalizeEmailLang(lang);

  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: getOtpEmailSubject(emailLang),
    text: buildOtpEmailText(firstName, code, siteUrl, emailLang),
    html: buildOtpEmailHtml(firstName, code, siteUrl, emailLang),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  resetToken: string,
  lang: EmailLang = 'en',
) {
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const fromName = process.env.SMTP_FROM_NAME || 'Synoza';
  const emailLang = normalizeEmailLang(lang);
  const resetUrl = `${getEmailSiteUrl()}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: getPasswordResetEmailSubject(emailLang),
    text: buildPasswordResetEmailText(firstName, resetUrl, emailLang),
    html: buildPasswordResetEmailHtml(firstName, resetUrl, emailLang),
  });
}

export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function verifySmtpConnection(): Promise<boolean> {
  if (!isSmtpConfigured()) return false;
  try {
    await getTransporter().verify();
    return true;
  } catch (err) {
    console.error('[email] SMTP verify failed:', err);
    return false;
  }
}
