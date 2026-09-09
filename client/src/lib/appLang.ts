export function getAppLang(): string {
  return 'en';
}

/** BCP-47 tag for speech APIs — Synoza defaults to Egyptian Arabic. */
export function resolveSpeechLanguage(
  sessionLang: 'AUTO' | 'AR' | 'EN' | string = 'AUTO',
  uiLang?: string,
): string {
  if (sessionLang === 'AR') return 'ar-EG';
  if (sessionLang === 'EN') return 'en-US';
  return 'ar-EG';
}

export function speechLanguageIsArabic(speechLang: string): boolean {
  return speechLang.toLowerCase().startsWith('ar');
}

export function verifyEmailPath(email: string, lang?: string): string {
  const appLang = lang || getAppLang();
  return `/verify-email?email=${encodeURIComponent(email)}&lang=${encodeURIComponent(appLang)}`;
}
