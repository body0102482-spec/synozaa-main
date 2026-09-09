import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = (process.argv[2] || '').trim().toLowerCase();

async function deleteUserByEmail(targetEmail: string) {
  const user = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!user) {
    console.log(`No account found for ${targetEmail}`);
    return;
  }

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.subscription.deleteMany({ where: { userId: user.id } });
  await prisma.caseAccess.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.updateMany({ where: { userId: user.id }, data: { userId: null } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log(`Removed account: ${targetEmail}`);
}

async function main() {
  if (!email) {
    console.error('Usage: npm run db:delete-user -- email@example.com');
    process.exit(1);
  }
  await deleteUserByEmail(email);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
