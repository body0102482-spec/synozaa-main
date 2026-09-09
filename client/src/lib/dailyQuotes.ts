const QUOTES_EN = [
  'Every great clinician started with one patient conversation.',
  'Practice does not make perfect — perfect practice makes perfect.',
  'Listen to the patient — they are telling you the diagnosis.',
  'Confidence in the OSCE comes from structured, repeated practice.',
  'Small improvements in history-taking lead to big gains in scores.',
  'Today\'s simulation is tomorrow\'s real patient encounter.',
  'Master the basics: introduce, explore, examine, explain.',
  'Clinical excellence is built one station at a time.',
];

const QUOTES_AR = [
  'كل طبيب عظيم بدأ بمحادثة واحدة مع مريض.',
  'التدريب المنظم هو سر الثقة في الـ OSCE.',
  'اسمع المريض — هو بيقولك التشخيص.',
  'التحسن البسيط في أخذ التاريخ بيصنع فرق كبير في الدرجة.',
  'محاكاة النهاردة هي مواجهة المريض الحقيقي بكرة.',
  'أتقن الأساسيات: تعريف، استجواب، فحص، شرح.',
  'التميز السريري بيتبني محطة محطة.',
  'الثقة في الامتحان جاية من التكرار والتنظيم.',
];

export function getDailyQuote(isAr: boolean): string {
  const pool = isAr ? QUOTES_AR : QUOTES_EN;
  const dayIndex = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  return pool[dayIndex % pool.length];
}

export function getPlanTierKey(plan: string): string {
  switch (plan) {
    case 'PACKAGE_50':
      return 'planTierBasic';
    case 'PACKAGE_150':
      return 'planTierPro';
    case 'PACKAGE_300':
      return 'planTierPremium';
    case 'INSTITUTION':
      return 'planTierInstitution';
    default:
      return 'planTierFree';
  }
}
