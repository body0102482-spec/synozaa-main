import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { Role } from "@prisma/client";
import {
  caseToForm,
  formToCaseData,
  parseStationConfigForm,
  type CaseFormPayload,
} from "../services/caseFormService.js";
import {
  importedCaseToForm,
  parseImportedCaseSource,
} from "../lib/caseImportParser.js";
import {
  examCasesUploadRoot,
  ensureExamMediaDirs,
} from "../lib/examMediaPaths.js";
import {
  mergeStationConfig,
  parsePartialStationConfig,
  parseStationConfig,
  serializePartialStationConfig,
  type PartialStationConfig,
} from "../lib/stationConfig.js";

const router = Router();
ensureExamMediaDirs();
const examMediaRoot = examCasesUploadRoot();

router.use(authenticate);
router.use(authorize(Role.ADMIN));

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "case"
  );
}

const ALLOWED_MEDIA_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".mp4",
  ".webm",
  ".mpeg",
  ".mp3",
  ".wav",
  ".ogg",
]);

async function saveExamMediaFile(input: {
  fileName: string;
  mimeType?: string;
  dataBase64: string;
  caseSlug?: string;
}): Promise<{ url: string; fileName: string; mimeType: string }> {
  const safeName = path
    .basename(input.fileName)
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  const ext = path.extname(safeName).toLowerCase();
  if (!ALLOWED_MEDIA_EXT.has(ext)) {
    throw Object.assign(new Error("Unsupported file type"), { status: 400 });
  }

  const buffer = Buffer.from(input.dataBase64, "base64");
  if (buffer.length > 12 * 1024 * 1024) {
    throw Object.assign(new Error("File too large (max 12 MB)"), {
      status: 400,
    });
  }

  const folder = slugify(input.caseSlug || "draft");
  const dir = path.join(examMediaRoot, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, safeName), buffer);

  return {
    url: `/exam/cases/${folder}/${safeName}`,
    fileName: safeName,
    mimeType: input.mimeType || "application/octet-stream",
  };
}

router.get("/", async (_req, res) => {
  const cases = await prisma.case.findMany({
    include: { specialty: true, difficulty: true, category: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ cases });
});

router.post("/import/parse", async (req, res) => {
  const source = String(req.body?.source ?? "").trim();
  if (!source)
    return res.status(400).json({ error: "Paste a case object first." });

  try {
    const data = parseImportedCaseSource(source);
    const [specialties, difficulties, categories] = await Promise.all([
      prisma.specialty.findMany({
        where: { isActive: true },
        orderBy: { nameEn: "asc" },
      }),
      prisma.difficultyLevel.findMany({ orderBy: { level: "asc" } }),
      prisma.knowledgeCategory.findMany({ orderBy: { nameEn: "asc" } }),
    ]);

    const form = importedCaseToForm(data, {
      specialties,
      difficulties,
      defaultSpecialtyId: specialties[0]?.id,
      defaultDifficultyId: difficulties[0]?.id,
      defaultCategoryId: categories[0]?.id,
    });

    res.json({ form });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Could not parse the case object.",
    });
  }
});

/** Upload exam media without requiring the case to be saved first. */
router.post("/media/upload", async (req, res) => {
  const { fileName, mimeType, dataBase64, caseSlug } = req.body as {
    fileName?: string;
    mimeType?: string;
    dataBase64?: string;
    caseSlug?: string;
  };

  if (!fileName?.trim() || !dataBase64?.trim()) {
    return res
      .status(400)
      .json({ error: "fileName and dataBase64 are required" });
  }

  try {
    const saved = await saveExamMediaFile({
      fileName,
      mimeType,
      dataBase64,
      caseSlug,
    });
    res.status(201).json(saved);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Upload failed";
    res.status(status).json({ error: message });
  }
});

router.get("/:id/university-overrides", async (req, res) => {
  const caseData = await prisma.case.findUnique({ where: { id: req.params.id } });
  if (!caseData) return res.status(404).json({ error: "Case not found" });

  const overrides = await prisma.caseUniversityOverride.findMany({
    where: { caseId: req.params.id },
    include: {
      university: { select: { id: true, nameEn: true, nameAr: true, isActive: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const baseConfig = parseStationConfig(caseData.stationConfig);
  res.json({
    baseStationConfig: parseStationConfigForm(caseData.stationConfig),
    overrides: overrides.map((row) => ({
      id: row.id,
      universityId: row.universityId,
      university: row.university,
      isActive: row.isActive,
      stationConfig: mergeStationConfig(baseConfig, parsePartialStationConfig(row.stationConfig)),
      overridePatch: parsePartialStationConfig(row.stationConfig),
    })),
  });
});

router.put("/:id/university-overrides/:universityId", async (req, res) => {
  const caseData = await prisma.case.findUnique({ where: { id: req.params.id } });
  if (!caseData) return res.status(404).json({ error: "Case not found" });

  const university = await prisma.partnerUniversity.findUnique({
    where: { id: req.params.universityId },
  });
  if (!university) return res.status(404).json({ error: "University not found" });

  const patch = req.body?.stationConfig as PartialStationConfig | undefined;
  if (!patch || typeof patch !== "object") {
    return res.status(400).json({ error: "stationConfig override is required" });
  }

  const baseConfig = parseStationConfig(caseData.stationConfig);
  const merged = mergeStationConfig(baseConfig, patch);
  if (merged.enabledManeuvers.length === 0) {
    return res.status(400).json({ error: "At least one maneuver must remain enabled" });
  }

  const override = await prisma.caseUniversityOverride.upsert({
    where: {
      caseId_universityId: {
        caseId: req.params.id,
        universityId: req.params.universityId,
      },
    },
    create: {
      caseId: req.params.id,
      universityId: req.params.universityId,
      stationConfig: serializePartialStationConfig(patch),
      isActive: req.body?.isActive !== false,
    },
    update: {
      stationConfig: serializePartialStationConfig(patch),
      ...(req.body?.isActive != null ? { isActive: !!req.body.isActive } : {}),
    },
    include: {
      university: { select: { id: true, nameEn: true, nameAr: true, isActive: true } },
    },
  });

  res.json({
    override: {
      id: override.id,
      universityId: override.universityId,
      university: override.university,
      isActive: override.isActive,
      stationConfig: merged,
      overridePatch: parsePartialStationConfig(override.stationConfig),
    },
  });
});

router.delete("/:id/university-overrides/:universityId", async (req, res) => {
  const existing = await prisma.caseUniversityOverride.findUnique({
    where: {
      caseId_universityId: {
        caseId: req.params.id,
        universityId: req.params.universityId,
      },
    },
  });
  if (!existing) return res.status(404).json({ error: "Override not found" });
  await prisma.caseUniversityOverride.delete({ where: { id: existing.id } });
  res.json({ message: "Override removed" });
});

router.get("/:id", async (req, res) => {
  const caseData = await prisma.case.findUnique({
    where: { id: req.params.id },
    include: { specialty: true, difficulty: true, category: true },
  });
  if (!caseData) return res.status(404).json({ error: "Case not found" });
  res.json({ case: caseData, form: caseToForm(caseData) });
});

router.post("/", async (req, res) => {
  const form = req.body as CaseFormPayload;
  if (!form.titleEn?.trim() || !form.specialtyId || !form.difficultyId) {
    return res
      .status(400)
      .json({ error: "titleEn, specialtyId, and difficultyId are required" });
  }
  const caseData = await prisma.case.create({
    data: formToCaseData(form),
    include: { specialty: true, difficulty: true, category: true },
  });
  res.status(201).json({ case: caseData, form: caseToForm(caseData) });
});

router.put("/:id", async (req, res) => {
  const form = req.body as CaseFormPayload;
  const caseData = await prisma.case.update({
    where: { id: req.params.id },
    data: formToCaseData(form),
    include: { specialty: true, difficulty: true, category: true },
  });
  res.json({ case: caseData, form: caseToForm(caseData) });
});

router.delete("/:id", async (req, res) => {
  try {
    const caseId = req.params.id;
    const existing = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, titleEn: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Case not found" });
    }

    // Sessions reference Case without DB-level cascade. Explicitly clear dependent
    // rows so "testing cases" with history/results/overrides always delete cleanly.
    await prisma.$transaction(async (tx) => {
      const sessions = await tx.session.findMany({
        where: { caseId },
        select: { id: true },
      });
      const sessionIds = sessions.map((s) => s.id);

      if (sessionIds.length > 0) {
        await tx.message.deleteMany({ where: { sessionId: { in: sessionIds } } });
        await tx.result.deleteMany({ where: { sessionId: { in: sessionIds } } });
        await tx.session.deleteMany({ where: { caseId } });
      }

      await tx.caseUniversityOverride.deleteMany({ where: { caseId } });
      await tx.caseAccess.deleteMany({ where: { caseId } });
      await tx.aiKnowledgeEntry.deleteMany({ where: { caseId } });
      await tx.case.delete({ where: { id: caseId } });
    });

    res.json({ message: "Case deleted", id: caseId, titleEn: existing.titleEn });
  } catch (error) {
    const prismaCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code || "")
        : "";
    const message = error instanceof Error ? error.message : "Delete failed";
    console.error("[admin] case delete failed", prismaCode || message);
    if (prismaCode === "P2025") {
      return res.status(404).json({ error: "Case not found" });
    }
    if (prismaCode === "P2003") {
      return res.status(409).json({
        error: "Case still has related records and could not be deleted. Remove linked sessions first.",
      });
    }
    res.status(500).json({ error: message });
  }
});

router.post("/:id/media", async (req, res) => {
  const { fileName, mimeType, dataBase64, caseSlug } = req.body as {
    fileName?: string;
    mimeType?: string;
    dataBase64?: string;
    caseSlug?: string;
  };

  if (!fileName?.trim() || !dataBase64?.trim()) {
    return res
      .status(400)
      .json({ error: "fileName and dataBase64 are required" });
  }

  const existing = await prisma.case.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) return res.status(404).json({ error: "Case not found" });

  try {
    const saved = await saveExamMediaFile({
      fileName,
      mimeType,
      dataBase64,
      caseSlug: caseSlug || existing.titleEn,
    });
    res.status(201).json(saved);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Upload failed";
    res.status(status).json({ error: message });
  }
});

export default router;
