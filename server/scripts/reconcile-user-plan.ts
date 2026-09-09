/**
 * Fix a user stuck on FREE after a PAID subscription order.
 *
 * Usage:
 *   npx tsx scripts/reconcile-user-plan.ts body@email.com
 */
import { PrismaClient } from '@prisma/client';
import { activatePlan, getActiveSubscription, isPaidPlan } from '../src/services/subscriptionService.js';
import type { SubscriptionPlan } from '@prisma/client';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npx tsx scripts/reconcile-user-plan.ts <email>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    const active = await getActiveSubscription(user.id);
    if (active && isPaidPlan(active.plan)) {
      console.log(`Already on paid plan: ${active.plan} (${active.casesQuota} cases)`);
      return;
    }

    const paidOrder = await prisma.paymentOrder.findFirst({
      where: { userId: user.id, status: 'PAID', plan: { not: null } },
      orderBy: { paidAt: 'desc' },
    });

    if (paidOrder?.plan) {
      const sub = await activatePlan(user.id, paidOrder.plan as SubscriptionPlan);
      console.log(`Activated ${paidOrder.plan} from order ${paidOrder.merchantOrderId}`);
      console.log(`  casesQuota: ${sub.casesQuota}, endDate: ${sub.endDate?.toISOString() ?? 'n/a'}`);
      return;
    }

    console.error('No PAID subscription order found. Use grant-plan.ts to assign a plan manually.');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
