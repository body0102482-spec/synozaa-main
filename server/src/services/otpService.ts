import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { sendOtpEmail, isSmtpConfigured } from './emailService.js';
import { normalizeEmailLang, type EmailLang } from './emailTemplates.js';

const OTP_TTL_MS = 15 * 60 * 1000;

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function resolveEmailLang(userId: string, lang?: string): Promise<EmailLang> {
  if (lang) return normalizeEmailLang(lang);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredLang: true },
  });
  return normalizeEmailLang(user?.preferredLang || 'en');
}

export async function issueAndSendOtp(
  userId: string,
  email: string,
  firstName: string,
  lang?: string,
) {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }

  const emailLang = await resolveEmailLang(userId, lang);
  const code = generateOtpCode();
  const otpCode = await bcrypt.hash(code, 10);
  const otpExpires = new Date(Date.now() + OTP_TTL_MS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      otpCode,
      otpExpires,
      ...(lang ? { preferredLang: emailLang } : {}),
    },
  });

  await sendOtpEmail(email, code, firstName, emailLang);
}

export async function verifyUserOtp(email: string, code: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.otpCode || !user.otpExpires) {
    return { ok: false as const, reason: 'INVALID' as const };
  }

  if (user.otpExpires < new Date()) {
    return { ok: false as const, reason: 'EXPIRED' as const };
  }

  const valid = await bcrypt.compare(code, user.otpCode);
  if (!valid) {
    return { ok: false as const, reason: 'INVALID' as const };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, otpCode: null, otpExpires: null },
  });

  return { ok: true as const, user: updated };
}
