import { PrismaClient } from '@prisma/client';

const query = process.argv[2]?.trim() || '';

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      where: query
        ? {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      take: 20,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          select: { plan: true, casesQuota: true, status: true, startDate: true },
        },
        paymentOrders: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { merchantOrderId: true, status: true, plan: true, productType: true, paidAt: true },
        },
      },
    });
    console.log(JSON.stringify(users, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main();
