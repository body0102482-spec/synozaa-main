/**
 * Grant a paid subscription to a student (admin / dev use).
 *
 * Usage:
 *   npx tsx scripts/grant-plan.ts student@email.com PACKAGE_150
 *
 * Plans: PACKAGE_50 | PACKAGE_150 | PACKAGE_300
 */
import { PrismaClient, type SubscriptionPlan } from '@prisma/client';
import { activatePlan } from '../src/services/subscriptionService.js';

const PAID_PLANS: SubscriptionPlan[] = ['PACKAGE_50', 'PACKAGE_150', 'PACKAGE_300'];

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const plan = process.argv[3]?.trim().toUpperCase() as SubscriptionPlan;

  if (!email || !plan || !PAID_PLANS.includes(plan)) {
    console.error('Usage: npx tsx scripts/grant-plan.ts <email> <PACKAGE_50|PACKAGE_150|PACKAGE_300>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }
    if (user.role !== 'STUDENT') {
      console.error(`User is not a student: ${email}`);
      process.exit(1);
    }

    const subscription = await activatePlan(user.id, plan);
    console.log(`Activated ${plan} for ${email}`);
    console.log(`  casesQuota: ${subscription.casesQuota}`);
    console.log(`  endDate: ${subscription.endDate?.toISOString() ?? 'n/a'}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
