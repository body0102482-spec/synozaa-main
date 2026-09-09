export const DEFAULT_UNIVERSITIES = [
  { nameEn: 'Misr University for Science and Technology', nameAr: 'جامعة مصر للعلوم والتكنولوجيا' },
  { nameEn: '6th October University', nameAr: 'جامعة 6 أكتوبر' },
  { nameEn: 'Ain Shams University', nameAr: 'جامعة عين شمس' },
  { nameEn: 'Al-Azhar University', nameAr: 'جامعة الأزهر' },
  { nameEn: 'Benha University', nameAr: 'جامعة بنها' },
  { nameEn: 'Cairo University', nameAr: 'جامعة القاهرة' },
  { nameEn: 'Fayoum University', nameAr: 'جامعة الفيوم' },
  { nameEn: 'Galala University', nameAr: 'جامعة الجلالة' },
  { nameEn: 'Mansoura University', nameAr: 'جامعة المنصورة' },
  { nameEn: 'MTI University', nameAr: 'جامعة MTI' },
  { nameEn: 'Nahda University', nameAr: 'جامعة النهضة' },
  { nameEn: 'Alexandria University', nameAr: 'جامعة الإسكندرية' },
] as const;

import type { PrismaClient } from '@prisma/client';

export async function ensurePartnerUniversities(prisma: PrismaClient) {
  for (let i = 0; i < DEFAULT_UNIVERSITIES.length; i++) {
    const uni = DEFAULT_UNIVERSITIES[i];
    const existing = await prisma.partnerUniversity.findFirst({
      where: { nameEn: uni.nameEn },
    });
    if (!existing) {
      await prisma.partnerUniversity.create({
        data: { nameEn: uni.nameEn, nameAr: uni.nameAr, sortOrder: i, isActive: true },
      });
    } else if (!existing.isActive) {
      await prisma.partnerUniversity.update({
        where: { id: existing.id },
        data: { isActive: true, sortOrder: i, nameAr: uni.nameAr },
      });
    }
  }
}
