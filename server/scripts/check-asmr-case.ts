import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const c = await prisma.case.findFirst({
      where: { titleEn: { contains: 'AS + MR' } },
      select: { id: true, titleEn: true, isFreeTier: true, examImages: true },
    });
    if (!c) {
      console.log('NOT_FOUND');
      return;
    }
    console.log(
      JSON.stringify(
        {
          id: c.id,
          title: c.titleEn,
          isFreeTier: c.isFreeTier,
          hasExamImages: !!c.examImages,
          examImagesLen: c.examImages?.length ?? 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
