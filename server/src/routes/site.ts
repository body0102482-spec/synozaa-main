import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ensurePartnerUniversities } from '../data/defaultUniversities.js';

const router = Router();

async function getOrCreateSettings() {
  let settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    settings = await prisma.siteSettings.create({ data: { id: 'default' } });
  }
  return settings;
}

router.get('/public', async (_req, res) => {
  await ensurePartnerUniversities(prisma);

  const [universities, settings] = await Promise.all([
    prisma.partnerUniversity.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    }),
    getOrCreateSettings(),
  ]);

  res.json({ universities, settings });
});

export default router;
