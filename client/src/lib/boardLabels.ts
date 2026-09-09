/** Display labels for rotation boards (OSCE Rotation UI). */
export function boardDisplayName(nameEn: string, isAr: boolean): string {
  const en: Record<string, string> = {
    'Internal Medicine': 'Internal Medicine',
    Surgery: 'Surgery',
    Pediatrics: 'Pediatric',
    'Obstetrics & Gynecology': 'OBS&GYN',
    'Chest / Cardiology': 'Cardiology',
    Cardiology: 'Cardiology',
  };
  const ar: Record<string, string> = {
    'Internal Medicine': 'الباطنة',
    Surgery: 'جراحة',
    Pediatrics: 'أطفال',
    'Obstetrics & Gynecology': 'OBS&GYN',
    'Chest / Cardiology': 'القلب',
    Cardiology: 'القلب',
  };
  const map = isAr ? ar : en;
  return map[nameEn] ?? nameEn;
}

export function boardShortLabel(nameEn: string): string {
  if (nameEn === 'Obstetrics & Gynecology') return 'OBS&GYN';
  if (nameEn === 'Internal Medicine') return 'Internal Med.';
  if (nameEn === 'Surgery') return 'Surgery';
  if (nameEn === 'Pediatrics') return 'Pediatric';
  return nameEn;
}
