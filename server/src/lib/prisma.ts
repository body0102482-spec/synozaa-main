import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
  const isTurso = databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('https://');

  if (isTurso) {
    const libsql = createClient({
      url: databaseUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSql(libsql as any);
    return new PrismaClient({ adapter } as any);
  }
  return new PrismaClient();
}

export const prisma = createPrismaClient();


