import { PrismaClient } from '@prisma/client';
import { splitQuestionContent } from '../src/lib/qbankQuestionContent.js';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.qbankQuestion.findMany({
    select: { id: true, text: true, explanation: true },
  });

  let fixed = 0;
  for (const row of rows) {
    if (!row.text.includes('\n\n---\n')) continue;
    const split = splitQuestionContent(row.text, row.explanation);
    if (split.stem === row.text) continue;
    await prisma.qbankQuestion.update({
      where: { id: row.id },
      data: {
        text: split.stem,
        explanation: split.explanation ?? row.explanation,
      },
    });
    fixed += 1;
  }

  console.log(`Fixed ${fixed} questions with baked-in explanations.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
