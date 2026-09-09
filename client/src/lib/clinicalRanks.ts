export const CLINICAL_RANKS = [
  { key: 'medical_student', minXp: 0, emoji: '🎓', nameEn: 'Medical Student', nameAr: 'طالب طب' },
  { key: 'clinical_clerk', minXp: 500, emoji: '🩺', nameEn: 'Clinical Clerk', nameAr: 'Clinical Clerk' },
  { key: 'intern_doctor', minXp: 1500, emoji: '🏥', nameEn: 'Intern Doctor', nameAr: 'طبيب امتياز' },
  { key: 'junior_resident', minXp: 3000, emoji: '👨‍⚕️', nameEn: 'Junior Resident', nameAr: 'Junior Resident' },
  { key: 'resident', minXp: 5000, emoji: '👨‍⚕️', nameEn: 'Resident', nameAr: 'Resident' },
  { key: 'senior_resident', minXp: 8000, emoji: '⭐', nameEn: 'Senior Resident', nameAr: 'Senior Resident' },
  { key: 'registrar', minXp: 11000, emoji: '📋', nameEn: 'Registrar', nameAr: 'Registrar' },
  { key: 'specialist', minXp: 14000, emoji: '🩻', nameEn: 'Specialist', nameAr: 'Specialist' },
  { key: 'senior_specialist', minXp: 17000, emoji: '🏅', nameEn: 'Senior Specialist', nameAr: 'Senior Specialist' },
  { key: 'consultant', minXp: 20000, emoji: '👑', nameEn: 'Consultant', nameAr: 'Consultant' },
] as const;

export type ClinicalRank = (typeof CLINICAL_RANKS)[number];

export function rankLabel(
  rank: { emoji: string; nameEn: string; nameAr: string },
  isAr: boolean,
) {
  const name = isAr ? rank.nameAr : rank.nameEn;
  return `${rank.emoji} ${name}`;
}
