import { PrismaClient } from '@prisma/client';
import { activatePlan } from './src/services/subscriptionService.js';

const email = process.argv[2]?.trim().toLowerCase();
const plan = (process.argv[3]?.trim().toUpperCase() || 'PACKAGE_300') as 'PACKAGE_300';

async function main() {
  if (!email) {
    console.error('Usage: npx tsx scripts/grant-user-remote.ts <email> [PACKAGE_300]');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error('USER_NOT_FOUND');
      process.exit(1);
    }
    const sub = await activatePlan(user.id, plan);
    console.log('ACTIVATED', user.email, sub.plan, sub.casesQuota, sub.endDate?.toISOString());
  } finally {
    await prisma.$disconnect();
  }
}

void main();
