import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { AiKnowledgeKind, AiKnowledgeRole, Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  ensureAiKnowledgeDirs,
  persistentAiKnowledgeRoot,
} from '../lib/aiKnowledgePaths.js';

const router = Router();
ensureAiKnowledgeDirs();
const uploadRoot = persistentAiKnowledgeRoot();

router.use(authenticate);
router.use(authorize(Role.ADMIN));

const ROLES = new Set<string>(Object.values(AiKnowledgeRole));
const KINDS = new Set<string>(Object.values(AiKnowledgeKind));

const ALLOWED_FILE_EXT = new Set([
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.pdf',
  '.doc',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.mp4',
  '.webm',
  '.mpeg',
  '.mp3',
  '.wav',
  '.ogg',
]);

const TEXT_EXCERPT_EXT = new Set(['.txt', '.md', '.csv', '.json']);

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'knowledge'
  );
}

function isTextMime(mime: string | undefined, ext: string): boolean {
  if (TEXT_EXCERPT_EXT.has(ext)) return true;
  return Boolean(mime && (mime.startsWith('text/') || mime.includes('json')));
}

async function saveKnowledgeFile(input: {
  fileName: string;
  mimeType?: string;
  dataBase64: string;
  folder?: string;
}): Promise<{ url: string; fileName: string; mimeType: string; excerpt: string }> {
  const safeName = path
    .basename(input.fileName)
    .replace(/[^a-zA-Z0-9._-]/g, '-');
  const ext = path.extname(safeName).toLowerCase();
  if (!ALLOWED_FILE_EXT.has(ext)) {
    throw Object.assign(new Error('Unsupported file type'), { status: 400 });
  }

  const buffer = Buffer.from(input.dataBase64, 'base64');
  if (buffer.length > 12 * 1024 * 1024) {
    throw Object.assign(new Error('File too large (max 12 MB)'), { status: 400 });
  }

  const folder = slugify(input.folder || 'general');
  const dir = path.join(uploadRoot, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, safeName), buffer);

  let excerpt = '';
  if (isTextMime(input.mimeType, ext) && buffer.length < 200_000) {
    excerpt = buffer.toString('utf8').slice(0, 20_000);
  }

  return {
    url: `/knowledge/${folder}/${safeName}`,
    fileName: safeName,
    mimeType: input.mimeType || 'application/octet-stream',
    excerpt,
  };
}

function parseRole(value: unknown): AiKnowledgeRole | null {
  const v = String(value || '').toUpperCase();
  return ROLES.has(v) ? (v as AiKnowledgeRole) : null;
}

function parseKind(value: unknown): AiKnowledgeKind | null {
  const v = String(value || '').toUpperCase();
  return KINDS.has(v) ? (v as AiKnowledgeKind) : null;
}

router.get('/', async (req, res) => {
  const role = req.query.role ? parseRole(req.query.role) : null;
  const kind = req.query.kind ? parseKind(req.query.kind) : null;
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
  const caseId = typeof req.query.caseId === 'string' ? req.query.caseId : undefined;
  const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;

  const where: Prisma.AiKnowledgeEntryWhereInput = {};
  if (role) where.role = role;
  if (kind) where.kind = kind;
  if (categoryId) where.categoryId = categoryId;
  if (caseId) where.caseId = caseId;
  if (scope === 'category') where.categoryId = { not: null };
  if (scope === 'case') where.caseId = { not: null };

  const entries = await prisma.aiKnowledgeEntry.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: {
      category: { select: { id: true, nameEn: true, nameAr: true } },
      case: { select: { id: true, titleEn: true, titleAr: true } },
    },
  });

  res.json({ entries });
});

router.post('/upload', async (req, res) => {
  try {
    const fileName = String(req.body?.fileName || '').trim();
    const dataBase64 = String(req.body?.dataBase64 || '').trim();
    if (!fileName || !dataBase64) {
      return res.status(400).json({ error: 'fileName and dataBase64 are required' });
    }
    const saved = await saveKnowledgeFile({
      fileName,
      mimeType: req.body?.mimeType,
      dataBase64,
      folder: req.body?.folder,
    });
    res.status(201).json(saved);
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    res.status(status).json({ error: (error as Error).message || 'Upload failed' });
  }
});

router.post('/', async (req, res) => {
  const role = parseRole(req.body?.role);
  const kind = parseKind(req.body?.kind);
  const titleEn = String(req.body?.titleEn || '').trim();
  const titleAr = String(req.body?.titleAr || '').trim();
  const content = String(req.body?.content ?? '');
  const categoryId = req.body?.categoryId ? String(req.body.categoryId) : null;
  const caseId = req.body?.caseId ? String(req.body.caseId) : null;

  if (!role || !kind) {
    return res.status(400).json({ error: 'role and kind are required' });
  }
  if (!titleEn) {
    return res.status(400).json({ error: 'titleEn is required' });
  }
  if (!categoryId && !caseId) {
    return res.status(400).json({ error: 'Attach this entry to a category or a case' });
  }
  if (kind === 'PROMPT' && !content.trim()) {
    return res.status(400).json({ error: 'Prompt content is required' });
  }
  if ((kind === 'FILE' || kind === 'MEDIA') && !String(req.body?.fileUrl || '').trim()) {
    return res.status(400).json({ error: 'Upload a file or media first' });
  }

  const entry = await prisma.aiKnowledgeEntry.create({
    data: {
      role,
      kind,
      titleEn,
      titleAr,
      content,
      fileUrl: req.body?.fileUrl ? String(req.body.fileUrl) : null,
      fileName: req.body?.fileName ? String(req.body.fileName) : null,
      mimeType: req.body?.mimeType ? String(req.body.mimeType) : null,
      categoryId,
      caseId,
      isActive: req.body?.isActive !== false,
      sortOrder: Number(req.body?.sortOrder) || 0,
    },
    include: {
      category: { select: { id: true, nameEn: true, nameAr: true } },
      case: { select: { id: true, titleEn: true, titleAr: true } },
    },
  });

  res.status(201).json({ entry });
});

router.put('/:id', async (req, res) => {
  const existing = await prisma.aiKnowledgeEntry.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Entry not found' });

  const role = req.body?.role !== undefined ? parseRole(req.body.role) : existing.role;
  const kind = req.body?.kind !== undefined ? parseKind(req.body.kind) : existing.kind;
  if (!role || !kind) {
    return res.status(400).json({ error: 'Invalid role or kind' });
  }

  const categoryId =
    req.body?.categoryId !== undefined
      ? req.body.categoryId
        ? String(req.body.categoryId)
        : null
      : existing.categoryId;
  const caseId =
    req.body?.caseId !== undefined
      ? req.body.caseId
        ? String(req.body.caseId)
        : null
      : existing.caseId;

  if (!categoryId && !caseId) {
    return res.status(400).json({ error: 'Attach this entry to a category or a case' });
  }

  const entry = await prisma.aiKnowledgeEntry.update({
    where: { id: req.params.id },
    data: {
      role,
      kind,
      titleEn:
        req.body?.titleEn !== undefined ? String(req.body.titleEn).trim() : existing.titleEn,
      titleAr:
        req.body?.titleAr !== undefined ? String(req.body.titleAr).trim() : existing.titleAr,
      content: req.body?.content !== undefined ? String(req.body.content) : existing.content,
      fileUrl:
        req.body?.fileUrl !== undefined
          ? req.body.fileUrl
            ? String(req.body.fileUrl)
            : null
          : existing.fileUrl,
      fileName:
        req.body?.fileName !== undefined
          ? req.body.fileName
            ? String(req.body.fileName)
            : null
          : existing.fileName,
      mimeType:
        req.body?.mimeType !== undefined
          ? req.body.mimeType
            ? String(req.body.mimeType)
            : null
          : existing.mimeType,
      categoryId,
      caseId,
      isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : existing.isActive,
      sortOrder:
        req.body?.sortOrder !== undefined ? Number(req.body.sortOrder) || 0 : existing.sortOrder,
    },
    include: {
      category: { select: { id: true, nameEn: true, nameAr: true } },
      case: { select: { id: true, titleEn: true, titleAr: true } },
    },
  });

  res.json({ entry });
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.aiKnowledgeEntry.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Entry not found' });
  await prisma.aiKnowledgeEntry.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

export default router;
