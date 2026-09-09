export type QbankModuleDef = {
  id: string;
  nameEn: string;
  nameAr: string;
  specialtyEn: string;
  specialtyAr: string;
  subjects: string[];
  /** Free with the term — no purchase required */
  free?: boolean;
  /** Show "owned" badge (e.g. bundled lab module) */
  bundled?: boolean;
  priceEgp: number;
};

export type QbankTermDef = {
  id: string;
  titleEn: string;
  titleAr: string;
  modules: number;
  questions: number;
};

export const QBANK_MODULE_PRICE_EGP = 50;

export const QBANK_TERMS: QbankTermDef[] = [
  { id: '401', titleEn: 'Fourth Year — First Semester', titleAr: 'الفرقة الرابعة — ترم أول', modules: 8, questions: 1248 },
  { id: '402', titleEn: 'Fourth Year — Second Semester', titleAr: 'الفرقة الرابعة — ترم تاني', modules: 7, questions: 1375 },
  { id: '501', titleEn: 'Fifth Year — First Semester', titleAr: 'الفرقة الخامسة — ترم أول', modules: 9, questions: 3412 },
  { id: '502', titleEn: 'Fifth Year — Second Semester', titleAr: 'الفرقة الخامسة — ترم تاني', modules: 8, questions: 1510 },
];

const QBANK_MODULES_401: QbankModuleDef[] = [
  {
    id: 'med-1',
    nameEn: 'Med 1',
    nameAr: 'Med 1',
    specialtyEn: 'Internal Medicine',
    specialtyAr: 'Internal Medicine',
    subjects: ['GIT', 'Hepatology'],
    free: true,
    priceEgp: QBANK_MODULE_PRICE_EGP,
  },
  {
    id: 'med-2',
    nameEn: 'Med 2',
    nameAr: 'Med 2',
    specialtyEn: 'Internal Medicine',
    specialtyAr: 'Internal Medicine',
    subjects: ['Chest', 'Cardiology'],
    priceEgp: QBANK_MODULE_PRICE_EGP,
  },
  {
    id: 'sur-1',
    nameEn: 'Sur 1',
    nameAr: 'Sur 1',
    specialtyEn: 'Surgery',
    specialtyAr: 'Surgery',
    subjects: ['GIT'],
    priceEgp: QBANK_MODULE_PRICE_EGP,
  },
  {
    id: 'sur-2',
    nameEn: 'Sur 2',
    nameAr: 'Sur 2',
    specialtyEn: 'Surgery',
    specialtyAr: 'Surgery',
    subjects: ['Cardio Thoracic'],
    priceEgp: QBANK_MODULE_PRICE_EGP,
  },
  {
    id: 'oncology',
    nameEn: 'Oncology',
    nameAr: 'Oncology',
    specialtyEn: 'Oncology',
    specialtyAr: 'Oncology',
    subjects: [],
    priceEgp: QBANK_MODULE_PRICE_EGP,
  },
  {
    id: 'lab',
    nameEn: 'LAB',
    nameAr: 'LAB',
    specialtyEn: 'Laboratory',
    specialtyAr: 'Laboratory',
    subjects: [],
    free: true,
    bundled: true,
    priceEgp: QBANK_MODULE_PRICE_EGP,
  },
  {
    id: 'nutrition',
    nameEn: 'Nutrition',
    nameAr: 'Nutrition',
    specialtyEn: 'Nutrition',
    specialtyAr: 'Nutrition',
    subjects: [],
    priceEgp: QBANK_MODULE_PRICE_EGP,
  },
  {
    id: 'anaesthesia',
    nameEn: 'Anaesthesia',
    nameAr: 'Anaesthesia',
    specialtyEn: 'Anaesthesia',
    specialtyAr: 'Anaesthesia',
    subjects: [],
    priceEgp: QBANK_MODULE_PRICE_EGP,
  },
];

const MODULES_BY_TERM: Record<string, QbankModuleDef[]> = {
  '401': QBANK_MODULES_401,
};

export function getQbankTerm(termId: string): QbankTermDef | undefined {
  return QBANK_TERMS.find((t) => t.id === termId);
}

export function getQbankModules(termId: string): QbankModuleDef[] {
  return MODULES_BY_TERM[termId] ?? [];
}

export function getQbankModule(termId: string, moduleId: string): QbankModuleDef | undefined {
  return getQbankModules(termId).find((m) => m.id === moduleId);
}

export function isPurchasableModule(termId: string, moduleId: string): boolean {
  const mod = getQbankModule(termId, moduleId);
  return !!mod && !mod.free;
}
