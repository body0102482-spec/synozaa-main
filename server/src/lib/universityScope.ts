import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export async function resolveUserUniversityId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { universityId: true, university: true },
  });
  if (!user) return null;
  if (user.universityId) return user.universityId;

  const name = user.university?.trim();
  if (!name) return null;

  const match = await prisma.partnerUniversity.findFirst({
    where: {
      isActive: true,
      OR: [{ nameEn: name }, { nameAr: name }],
    },
    select: { id: true },
  });
  if (!match) return null;

  await prisma.user
    .update({
      where: { id: userId },
      data: { universityId: match.id },
    })
    .catch(() => {});

  return match.id;
}

export function qbankModuleUniversityFilter(universityId: string | null): Prisma.QbankModuleWhereInput {
  if (!universityId) {
    return { universities: { none: {} } };
  }
  return {
    OR: [{ universities: { none: {} } }, { universities: { some: { universityId } } }],
  };
}

export async function resolveUniversityFromInput(input: {
  universityId?: string | null;
  university?: string | null;
}): Promise<{ universityId: string | null; university: string | null }> {
  const id = input.universityId?.trim();
  if (id) {
    const uni = await prisma.partnerUniversity.findFirst({
      where: { id, isActive: true },
    });
    if (uni) return { universityId: uni.id, university: uni.nameEn };
  }

  const name = input.university?.trim();
  if (name) {
    const uni = await prisma.partnerUniversity.findFirst({
      where: { isActive: true, OR: [{ nameEn: name }, { nameAr: name }] },
    });
    if (uni) return { universityId: uni.id, university: uni.nameEn };
    return { universityId: null, university: name };
  }

  return { universityId: null, university: null };
}

export async function syncModuleUniversities(moduleId: string, universityIds: string[]) {
  const validIds = [...new Set(universityIds.map((id) => id.trim()).filter(Boolean))];
  if (validIds.length) {
    const count = await prisma.partnerUniversity.count({ where: { id: { in: validIds } } });
    if (count !== validIds.length) {
      throw new Error('Invalid university id');
    }
  }

  await prisma.$transaction([
    prisma.qbankModuleUniversity.deleteMany({ where: { moduleId } }),
    ...(validIds.length
      ? [
          prisma.qbankModuleUniversity.createMany({
            data: validIds.map((universityId) => ({ moduleId, universityId })),
          }),
        ]
      : []),
  ]);
}
