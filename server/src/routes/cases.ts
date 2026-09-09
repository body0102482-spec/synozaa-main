import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { Role } from '@prisma/client';

const router = Router();

function parseVitalSigns(vitalSigns: string) {
  try {
    return JSON.parse(vitalSigns);
  } catch {
    return {};
  }
}

router.get('/specialties', async (_req, res) => {
  const specialties = await prisma.specialty.findMany({
    where: { isActive: true },
    orderBy: { nameEn: 'asc' },
  });
  res.json({ specialties });
});

router.get('/difficulties', async (_req, res) => {
  const difficulties = await prisma.difficultyLevel.findMany({ orderBy: { level: 'asc' } });
  res.json({ difficulties });
});

router.get('/', async (req, res) => {
  const { search, specialtyId, difficultyId, categoryId, freeTier } = req.query;

  const cases = await prisma.case.findMany({
    where: {
      isPublished: true,
      ...(freeTier === 'true' ? { isFreeTier: true } : {}),
      ...(specialtyId ? { specialtyId: String(specialtyId) } : {}),
      ...(difficultyId ? { difficultyId: String(difficultyId) } : {}),
      ...(categoryId ? { categoryId: String(categoryId) } : {}),
      ...(search
        ? {
            OR: [
              { titleEn: { contains: String(search) } },
              { titleAr: { contains: String(search) } },
              { patientName: { contains: String(search) } },
              { chiefComplaint: { contains: String(search) } },
            ],
          }
        : {}),
    },
    include: { specialty: true, difficulty: true, category: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ cases });
});

router.get('/:id', async (req, res) => {
  const caseData = await prisma.case.findUnique({
    where: { id: req.params.id },
    include: { specialty: true, difficulty: true, category: true },
  });

  if (!caseData || (!caseData.isPublished && req.headers.authorization === undefined)) {
    return res.status(404).json({ error: 'Case not found' });
  }

  res.json({
    case: {
      ...caseData,
      vitalSignsParsed: parseVitalSigns(caseData.vitalSigns),
      finalDiagnosis: undefined,
      scenarioPrompt: undefined,
    },
  });
});

router.post('/', authenticate, authorize(Role.ADMIN), async (req, res) => {
  const data = req.body;
  const caseData = await prisma.case.create({
    data: {
      ...data,
      vitalSigns: typeof data.vitalSigns === 'object' ? JSON.stringify(data.vitalSigns) : data.vitalSigns,
    },
    include: { specialty: true, difficulty: true, category: true },
  });
  res.status(201).json({ case: caseData });
});

router.put('/:id', authenticate, authorize(Role.ADMIN), async (req, res) => {
  const id = String(req.params.id);
  const data = req.body;
  const caseData = await prisma.case.update({
    where: { id },
    data: {
      ...data,
      vitalSigns: data.vitalSigns
        ? typeof data.vitalSigns === 'object'
          ? JSON.stringify(data.vitalSigns)
          : data.vitalSigns
        : undefined,
    },
    include: { specialty: true, difficulty: true, category: true },
  });
  res.json({ case: caseData });
});

router.delete('/:id', authenticate, authorize(Role.ADMIN), async (req, res) => {
  try {
    const caseId = String(req.params.id);
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { caseId } }),
      prisma.case.delete({ where: { id: caseId } }),
    ]);
    res.json({ message: 'Case deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed';
    res.status(500).json({ error: message });
  }
});

export default router;
