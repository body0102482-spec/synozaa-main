import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { Role } from '@prisma/client';
import {
  ensureHistorySheetStorageRoot,
  resolveHistorySheetPath,
} from '../lib/historySheetStorage.js';
import { getActiveSubscription, isPaidPlan } from '../services/subscriptionService.js';
import fs from 'node:fs/promises';

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
    include: {
      specialty: true,
      difficulty: true,
      category: true,
      historySheet: {
        select: { fileName: true, mimeType: true, fileSize: true, updatedAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ cases });
});

router.get('/:id/history-sheet', authenticate, async (req, res) => {
  try {
    const caseData = await prisma.case.findUnique({
      where: { id: String(req.params.id) },
      select: {
        id: true,
        isPublished: true,
        isFreeTier: true,
        historySheet: {
          select: { fileName: true, mimeType: true, storageKey: true },
        },
      },
    });
    if (!caseData?.historySheet) {
      return res.status(404).json({ error: 'History Sheet not available yet.' });
    }

    if (req.user!.role !== Role.ADMIN) {
      if (!caseData.isPublished) {
        return res.status(404).json({ error: 'History Sheet not available yet.' });
      }
      const subscription = await getActiveSubscription(req.user!.id);
      if (!caseData.isFreeTier && !isPaidPlan(subscription?.plan ?? 'FREE')) {
        return res.status(403).json({ error: 'A paid subscription is required to access this case.' });
      }
    }

    await ensureHistorySheetStorageRoot();
    const filePath = resolveHistorySheetPath(caseData.historySheet.storageKey);
    await fs.access(filePath);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type(caseData.historySheet.mimeType);
    return res.download(filePath, caseData.historySheet.fileName, (error) => {
      if (!error) return;
      console.error('[history-sheet] download failed', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Could not download the History Sheet.' });
      }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return res.status(404).json({
        error: 'The History Sheet file is missing. Please contact support.',
      });
    }
    console.error('[history-sheet] storage unavailable', error);
    return res.status(500).json({ error: 'Could not access the History Sheet right now.' });
  }
});

router.get('/:id', async (req, res) => {
  const caseData = await prisma.case.findUnique({
    where: { id: String(req.params.id) },
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
