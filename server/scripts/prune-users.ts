import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const KEEP_EMAILS = [
  (process.env.ADMIN_EMAIL || 'admin@synoza.com').toLowerCase(),
  'student@synoza.com',
];

async function main() {
  const toRemove = await prisma.user.findMany({
    where: { email: { notIn: KEEP_EMAILS } },
    select: { id: true, email: true },
  });

  if (toRemove.length === 0) {
    console.log('No extra accounts to remove.');
    return;
  }

  const ids = toRemove.map((u) => u.id);
  console.log(`Removing ${toRemove.length} account(s):`);
  toRemove.forEach((u) => console.log(`  - ${u.email}`));

  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.subscription.deleteMany({ where: { userId: { in: ids } } });
  await prisma.caseAccess.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.updateMany({ where: { userId: { in: ids } }, data: { userId: null } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });

  const remaining = await prisma.user.findMany({ select: { email: true, role: true } });
  console.log('\nRemaining accounts:');
  remaining.forEach((u) => console.log(`  - ${u.email} (${u.role})`));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
