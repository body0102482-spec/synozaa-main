export type EmailLang = 'en' | 'ar';

export function normalizeEmailLang(lang?: string): EmailLang {
  return lang?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

const copy = {
  en: {
    subject: 'Verify your Synoza account',
    title: 'Verify your Synoza account',
    subtitle: 'Academic OSCE Portal',
    hello: (name: string) => `Hello ${name},`,
    intro:
      'Welcome to Synoza. Use the verification code below to confirm your email and activate your student account.',
    codeLabel: 'Verification code',
    expires: 'This code expires in',
    expiresMinutes: '15 minutes',
    cta: 'Open Synoza',
    ignore: 'If you did not create a Synoza account, you can safely ignore this email.',
    footer: 'Clinical simulation platform',
    textIntro:
      'Welcome to Synoza. Use this verification code to confirm your email and activate your account:',
    textOpen: 'Open Synoza:',
    textIgnore: 'If you did not create an account, ignore this email.',
  },
  ar: {
    subject: 'تأكيد حسابك على Synoza',
    title: 'تأكيد حسابك على Synoza',
    subtitle: 'بوابة OSCE الأكاديمية',
    hello: (name: string) => `مرحباً ${name}،`,
    intro:
      'أهلاً بك في Synoza. استخدم كود التحقق أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك الطلابي.',
    codeLabel: 'كود التحقق',
    expires: 'ينتهي هذا الكود خلال',
    expiresMinutes: '15 دقيقة',
    cta: 'فتح Synoza',
    ignore: 'إذا لم تقم بإنشاء حساب على Synoza، يمكنك تجاهل هذا البريد بأمان.',
    footer: 'منصة المحاكاة السريرية',
    textIntro: 'أهلاً بك في Synoza. استخدم كود التحقق التالي لتأكيد بريدك وتفعيل حسابك:',
    textOpen: 'فتح Synoza:',
    textIgnore: 'إذا لم تقم بإنشاء حساب، تجاهل هذا البريد.',
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatOtpCode(code: string): string {
  return code;
}

export function buildOtpEmailHtml(
  firstName: string,
  code: string,
  siteUrl: string,
  lang: EmailLang = 'en',
): string {
  const t = copy[lang];
  const isAr = lang === 'ar';
  const safeName = escapeHtml(firstName);
  const otpDisplay = formatOtpCode(escapeHtml(code));
  const safeUrl = escapeHtml(siteUrl);
  const logoUrl = escapeHtml(getEmailLogoUrl());
  const fontFamily = isAr
    ? "'Tajawal','Segoe UI',Tahoma,Arial,sans-serif"
    : "'Segoe UI',Roboto,Arial,sans-serif";
  const align = isAr ? 'right' : 'left';
  const dir = isAr ? 'rtl' : 'ltr';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${t.title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f8fa;font-family:${fontFamily};color:#1e293b;direction:${dir};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f8fa;padding:32px 16px;direction:${dir};">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 12px 40px rgba(15,23,42,0.08);direction:${dir};">
          <tr>
            <td style="height:6px;background:linear-gradient(90deg,#0d9488 0%,#14b8a6 50%,#6366f1 100%);"></td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);">
              <img
                src="${logoUrl}"
                alt="Synoza"
                width="56"
                height="56"
                style="display:block;margin:0 auto 16px;border:0;border-radius:14px;outline:none;text-decoration:none;"
              />
              <h1 style="margin:0;font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">Synoza</h1>
              <p style="margin:8px 0 0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">${t.subtitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;text-align:${align};">
              <p style="margin:0 0 12px;font-size:16px;line-height:1.8;color:#334155;">${t.hello(safeName)}</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.9;color:#475569;">${t.intro}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="padding:24px 16px;border-radius:16px;background:linear-gradient(180deg,#f0fdfa 0%,#ecfeff 100%);border:1px solid #99f6e4;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;"><strong>${t.codeLabel}</strong></p>
                    <p style="margin:0;font-size:36px;font-weight:900;letter-spacing:0.35em;color:#0f172a;font-family:'Courier New',Courier,monospace;direction:ltr;"><strong>${otpDisplay}</strong></p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.8;color:#64748b;text-align:center;">
                ${t.expires} <strong style="color:#0f766e;">${t.expiresMinutes}</strong>.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(90deg,#0d9488 0%,#0f766e 100%);">
                    <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${t.cta}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.8;color:#94a3b8;text-align:center;">${t.ignore}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f1f5f9;background:#f8fafc;text-align:center;">
              <p style="margin:0;font-size:12px;color:#64748b;">&copy; ${new Date().getFullYear()} Synoza &middot; ${t.footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildOtpEmailText(
  firstName: string,
  code: string,
  siteUrl: string,
  lang: EmailLang = 'en',
): string {
  const t = copy[lang];
  return `Synoza — ${t.subtitle}

${t.hello(firstName)}

${t.textIntro}

${code}

${t.expires} ${t.expiresMinutes}.

${t.textOpen} ${siteUrl}

${t.textIgnore}`;
}

export function getOtpEmailSubject(lang: EmailLang = 'en'): string {
  return copy[lang].subject;
}

const resetCopy = {
  en: {
    subject: 'Reset your Synoza password',
    title: 'Reset your password',
    hello: (name: string) => `Hello ${name},`,
    intro: 'We received a request to reset your Synoza password. Use the button below to choose a new password.',
    cta: 'Reset password',
    expires: 'This link expires in 1 hour.',
    ignore: 'If you did not request a password reset, you can safely ignore this email.',
    textIntro: 'Reset your Synoza password using this link:',
    textIgnore: 'If you did not request this, ignore this email.',
  },
  ar: {
    subject: 'إعادة تعيين كلمة مرور Synoza',
    title: 'إعادة تعيين كلمة المرور',
    hello: (name: string) => `مرحباً ${name}،`,
    intro: 'تلقّينا طلباً لإعادة تعيين كلمة مرور حسابك على Synoza. استخدم الزر أدناه لاختيار كلمة مرور جديدة.',
    cta: 'إعادة تعيين كلمة المرور',
    expires: 'ينتهي هذا الرابط خلال ساعة واحدة.',
    ignore: 'إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد بأمان.',
    textIntro: 'أعد تعيين كلمة مرور Synoza عبر هذا الرابط:',
    textIgnore: 'إذا لم تطلب ذلك، تجاهل هذا البريد.',
  },
} as const;

export function buildPasswordResetEmailHtml(
  firstName: string,
  resetUrl: string,
  lang: EmailLang = 'en',
): string {
  const t = resetCopy[lang];
  const isAr = lang === 'ar';
  const safeName = escapeHtml(firstName);
  const safeUrl = escapeHtml(resetUrl);
  const fontFamily = isAr
    ? "'Tajawal','Segoe UI',Tahoma,Arial,sans-serif"
    : "'Segoe UI',Roboto,Arial,sans-serif";
  const align = isAr ? 'right' : 'left';
  const dir = isAr ? 'rtl' : 'ltr';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8" /><title>${t.title}</title></head>
<body style="margin:0;padding:24px;background:#f0f2f5;font-family:${fontFamily};text-align:${align};">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">${t.title}</h1>
        <p style="margin:0 0 12px;color:#334155;">${t.hello(safeName)}</p>
        <p style="margin:0 0 20px;color:#475569;line-height:1.6;">${t.intro}</p>
        <p style="margin:0 0 24px;">
          <a href="${safeUrl}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">${t.cta}</a>
        </p>
        <p style="margin:0 0 12px;color:#64748b;font-size:13px;">${t.expires}</p>
        <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">${t.ignore}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function buildPasswordResetEmailText(
  firstName: string,
  resetUrl: string,
  lang: EmailLang = 'en',
): string {
  const t = resetCopy[lang];
  return `Synoza — ${t.title}

${t.hello(firstName)}

${t.textIntro}
${resetUrl}

${t.expires}

${t.textIgnore}`;
}

export function getPasswordResetEmailSubject(lang: EmailLang = 'en'): string {
  return resetCopy[lang].subject;
}

export function getEmailSiteUrl(): string {
  const clientUrl = process.env.CLIENT_URL || process.env.EMAIL_SITE_URL || 'https://medsynoza.com';
  if (/localhost|127\.0\.0\.1/i.test(clientUrl)) {
    return process.env.EMAIL_SITE_URL || 'https://medsynoza.com';
  }
  return clientUrl.replace(/\/$/, '');
}

/** Public logo URL for HTML emails (must be absolute). */
export function getEmailLogoUrl(): string {
  const custom = process.env.EMAIL_LOGO_URL?.trim();
  if (custom) return custom;
  return `${getEmailSiteUrl()}/synoza-icon.png`;
}
