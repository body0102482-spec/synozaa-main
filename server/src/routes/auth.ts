import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { authenticate, verifyTokenForRefresh } from '../middleware/auth.js';
import { issueAndSendOtp, verifyUserOtp } from '../services/otpService.js';
import { isSmtpConfigured, sendPasswordResetEmail } from '../services/emailService.js';
import { normalizeEmailLang } from '../services/emailTemplates.js';
import { resolveUniversityFromInput } from '../lib/universityScope.js';
import { EGYPTIAN_MOBILE_PATTERN, isValidEgyptianMobile } from '../lib/phoneValidation.js';

const router = Router();

function signToken(user: { id: string; email: string; role: string }) {
  const secret = process.env.JWT_SECRET || 'synoza-jwt-default-secret-key-super-secure-2026';
  const expiresIn = (process.env.JWT_EXPIRES_IN || '365d') as jwt.SignOptions['expiresIn'];
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
    expiresIn,
  });
}

function publicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  university: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  studentId?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    university: user.university,
    phone: user.phone ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    studentId: user.studentId ?? undefined,
  };
}

function isValidAvatarUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(value) &&
    value.length <= 400_000
  );
}

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('studentId').trim().notEmpty().isLength({ min: 3, max: 32 }),
    body('phone')
      .isString()
      .matches(EGYPTIAN_MOBILE_PATTERN)
      .withMessage('Enter a valid Egyptian mobile number.'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    if (!isSmtpConfigured()) {
      return res.status(503).json({ error: 'Email verification is not available' });
    }

    const { email, password, firstName, lastName, phone, university, universityId, studentId, lang } = req.body;
    const preferredLang = normalizeEmailLang(lang);
    const normalizedStudentId = String(studentId).trim();
    const normalizedPhone = String(phone ?? '');
    if (String(universityId ?? '') === '__other__' && !String(university ?? '').trim()) {
      return res.status(400).json({ error: 'Enter your university name.' });
    }
    const resolvedUniversity = await resolveUniversityFromInput({ universityId, university });

    const studentIdTaken = await prisma.user.findUnique({ where: { studentId: normalizedStudentId } });
    if (studentIdTaken && studentIdTaken.email !== email) {
      return res.status(409).json({ error: 'Student ID already registered' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.emailVerified) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          preferredLang,
          firstName,
          lastName,
          phone: normalizedPhone,
          university: resolvedUniversity.university,
          universityId: resolvedUniversity.universityId,
          studentId: normalizedStudentId,
          passwordHash: await bcrypt.hash(password, 12),
        },
      });
      try {
        await issueAndSendOtp(existing.id, existing.email, existing.firstName, preferredLang);
      } catch (err) {
        console.error('[auth/register] resend OTP failed:', err);
        return res.status(503).json({
          error: 'Failed to send verification email',
          email: existing.email,
        });
      }
      return res.status(201).json({
        message: 'Verification code sent',
        email: existing.email,
        requiresVerification: true,
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone: normalizedPhone,
        university: resolvedUniversity.university,
        universityId: resolvedUniversity.universityId,
        studentId: normalizedStudentId,
        emailVerified: false,
        preferredLang,
      },
    });

    await prisma.subscription.create({ data: { userId: user.id } });

    try {
      await issueAndSendOtp(user.id, user.email, user.firstName, preferredLang);
    } catch (err) {
      console.error('[auth/register] OTP email failed:', err);
      return res.status(503).json({
        error: 'Failed to send verification email',
        email: user.email,
      });
    }

    res.status(201).json({
      message: 'Verification code sent',
      email: user.email,
      requiresVerification: true,
    });
  }
);

router.post(
  '/verify-otp',
  [body('email').isEmail().normalizeEmail(), body('code').trim().isLength({ min: 6, max: 6 })],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, code } = req.body;
    const result = await verifyUserOtp(email, code);

    if (!result.ok) {
      const error =
        result.reason === 'EXPIRED' ? 'Verification code expired' : 'Invalid verification code';
      return res.status(400).json({ error, code: result.reason });
    }

    const token = signToken(result.user);
    res.json({ token, user: publicUser(result.user) });
  }
);

router.post(
  '/resend-otp',
  [body('email').isEmail().normalizeEmail()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    if (!isSmtpConfigured()) {
      return res.status(503).json({ error: 'Email verification is not available' });
    }

    const { email, lang } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.emailVerified) {
      return res.json({ message: 'If the account exists and is unverified, a new code was sent' });
    }

    const preferredLang = lang ? normalizeEmailLang(lang) : undefined;

    try {
      await issueAndSendOtp(user.id, user.email, user.firstName, preferredLang);
    } catch (err) {
      console.error('[auth/resend-otp] failed:', err);
      return res.status(503).json({ error: 'Failed to send verification email' });
    }

    res.json({ message: 'Verification code sent', email: user.email });
  }
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    const token = signToken(user);
    void prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
    res.json({ token, user: publicUser(user) });
  }
);

router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(404).json({ error: 'Email not registered', code: 'EMAIL_NOT_FOUND' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 3600000);
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetExpires },
  });

  if (isSmtpConfigured()) {
    try {
      await sendPasswordResetEmail(user.email, user.firstName, resetToken, normalizeEmailLang(user.preferredLang));
    } catch (err) {
      console.error('[auth/forgot-password] email failed:', err);
      return res.status(503).json({ error: 'Failed to send reset email' });
    }
  } else if (process.env.NODE_ENV === 'development') {
    return res.json({ message: 'Reset token generated', resetToken });
  }

  res.json({ message: 'Password reset link sent' });
});

router.post(
  '/reset-password',
  [body('token').notEmpty(), body('password').isLength({ min: 6 })],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { token, password } = req.body;
    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetExpires: { gt: new Date() } },
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetExpires: null },
    });

    if (!updated.isActive || !updated.emailVerified) {
      return res.json({ message: 'Password reset successful' });
    }

    void prisma.user.update({ where: { id: updated.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
    res.json({
      message: 'Password reset successful',
      token: signToken(updated),
      user: publicUser(updated),
    });
  }
);

router.get('/me', authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      university: true,
      studentId: true,
      avatarUrl: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
    },
  });
  if (!user || !user.isActive || !user.emailVerified) {
    return res.status(401).json({ error: 'Session expired' });
  }
  const { isActive: _isActive, emailVerified: _emailVerified, ...publicUserData } = user;
  res.json({ user: publicUserData });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = verifyTokenForRefresh(header.slice(7));
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, role: true, isActive: true, emailVerified: true },
  });
  if (!user || !user.isActive || !user.emailVerified) {
    return res.status(401).json({ error: 'Session expired' });
  }
  void prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  res.json({ token: signToken(user) });
});

router.put('/profile', authenticate, async (req: Request, res: Response) => {
  const { firstName, lastName, phone, university, universityId, avatarUrl, academicYear } = req.body;

  if (avatarUrl != null && avatarUrl !== '' && !isValidAvatarUrl(avatarUrl)) {
    return res.status(400).json({ error: 'Invalid profile photo' });
  }
  if (phone !== undefined && phone !== null && !isValidEgyptianMobile(phone)) {
    return res.status(400).json({ error: 'Enter a valid Egyptian mobile number.' });
  }

  const resolvedUniversity =
    universityId !== undefined || university !== undefined
      ? await resolveUniversityFromInput({ universityId, university })
      : null;

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      firstName,
      lastName,
      phone,
      ...(resolvedUniversity
        ? {
            university: resolvedUniversity.university,
            universityId: resolvedUniversity.universityId,
          }
        : {}),
      avatarUrl: avatarUrl === '' ? null : avatarUrl,
      ...(academicYear !== undefined ? { academicYear: academicYear || null } : {}),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      university: true,
      universityId: true,
      academicYear: true,
      studentId: true,
      avatarUrl: true,
      role: true,
    },
  });
  res.json({ user });
});

router.put('/change-password', authenticate, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ message: 'Password updated' });
});

export default router;
