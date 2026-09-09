/** Standalone plan grant — only uses Prisma (no TS service imports). */
import { PrismaClient } from '@prisma/client';

const PLANS = {
  PACKAGE_50: { casesQuota: 50, priceEgp: 150, months: 2 },
  PACKAGE_150: { casesQuota: 150, priceEgp: 300, months: 4 },
  PACKAGE_300: { casesQuota: 300, priceEgp: 500, months: 6 },
} as const;

type PlanId = keyof typeof PLANS;

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const planId = (process.argv[3]?.trim().toUpperCase() || 'PACKAGE_300') as PlanId;
  const cfg = PLANS[planId];

  if (!email || !cfg) {
    console.error('Usage: npx tsx scripts/grant-plan-standalone.ts <email> [PACKAGE_300]');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('USER_NOT_FOUND');
      process.exit(1);
    }

    await prisma.subscription.updateMany({
      where: { userId: user.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED', endDate: new Date() },
    });

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + cfg.months);

    const sub = await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: planId,
        status: 'ACTIVE',
        casesQuota: cfg.casesQuota,
        priceEgp: cfg.priceEgp,
        endDate,
      },
    });

    console.log('OK', email, sub.plan, sub.casesQuota, sub.endDate?.toISOString());
  } finally {
    await prisma.$disconnect();
  }
}

void main();
