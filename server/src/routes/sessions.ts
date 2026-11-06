import { Router } from 'express';
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import {
  getPatientResponse,
  getExaminerEvaluation,
  getExaminerVivaResponse,
  getManeuverExaminerResponse,
  getManeuverCompletionState,
  resolveEvaluationLanguage,
  sanitizeRealtimePatientTranscript,
  unwrapExaminerPlainText,
} from '../services/aiService.js';
import {
  checkCanStartCase,
  createFreeCaseSession,
  createPaidCaseSession,
  findSessionStartByIdempotencyKey,
  getUserEntitlements,
  normalizeSessionType,
  SessionStartError,
} from '../services/subscriptionService.js';
import { serializeResolvedStationConfigForUser } from '../services/caseResolveService.js';
import { applySessionXp, getRankProgress } from '../services/xpService.js';
import { processTextTurn, processVoiceTurn } from '../services/voiceTurnService.js';
import { createRealtimePatientCallAnswer, isRealtimeConfigured, RealtimeCallError } from '../services/realtimePatientService.js';
import {
  buildGeminiLiveSessionConfig,
  createGeminiLiveEphemeralToken,
  isLiveVoiceSessionType,
} from '../services/geminiLiveService.js';
import { createOpenRouterPatientAudioTurn, isOpenRouterAudioEnabled, OpenRouterAudioError, openRouterAudioInputFormat, transcribeOpenRouterAudio } from '../services/openRouterAudioService.js';
import {
  buildExaminerVivaOpening,
  getCurrentVivaQuestionNumber,
  getVivaClosing,
  HISTORY_EXAMINER_STAGE,
  isExaminerVivaComplete,
  isHistoryExaminerVivaStage,
  pickVivaQuestionsForSession,
  respondToHistoryVivaAnswer,
} from '../services/examinerVivaService.js';
import {
  buildRealtimeManeuverExaminerInstructions,
  buildRealtimeVivaExaminerInstructions,
} from '../services/examinerLiveService.js';
import { Language, MessageRole } from '@prisma/client';
import { getSessionStationConfig, isManeuverEnabled, MANEUVER_LABELS, parseStationConfig, resolveManeuverOpeningMessage } from '../lib/stationConfig.js';

const router = Router();

const EXAM_MANEUVER_ORDER = ['inspection', 'palpation', 'percussion', 'auscultation'] as const;

function parseCompletedManeuvers(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function maneuverStage(maneuverId: string) {
  return `examination:${maneuverId}`;
}

function canStartManeuver(_maneuverId: string, _completed: string[]) {
  return true;
}

router.use(authenticate);

// Configuration endpoint: exposes whether openrouter_audio, openai_realtime, or live_call is enabled.
router.get('/voice-provider', (_req, res) => {
  if (isOpenRouterAudioEnabled()) {
    return res.json({ provider: 'openrouter_audio' });
  }
  if (isRealtimeConfigured()) {
    return res.json({ provider: 'openai_realtime' });
  }
  return res.json({ provider: 'live_call' });
});

router.get('/:id/voice-provider', (_req, res) => {
  if (isOpenRouterAudioEnabled()) {
    return res.json({ provider: 'openrouter_audio' });
  }
  if (isRealtimeConfigured()) {
    return res.json({ provider: 'openai_realtime' });
  }
  return res.json({ provider: 'live_call' });
});

router.post('/:id/live-voice/token', async (req, res) => {
  try {
    const { role = 'PATIENT', stage, maneuverId } = (req.body ?? {}) as {
      role?: 'PATIENT' | 'EXAMINER';
      stage?: string;
      maneuverId?: string;
    };
    if (role !== 'PATIENT' && role !== 'EXAMINER') {
      return res.status(400).json({ error: 'Invalid live voice role' });
    }
    if (stage !== undefined && typeof stage !== 'string') {
      return res.status(400).json({ error: 'Invalid live voice stage' });
    }

    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
      include: { case: true },
    });
    if (!session) return res.status(404).json({ error: 'Active session not found' });
    if (!isLiveVoiceSessionType(session.sessionType)) {
      return res.status(403).json({ error: 'LIVE_VOICE_SESSION_REQUIRED' });
    }

    const stationConfig = getSessionStationConfig(session);
    let config;

    if (role === 'PATIENT') {
      if (stage && stage !== 'history') {
        return res.status(400).json({ error: 'Patient voice is only available in the history stage' });
      }
      config = buildGeminiLiveSessionConfig(
        session.case,
        session.language,
        stationConfig.patientBehavior,
        { role: 'PATIENT' },
      );
    } else if (stage === HISTORY_EXAMINER_STAGE) {
      if (!stationConfig.enableHistoryExaminer) {
        return res.status(400).json({ error: 'History examiner is not enabled for this case' });
      }
      const vivaMessages = await prisma.message.findMany({
        where: { sessionId: session.id, stage: HISTORY_EXAMINER_STAGE },
        orderBy: { createdAt: 'asc' },
      });
      const questions = pickVivaQuestionsForSession(session.id, session.case);
      config = buildGeminiLiveSessionConfig(
        session.case,
        session.language,
        stationConfig.patientBehavior,
        {
          role: 'EXAMINER',
          examinerInstructions: buildRealtimeVivaExaminerInstructions(session.case, {
            questions,
            currentQuestionNumber: getCurrentVivaQuestionNumber(
              vivaMessages,
              HISTORY_EXAMINER_STAGE,
              questions,
            ),
            completed: isExaminerVivaComplete(vivaMessages, HISTORY_EXAMINER_STAGE),
            opening: buildExaminerVivaOpening(session.id, session.case),
            closing: getVivaClosing(session.language),
          }),
        },
      );
    } else if (typeof stage === 'string' && stage.startsWith('examination:')) {
      const resolvedManeuverId = maneuverId || stage.slice('examination:'.length);
      if (!EXAM_MANEUVER_ORDER.includes(resolvedManeuverId as (typeof EXAM_MANEUVER_ORDER)[number])) {
        return res.status(400).json({ error: 'Invalid examination maneuver' });
      }
      if (!isManeuverEnabled(stationConfig, resolvedManeuverId)) {
        return res.status(400).json({ error: 'Maneuver not enabled for this case' });
      }
      const maneuverLabel =
        stationConfig.maneuverLabels?.[resolvedManeuverId as keyof typeof stationConfig.maneuverLabels]?.en ||
        MANEUVER_LABELS[resolvedManeuverId as keyof typeof MANEUVER_LABELS].en;
      config = buildGeminiLiveSessionConfig(
        session.case,
        session.language,
        stationConfig.patientBehavior,
        {
          role: 'EXAMINER',
          examinerInstructions: buildRealtimeManeuverExaminerInstructions(session.case, session.language, {
            maneuverId: resolvedManeuverId,
            maneuverLabel,
            openingMessage: resolveManeuverOpeningMessage(resolvedManeuverId, stationConfig),
          }),
        },
      );
    } else {
      return res.status(400).json({ error: 'Invalid examiner voice stage' });
    }

    const token = await createGeminiLiveEphemeralToken(config);
    return res.json(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini Live is unavailable';
    if (message === 'gemini-live-unavailable') {
      return res.status(503).json({ error: 'Gemini Live is not configured' });
    }
    if (message === 'gemini-live-token-failed' || message === 'gemini-live-token-invalid') {
      return res.status(502).json({ error: 'Gemini Live could not create a secure call token' });
    }
    console.error('[live-voice/token]', error);
    return res.status(500).json({ error: 'Failed to start Live Voice' });
  }
});


router.post('/:id/live-voice/message', async (req, res) => {
  try {
    const { content, role, stage } = req.body as {
      content?: string;
      role?: 'STUDENT' | 'PATIENT' | 'EXAMINER';
      stage?: string;
    };
    const text = content?.trim();
    const validRoles: Array<'STUDENT' | 'PATIENT' | 'EXAMINER'> = ['STUDENT', 'PATIENT', 'EXAMINER'];
    if (!text || !role || !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Valid voice transcript and role required' });
    }

    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
      include: { case: true },
    });
    if (!session) return res.status(404).json({ error: 'Active session not found' });
    if (session.sessionType !== 'LIVE_VOICE') {
      return res.status(403).json({ error: 'LIVE_VOICE_SESSION_REQUIRED' });
    }

    const stationConfig = getSessionStationConfig(session);

    // Resolve and whitelist the target stage for this transcript turn.
    let targetStage = 'history';
    if (typeof stage === 'string' && stage !== 'history') {
      if (stage === HISTORY_EXAMINER_STAGE) {
        if (!stationConfig.enableHistoryExaminer) {
          return res.status(400).json({ error: 'History examiner is not enabled for this case' });
        }
        if (role === 'PATIENT') {
          return res.status(400).json({ error: 'Patient voice is only available in the history stage' });
        }
        targetStage = stage;
      } else if (stage.startsWith('examination:')) {
        const maneuverId = stage.slice('examination:'.length);
        if (
          !EXAM_MANEUVER_ORDER.includes(maneuverId as (typeof EXAM_MANEUVER_ORDER)[number]) ||
          !isManeuverEnabled(stationConfig, maneuverId)
        ) {
          return res.status(400).json({ error: 'Invalid examination maneuver' });
        }
        if (role === 'PATIENT') {
          return res.status(400).json({ error: 'Patient voice is only available in the history stage' });
        }
        targetStage = stage;
      } else {
        return res.status(400).json({ error: 'Invalid live voice stage' });
      }
    } else if (role === 'EXAMINER') {
      // Examiner turns are stage-specific; they must never be stored as history.
      return res.status(400).json({ error: 'Examiner voice transcripts require a valid stage' });
    }

    let contentToSave = text;
    if (role === 'PATIENT') {
      const lastStudentMessage = await prisma.message.findFirst({
        where: { sessionId: session.id, role: MessageRole.STUDENT, stage: 'history' },
        orderBy: { createdAt: 'desc' },
      });
      contentToSave = sanitizeRealtimePatientTranscript(
        session.case,
        lastStudentMessage?.content ?? '',
        text,
        session.language,
      );
    }
    const message = await prisma.message.create({
      data: {
        sessionId: session.id,
        role:
          role === 'PATIENT'
            ? MessageRole.PATIENT
            : role === 'EXAMINER'
              ? MessageRole.EXAMINER
              : MessageRole.STUDENT,
        content: contentToSave,
        stage: targetStage,
      },
    });
    return res.json({ message });
  } catch (error) {
    console.error('[live-voice/message]', error);
    return res.status(500).json({ error: 'Failed to save Live Voice transcript' });
  }
});


router.post('/start', async (req, res) => {
  const { caseId, language = 'AUTO' } = req.body ?? {};
  const userId = req.user!.id;
  let sessionType: ReturnType<typeof normalizeSessionType>;
  try {
    sessionType = normalizeSessionType(req.body?.sessionType);
  } catch (error) {
    if (error instanceof SessionStartError && error.code === 'INVALID_SESSION_TYPE') {
      return res.status(400).json({ error: error.code });
    }
    throw error;
  }

  const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return res.status(400).json({ error: 'IDEMPOTENCY_KEY_REQUIRED' });
  }

  let existingSession;
  try {
    existingSession = await findSessionStartByIdempotencyKey(
      userId,
      idempotencyKey,
      String(caseId || ''),
      sessionType,
    );
  } catch (error) {
    if (error instanceof SessionStartError && error.code === 'IDEMPOTENCY_KEY_CONFLICT') {
      return res.status(409).json({ error: error.code });
    }
    throw error;
  }
  if (existingSession) {
    const entitlements = await getUserEntitlements(userId);
    return res.json({ session: existingSession, entitlements });
  }

  const caseData = await prisma.case.findUnique({ where: { id: caseId, isPublished: true } });
  if (!caseData) return res.status(404).json({ error: 'Case not found' });

  const access = await checkCanStartCase(userId, caseId);
  if (!access.allowed) {
    if (access.code === 'FREE_LIMIT_REACHED') {
      return res.status(403).json({
        error: 'FREE_LIMIT_REACHED',
        message: 'You have used all free case attempts this month. Upgrade to continue.',
        attempts: access.attempts,
        limit: access.limit,
      });
    }
    if (access.code === 'CASE_QUOTA_EXCEEDED') {
      return res.status(403).json({
        error: 'CASE_QUOTA_EXCEEDED',
        message: 'You have reached your case quota. Upgrade your plan for more cases.',
        casesUnlocked: access.casesUnlocked,
        casesQuota: access.casesQuota,
      });
    }
    if (access.code === 'SUBSCRIPTION_REQUIRED') {
      return res.status(403).json({
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'This case requires a subscription. Upgrade to unlock.',
      });
    }
  }

  const resolvedStationConfig = await serializeResolvedStationConfigForUser(caseId, userId);
  const stationConfig = parseStationConfig(resolvedStationConfig);
  const requestedLanguage = String(language || 'AUTO').toUpperCase();
  const sessionLanguage =
    requestedLanguage === 'AR' || requestedLanguage === 'EN'
      ? requestedLanguage
      : stationConfig.patientBehavior.preferredLanguage === 'AR' ||
          stationConfig.patientBehavior.preferredLanguage === 'EN'
        ? stationConfig.patientBehavior.preferredLanguage
        : 'AUTO';

  const languageValue = sessionLanguage as Language;
  let session;
  try {
    if ('attemptsRemaining' in access) {
      session = await createFreeCaseSession(
        userId,
        caseId,
        languageValue,
        resolvedStationConfig,
        sessionType,
        idempotencyKey,
      );
      if (!session) {
        return res.status(403).json({
          error: 'FREE_LIMIT_REACHED',
          message: 'You have used all free case attempts this month. Upgrade to continue.',
          attempts: access.attempts,
          limit: access.limit,
        });
      }
    } else {
      session = await createPaidCaseSession(
        userId,
        caseId,
        languageValue,
        resolvedStationConfig,
        sessionType,
        idempotencyKey,
      );
    }
  } catch (error) {
    if (error instanceof SessionStartError) {
      if (error.code === 'INSUFFICIENT_CREDITS') {
        return res.status(403).json({
          error: error.code,
          requiredCredits: error.details?.required,
          availableCredits: error.details?.available,
        });
      }
      if (error.code === 'IDEMPOTENCY_KEY_CONFLICT') {
        return res.status(409).json({ error: error.code });
      }
      if (error.code === 'SESSION_START_CONFLICT') {
        return res.status(503).json({ error: error.code });
      }
      if (error.code === 'SUBSCRIPTION_REQUIRED') {
        return res.status(403).json({ error: error.code });
      }
    }
    throw error;
  }

  const entitlements = await getUserEntitlements(userId);

  res.status(201).json({ session, entitlements });
});

router.get('/my', async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user!.id },
    include: {
      case: {
        include: {
          specialty: true,
          difficulty: true,
          historySheet: {
            select: { fileName: true, mimeType: true, fileSize: true, updatedAt: true },
          },
        },
      },
      result: true,
    },
    orderBy: { startedAt: 'desc' },
  });
  res.json({ sessions });
});

router.get('/:id', async (req, res) => {
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: {
      case: {
        include: {
          specialty: true,
          difficulty: true,
          historySheet: {
            select: { fileName: true, mimeType: true, fileSize: true, updatedAt: true },
          },
        },
      },
      messages: { orderBy: { createdAt: 'asc' } },
      result: true,
    },
  });

  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ session });
});

router.post('/:id/maneuver/start', async (req, res) => {
  const { maneuverId } = req.body;
  if (!maneuverId || !EXAM_MANEUVER_ORDER.includes(maneuverId)) {
    return res.status(400).json({ error: 'Invalid maneuver' });
  }

  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
    include: { case: true, messages: true },
  });
  if (!session) return res.status(404).json({ error: 'Active session not found' });

  const stationConfig = getSessionStationConfig(session);
  if (!isManeuverEnabled(stationConfig, maneuverId)) {
    return res.status(400).json({ error: 'Maneuver not enabled for this case' });
  }

  const completed = parseCompletedManeuvers(session.completedManeuvers);
  if (!canStartManeuver(maneuverId, completed)) {
    return res.status(400).json({ error: 'Complete the previous examination step first' });
  }

  const stage = maneuverStage(maneuverId);
  const existing = session.messages.filter((m) => m.stage === stage);
  let openingMessage = existing.find((m) => m.role === MessageRole.EXAMINER);
  const openingContent = resolveManeuverOpeningMessage(maneuverId, stationConfig);

  if (!openingMessage) {
    openingMessage = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.EXAMINER,
        content: openingContent,
        stage,
      },
    });
  } else if (openingMessage.content !== openingContent) {
    openingMessage = await prisma.message.update({
      where: { id: openingMessage.id },
      data: { content: openingContent },
    });
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { activeManeuver: maneuverId, currentStage: 'examination' },
  });

  res.json({ session: updated, message: openingMessage });
});

router.post('/:id/maneuver/complete', async (req, res) => {
  const { maneuverId } = req.body;
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
    include: { case: true, messages: true },
  });
  if (!session) return res.status(404).json({ error: 'Active session not found' });

  const examinerMessages = session.messages
    .filter((m) => m.stage === maneuverStage(maneuverId) && m.role === MessageRole.EXAMINER)
    .map((m) => m.content);
  const lastExaminerMsg = examinerMessages[examinerMessages.length - 1];

  const completion = getManeuverCompletionState(
    session.case,
    maneuverId,
    session.messages
      .filter((m) => m.stage === maneuverStage(maneuverId) && m.role === MessageRole.STUDENT)
      .map((m) => m.content),
    lastExaminerMsg,
  );
  if (!completion.complete) {
    return res.status(409).json({ error: 'Maneuver is not complete', completion });
  }

  const completed = parseCompletedManeuvers(session.completedManeuvers);
  if (!completed.includes(maneuverId)) completed.push(maneuverId);

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { completedManeuvers: JSON.stringify(completed), activeManeuver: null },
  });

  res.json({ session: updated, completedManeuvers: completed, completion });
});

router.post(
  '/:id/realtime/call',
  express.text({ type: ['application/sdp', 'text/plain'] }),
  async (req, res) => {
    try {
      const sdpOffer = typeof req.body === 'string' ? req.body.trim() : '';
      if (!sdpOffer) {
        return res.status(400).json({ error: 'SDP offer required' });
      }

      const session = await prisma.session.findFirst({
        where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
        include: { case: true },
      });
      if (!session) return res.status(404).json({ error: 'Active session not found' });

      const answerSdp = await createRealtimePatientCallAnswer(
        session.case,
        session.language,
        sdpOffer,
        req.user!.id,
      );
      res.type('application/sdp').send(answerSdp);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Realtime call failed';
      const status = error instanceof RealtimeCallError ? error.status : undefined;
      if (message === 'realtime-unavailable') {
        return res.status(503).json({ error: 'Realtime API is not configured' });
      }
      if (message === 'invalid-sdp') {
        return res.status(400).json({ error: 'Incomplete WebRTC offer. Refresh and try again.' });
      }
      if (message === 'realtime-call-failed') {
        return res.status(status ?? 502).json({ error: 'Realtime call failed' });
      }
      console.error('[realtime/call]', error);
      res.status(500).json({ error: 'Realtime call failed' });
    }
  },
);

router.post('/:id/realtime/message', async (req, res) => {
  try {
    const { content, role = 'STUDENT', stage = 'history', orderIndex } = req.body as {
      content?: string;
      role?: 'STUDENT' | 'PATIENT';
      stage?: string;
      orderIndex?: number;
    };

    const text = content?.trim();
    if (!text) return res.status(400).json({ error: 'Message content required' });

    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
      include: { case: true },
    });
    if (!session) return res.status(404).json({ error: 'Active session not found' });

    let messageContent = text;
    if (role === 'PATIENT') {
      const lastStudent = await prisma.message.findFirst({
        where: { sessionId: session.id, role: MessageRole.STUDENT },
        orderBy: { createdAt: 'desc' },
      });
      messageContent = sanitizeRealtimePatientTranscript(
        session.case,
        lastStudent?.content ?? '',
        text,
        session.language,
      );
    }

    const createdAt =
      typeof orderIndex === 'number' && Number.isFinite(orderIndex)
        ? new Date(session.startedAt.getTime() + orderIndex * 1000)
        : undefined;

    const message = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: role === 'PATIENT' ? MessageRole.PATIENT : MessageRole.STUDENT,
        content: messageContent,
        stage,
        ...(createdAt ? { createdAt } : {}),
      },
    });

    res.json({ message });
  } catch (error) {
    console.error('[realtime/message]', error);
    res.status(500).json({ error: 'Failed to save realtime message' });
  }
});

router.patch('/:id/language', async (req, res) => {
  const languageRaw = String(req.body?.language ?? '').toUpperCase();
  if (languageRaw !== 'AUTO' && languageRaw !== 'AR' && languageRaw !== 'EN') {
    return res.status(400).json({ error: 'language must be AUTO, AR, or EN' });
  }

  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
  });
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { language: languageRaw as Language },
  });

  res.json({ language: updated.language });
});

router.post('/:id/voice-turn', async (req, res) => {
  try {
    const {
      audioBase64,
      transcript: transcriptBody,
      mimeType = 'audio/webm',
      language = 'ar-EG',
      forceArabic,
      sessionLang,
      stage = 'history',
      endpoint = 'chat',
      maneuverId,
      recordingDurationMs,
      speechDurationMs,
    } = req.body as {
      audioBase64?: string;
      transcript?: string;
      mimeType?: string;
      language?: string;
      forceArabic?: boolean;
      sessionLang?: string;
      stage?: string;
      endpoint?: 'chat' | 'examiner';
      maneuverId?: string;
      recordingDurationMs?: number;
      speechDurationMs?: number;
    };

    const turnMeta = {
      sessionId: req.params.id,
      userId: req.user!.id,
      endpoint: endpoint === 'examiner' ? ('examiner' as const) : ('chat' as const),
      stage,
      maneuverId,
    };

    let result;
    if (typeof transcriptBody === 'string' && transcriptBody.trim()) {
      result = await processTextTurn({
        ...turnMeta,
        transcript: transcriptBody,
        language,
        forceArabic: forceArabic === undefined ? undefined : !!forceArabic,
        sessionLang,
      });
    } else if (audioBase64 && typeof audioBase64 === 'string') {
      const buffer = Buffer.from(audioBase64, 'base64');
      if (buffer.length > 6 * 1024 * 1024) {
        return res.status(400).json({ error: 'Recording too large' });
      }

      if (isOpenRouterAudioEnabled() && endpoint === 'chat') {
        if (buffer.length < 200 || (Number.isFinite(speechDurationMs) && Number(speechDurationMs) < 250)) {
          throw new Error('recording-too-short');
        }
        const session = await prisma.session.findFirst({
          where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
          include: { case: true, messages: { orderBy: { createdAt: 'asc' } } },
        });
        if (!session) throw new Error('session-not-found');
        let format: string;
        try {
          format = openRouterAudioInputFormat(mimeType);
        } catch {
          console.warn('[openrouter-audio]', {
            stage: 'transcription', status: null,
            model: process.env.OPENROUTER_TRANSCRIPTION_MODEL || 'openai/whisper-large-v3-turbo',
            mimeType, byteSize: buffer.length,
            providerMessage: 'unsupported browser recording MIME',
          });
          throw new Error('openrouter-audio-unsupported-format');
        }
        const transcript = await transcribeOpenRouterAudio({
          audioBase64, format, language, forceArabic: !!forceArabic, mimeType, byteSize: buffer.length,
          recordingDurationMs: Number.isFinite(recordingDurationMs) ? recordingDurationMs : undefined,
          speechDurationMs: Number.isFinite(speechDurationMs) ? speechDurationMs : undefined,
        });
        // Keep the written patient engine authoritative. The audio model is a
        // renderer only and never sees case prose, expected findings, or the
        // student's question as material it could answer from.
        const stageHistory = session.messages
          .filter((message) => message.stage === stage)
          .map((message) => ({ role: message.role, content: message.content }));
        const patientText = await getPatientResponse(
          session.case,
          stageHistory,
          transcript,
          session.language,
          {
            voiceTurn: true,
            userId: session.userId,
            sessionId: session.id,
            stationConfig: getSessionStationConfig(session),
          },
        );
        const audio = await createOpenRouterPatientAudioTurn({
          patientText,
          language: session.language,
          patientGender: session.case.patientGender,
          mimeType,
          byteSize: buffer.length,
        });
        const studentMessage = await prisma.message.create({ data: { sessionId: session.id, role: MessageRole.STUDENT, content: transcript, stage } });
        const replyMessage = await prisma.message.create({ data: { sessionId: session.id, role: MessageRole.PATIENT, content: patientText, stage } });
        result = { transcript, studentMessage, replyMessage, audioBase64: audio.audioBase64, audioFormat: audio.format, latencyMs: audio.latencyMs, firstResponseMs: audio.firstResponseMs };
      } else result = await processVoiceTurn({
        ...turnMeta,
        audioBuffer: buffer,
        mimeType,
        language,
        forceArabic: !!forceArabic,
        sessionLang,
      });
    } else {
      return res.status(400).json({ error: 'No transcript or audio provided' });
    }

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Voice turn failed';
    if (error instanceof OpenRouterAudioError) {
      const isDeterministicClientError =
        error.upstreamStatus !== undefined &&
        error.upstreamStatus >= 400 &&
        error.upstreamStatus < 500 &&
        error.upstreamStatus !== 429 &&
        error.code !== 'openrouter-transcription-network-failed';
      const status = isDeterministicClientError ? 422 : 502;
      const errorText = error.stage === 'transcription'
        ? 'Voice recognition is temporarily unavailable. Please try again.'
        : 'Experimental OpenRouter audio generation failed — please try again';
      return res.status(status).json({ error: errorText, code: error.code, stage: error.stage });
    }
    if (message === 'recording-too-short') {
      return res.status(400).json({
        error: 'Recording too short or quiet',
        code: 'recording-too-short',
      });
    }
    if (message === 'transcription-unavailable') {
      return res.status(503).json({
        error: 'Speech transcription is not configured on the server',
        code: 'transcription-unavailable',
      });
    }
    if (message === 'transcription-auth-failed') {
      return res.status(503).json({
        error: 'The OpenAI API key is missing or invalid',
        code: 'transcription-auth-failed',
      });
    }
    if (message === 'transcription-quota-exceeded') {
      return res.status(503).json({
        error: 'The OpenAI transcription quota is unavailable',
        code: 'transcription-quota-exceeded',
      });
    }
    if (message === 'transcription-not-arabic') {
      return res.status(422).json({
        error: 'Could not recognize speech — try again clearly',
        code: 'transcription-not-arabic',
      });
    }
    if (message === 'transcription-prompt-leak') {
      return res.status(422).json({
        error: 'Could not understand speech — try again',
        code: 'transcription-prompt-leak',
      });
    }
    if (message === 'local-stt-ffmpeg-missing') {
      return res.status(503).json({
        error: 'Local speech recognition needs ffmpeg — install ffmpeg-static or set FFMPEG_PATH',
      });
    }
    if (message === 'session-not-found') {
      return res.status(404).json({ error: 'Active session not found' });
    }
    if (message === 'openrouter-audio-unavailable') {
      return res.status(503).json({ error: 'Experimental OpenRouter audio is not configured', code: message });
    }
    if (message === 'openrouter-transcription-failed') {
      return res.status(502).json({ error: 'Experimental OpenRouter transcription failed — please try again', code: message });
    }
    if (message === 'openrouter-transcription-invalid') {
      return res.status(422).json({ error: 'Could not recognize speech — please try again clearly', code: message });
    }
    if (message === 'openrouter-audio-unsupported-format') {
      return res.status(422).json({ error: 'This browser recording format is not supported by OpenRouter audio', code: message });
    }
    if (message === 'openrouter-audio-failed' || message === 'openrouter-audio-no-output') {
      return res.status(502).json({ error: 'Experimental OpenRouter audio did not return a playable response', code: message });
    }
    console.error('[voice-turn]', error);
    res.status(500).json({ error: 'Voice turn failed' });
  }
});

router.post('/:id/chat', async (req, res) => {
  try {
    const { message, stage = 'history' } = req.body;

    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
      include: { case: true, messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session) return res.status(404).json({ error: 'Active session not found' });

    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.STUDENT,
        content: message,
        stage,
      },
    });

    const stageHistory = session.messages
      .filter((m) => m.stage === stage)
      .map((m) => ({ role: m.role, content: m.content }));

    const stationConfig = getSessionStationConfig(session);
    const patientReply = await getPatientResponse(
      session.case,
      stageHistory,
      message,
      session.language as 'AUTO' | 'AR' | 'EN',
      {
        userId: req.user!.id,
        sessionId: session.id,
        stationConfig,
      },
    );

    const patientMessage = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.PATIENT,
        content: patientReply,
        stage,
      },
    });

    res.json({ message: patientMessage });
  } catch (error) {
    console.error('[chat]', error);
    res.status(500).json({ error: 'Failed to get patient response' });
  }
});

router.post('/:id/examiner-viva/init', async (req, res) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
      include: { case: true, messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) return res.status(404).json({ error: 'Active session not found' });

    const stationConfig = getSessionStationConfig(session);
    if (!stationConfig.enableHistoryExaminer) {
      return res.status(403).json({ error: 'History examiner is disabled for this case' });
    }

    const stage = HISTORY_EXAMINER_STAGE;
    const existing = session.messages.find(
      (m) => m.stage === stage && m.role === MessageRole.EXAMINER,
    );
    if (existing) {
      return res.json({ message: existing });
    }

    const opening = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.EXAMINER,
        content: buildExaminerVivaOpening(session.id, session.case),
        stage,
      },
    });

    res.json({ message: opening });
  } catch (error) {
    console.error('[examiner-viva/init]', error);
    res.status(500).json({ error: 'Failed to start examiner viva' });
  }
});

router.post('/:id/examiner', async (req, res) => {
  try {
    const { message, stage = 'history', maneuverId } = req.body;

  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
    include: { case: true, messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!session) return res.status(404).json({ error: 'Active session not found' });

  const stationConfig = getSessionStationConfig(session);
  const effectiveStage = maneuverId ? maneuverStage(maneuverId) : stage;

  if (!maneuverId && isHistoryExaminerVivaStage(effectiveStage, maneuverId) && !stationConfig.enableHistoryExaminer) {
    return res.status(403).json({ error: 'History examiner is disabled for this case' });
  }
  if (maneuverId && !isManeuverEnabled(stationConfig, maneuverId)) {
    return res.status(400).json({ error: 'Maneuver not enabled for this case' });
  }

  const studentMessage = await prisma.message.create({
    data: {
      sessionId: session.id,
      role: MessageRole.STUDENT,
      content: message,
      stage: effectiveStage,
    },
  });

  // Reload from DB so cumulative viva scoring always sees prior student turns
  // (avoid relying on the pre-insert in-memory session.messages snapshot).
  const stageMessages = await prisma.message.findMany({
    where: { sessionId: session.id, stage: effectiveStage },
    orderBy: { createdAt: 'asc' },
  });
  const examinerHistory = stageMessages.filter(
    (m) => m.role !== MessageRole.PATIENT && m.id !== studentMessage.id,
  );

  const reply = maneuverId
    ? await getManeuverExaminerResponse(
        session.case,
        maneuverId,
        message,
        examinerHistory.map((m) => ({ role: String(m.role), content: m.content })),
        session.language,
        { userId: req.user!.id, sessionId: session.id },
        true,
      )
    : isHistoryExaminerVivaStage(effectiveStage, maneuverId)
      ? await respondToHistoryVivaAnswer(
          session.id,
          session.case,
          session.messages,
          effectiveStage,
          message,
          session.language,
        )
      : await getExaminerVivaResponse(
          session.case,
          message,
          examinerHistory.map((m) => ({ role: m.role, content: m.content })),
          session.language,
          { userId: req.user!.id, sessionId: session.id },
        );

  const examinerMessage = await prisma.message.create({
    data: {
      sessionId: session.id,
      role: MessageRole.EXAMINER,
      content: unwrapExaminerPlainText(reply),
      stage: effectiveStage,
    },
  });

  const maneuverCompletion = maneuverId
    ? getManeuverCompletionState(
        session.case,
        maneuverId,
        stageMessages.filter((m) => m.role === MessageRole.STUDENT).map((m) => m.content),
        examinerMessage.content,
      )
    : undefined;
  res.json({ message: examinerMessage, maneuverCompletion });
  } catch (error) {
    console.error('[examiner]', error);
    res.status(500).json({ error: 'Failed to get examiner response' });
  }
});

router.patch('/:id/stage', async (req, res) => {
  const { stage } = req.body;
  const session = await prisma.session.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { currentStage: stage },
  });

  if (session.count === 0) return res.status(404).json({ error: 'Session not found' });
  res.json({ message: 'Stage updated' });
});

router.post('/:id/complete', async (req, res) => {
  try {
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { case: true, messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!session) return res.status(404).json({ error: 'Session not found' });

  const durationSeconds = Math.floor(
    (Date.now() - new Date(session.startedAt).getTime()) / 1000
  );
  const STATION_DURATION_SECONDS = 20 * 60;
  const timedOut =
    req.body?.timedOut === true || durationSeconds >= STATION_DURATION_SECONDS;

  // If the session was already completed, return the existing result instead of erroring.
  if (session.status === 'COMPLETED') {
    const existingResult = await prisma.result.findUnique({ where: { sessionId: session.id } });
    if (existingResult) {
      const existingRank = existingResult.xpRankSnapshot
        ? (JSON.parse(existingResult.xpRankSnapshot) as Awaited<ReturnType<typeof applySessionXp>>['rankProgress'])
        : getRankProgress(
            (
              await prisma.user.findUnique({
                where: { id: session.userId },
                select: { totalXp: true },
              })
            )?.totalXp ?? 0,
          );
      return res.json({ result: existingResult, rankProgress: existingRank });
    }
  }

  // A finish request (manual or timed out) is always intentional. An empty transcript
  // simply yields a low-participation evaluation rather than a hard error, so students
  // are never trapped on the station screen.
  const sessionMessages = session.messages.map((m) => ({
    role: m.role,
    content: m.content,
    stage: m.stage,
    createdAt: m.createdAt,
  }));

  const evaluationLang = resolveEvaluationLanguage(
    session.language,
    sessionMessages,
    req.body?.language
  );

  let completedManeuvers: string[] = [];
  try {
    completedManeuvers = JSON.parse(session.completedManeuvers || '[]');
  } catch {
    completedManeuvers = [];
  }

  const evaluation = await getExaminerEvaluation(
    session.case,
    sessionMessages,
    evaluationLang,
    { completedManeuvers },
    { userId: req.user!.id, sessionId: session.id },
  );

  await prisma.session.update({
    where: { id: session.id },
    data: { status: 'COMPLETED', completedAt: new Date(), durationSeconds },
  });

  const result = await prisma.result.upsert({
    where: { sessionId: session.id },
    create: {
      sessionId: session.id,
      ...evaluation,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      missedQuestions: evaluation.missedQuestions,
      clinicalErrors: evaluation.clinicalErrors,
      recommendations: evaluation.recommendations,
      idealApproach: evaluation.idealApproach,
      fullReport: evaluation.fullReport,
    },
    update: {
      ...evaluation,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      missedQuestions: evaluation.missedQuestions,
      clinicalErrors: evaluation.clinicalErrors,
      recommendations: evaluation.recommendations,
      idealApproach: evaluation.idealApproach,
      fullReport: evaluation.fullReport,
    },
  });

  let xpPayload: Awaited<ReturnType<typeof applySessionXp>> | null = null;
  if (!result.xpApplied) {
    xpPayload = await applySessionXp(session.userId, session.id, session.caseId, {
      totalScore: evaluation.totalScore,
      communicationScore: evaluation.communicationScore,
      historyTakingScore: evaluation.historyTakingScore,
      clinicalReasonScore: evaluation.clinicalReasonScore,
      organizationScore: evaluation.organizationScore,
      closingScore: evaluation.closingScore,
    });

    await prisma.result.update({
      where: { sessionId: session.id },
      data: {
        xpBreakdown: JSON.stringify(xpPayload.breakdown),
        xpCalculated: xpPayload.calculatedXp,
        xpAwarded: xpPayload.awardedXp,
        xpIsRepeat: xpPayload.isRepeat,
        xpApplied: true,
        xpRankSnapshot: JSON.stringify(xpPayload.rankProgress),
      },
    });
  }

  const finalResult = await prisma.result.findUnique({ where: { sessionId: session.id } });
  const rankProgress =
    xpPayload?.rankProgress ??
    (finalResult?.xpRankSnapshot
      ? (JSON.parse(finalResult.xpRankSnapshot) as Awaited<ReturnType<typeof applySessionXp>>['rankProgress'])
      : getRankProgress(
          (
            await prisma.user.findUnique({
              where: { id: session.userId },
              select: { totalXp: true },
            })
          )?.totalXp ?? 0,
        ));

  res.json({ result: finalResult, rankProgress });
  } catch (error) {
    console.error('[complete]', error);
    res.status(500).json({ error: 'Failed to generate session evaluation' });
  }
});

router.post('/:id/abandon', async (req, res) => {
  await prisma.session.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { status: 'ABANDONED' },
  });
  res.json({ message: 'Session abandoned' });
});

export default router;
