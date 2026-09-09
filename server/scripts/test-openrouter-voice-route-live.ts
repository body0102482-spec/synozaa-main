/**
 * Development-only live integration fixture.
 *
 * It sends actual WebM/Opus Arabic bytes through the same authenticated
 * /voice-turn endpoint used by the browser. The fixture renders repeatable
 * Arabic speech, transcodes it to Chrome's WebM/Opus container, and then lets
 * the production endpoint perform real OpenRouter STT, grounded Patient AI,
 * transcript persistence, and TTS.
 *
 * Start the server first, then run:
 *   npm run test:openrouter-voice-route-live
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role } from '@prisma/client';
import ffmpegPath from 'ffmpeg-static';
import {
  createOpenRouterPatientAudioTurn,
  OPENROUTER_TRANSCRIPTION_MODEL,
  transcribeOpenRouterAudio,
  transcribeOpenRouterAudioWithDiagnostics,
} from '../src/services/openRouterAudioService.js';

const prisma = new PrismaClient();
const baseUrl = process.env.VOICE_ROUTE_URL || `http://127.0.0.1:${process.env.PORT || 5000}`;
const question = 'مالك يا طارق؟';
const secondQuestion = 'النفس بيصحيك من النوم؟';
const sttStressRuns = Math.max(1, Number(process.env.VOICE_STT_STRESS_RUNS || 1));
const routeStressRuns = Math.max(1, Number(process.env.VOICE_ROUTE_STRESS_RUNS || 1));

function transcodeToWebmOpus(input: Buffer): Promise<Buffer> {
  if (!ffmpegPath) return Promise.reject(new Error('ffmpeg-static is unavailable for the WebM fixture.'));
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
      '-c:a', 'libopus', '-b:a', '48k', '-f', 'webm', 'pipe:1',
    ]);
    const output: Buffer[] = [];
    let errorOutput = '';
    process.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    process.stderr.on('data', (chunk: Buffer) => { errorOutput += chunk.toString(); });
    process.on('error', reject);
    process.on('close', (code) => {
      if (code !== 0) reject(new Error(`WebM/Opus fixture transcode failed: ${errorOutput.trim() || code}`));
      else resolve(Buffer.concat(output));
    });
    process.stdin.end(input);
  });
}

async function renderQuestionAsWebm(questionText: string): Promise<Buffer> {
  const rendered = await createOpenRouterPatientAudioTurn({
    patientText: questionText,
    language: 'AR',
    patientGender: 'Male',
  });
  if (rendered.format !== 'mp3' || !rendered.audioBase64) {
    throw new Error('The live input-audio renderer did not produce MP3 bytes.');
  }
  const webm = await transcodeToWebmOpus(Buffer.from(rendered.audioBase64, 'base64'));
  if (webm.length < 200 || webm[0] !== 0x1a || webm[1] !== 0x45 || webm[2] !== 0xdf || webm[3] !== 0xa3) {
    throw new Error('The fixture did not produce a valid non-empty WebM container.');
  }
  return webm;
}

async function main() {
  if (process.env.VOICE_PROVIDER !== 'openrouter_audio') {
    throw new Error('Set VOICE_PROVIDER=openrouter_audio before running this live fixture.');
  }
  if (!process.env.OPENROUTER_API_KEY || !process.env.JWT_SECRET) {
    throw new Error('OPENROUTER_API_KEY and JWT_SECRET are required for this live fixture.');
  }

  const tarek = await prisma.case.findFirst({
    where: { patientName: { contains: 'Tarek' } },
  });
  if (!tarek) throw new Error('The seeded Tarek case was not found.');

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({
    data: {
      email: `voice-route-fixture-${suffix}@example.invalid`,
      passwordHash: 'development-fixture-not-a-login-password',
      firstName: 'Voice',
      lastName: 'Fixture',
      role: Role.STUDENT,
      emailVerified: true,
    },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, caseId: tarek.id, language: 'AR', currentStage: 'history' },
  });

  try {
    const questionWebm = await renderQuestionAsWebm(question);
    const directSttStats = { firstAttemptSuccesses: 0, retrySuccesses: 0, networkFailures: 0, hallucinationRejections: 0, finalFailures: 0 };
    let directTranscript = '';
    for (let run = 0; run < sttStressRuns; run += 1) {
      try {
        const stt = await transcribeOpenRouterAudioWithDiagnostics({
          audioBase64: questionWebm.toString('base64'),
          format: 'webm',
          mimeType: 'audio/webm;codecs=opus',
          byteSize: questionWebm.length,
          language: 'ar-EG',
          forceArabic: true,
          recordingDurationMs: 1_400,
          speechDurationMs: 1_050,
        });
        directTranscript ||= stt.transcript;
        if (stt.attempts === 1) directSttStats.firstAttemptSuccesses += 1;
        else directSttStats.retrySuccesses += 1;
        directSttStats.hallucinationRejections += stt.hallucinationRetries;
      } catch (error) {
        directSttStats.finalFailures += 1;
        if (error instanceof Error && error.message === 'openrouter-transcription-network-failed') directSttStats.networkFailures += 1;
        if (error instanceof Error && error.message === 'openrouter-transcription-hallucination') directSttStats.hallucinationRejections += 1;
      }
    }
    if (directSttStats.finalFailures > 0) {
      throw new Error(`WebM STT stress run had ${directSttStats.finalFailures} final failures.`);
    }
    if (!/مالك/.test(directTranscript)) {
      throw new Error(`Unexpected WebM Arabic transcript: ${directTranscript}`);
    }
    const secondWebm = await renderQuestionAsWebm(secondQuestion);
    const secondTranscript = await transcribeOpenRouterAudio({
      audioBase64: secondWebm.toString('base64'),
      format: 'webm',
      mimeType: 'audio/webm;codecs=opus',
      byteSize: secondWebm.length,
      language: 'ar-EG',
      forceArabic: true,
      recordingDurationMs: 1_400,
      speechDurationMs: 1_050,
    });
    if (!/النفس|بيصح|النوم/.test(secondTranscript)) {
      throw new Error(`Unexpected second WebM Arabic transcript: ${secondTranscript}`);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: Role.STUDENT },
      process.env.JWT_SECRET,
      { expiresIn: '5m' },
    );
    type VoiceRoutePayload = {
      transcript?: string;
      replyMessage?: { content?: string };
      audioBase64?: string;
      audioFormat?: string;
    };
    const routeTurns: Array<{ label: 'complaint' | 'pnd'; audio: Buffer; expectedTranscript: RegExp; expectedReply: RegExp }> = [
      {
        label: 'complaint',
        audio: questionWebm,
        expectedTranscript: /مالك/,
        expectedReply: /ضيق\s*(?:في\s*)?(?:ال)?نفس/,
      },
      {
        label: 'pnd',
        audio: secondWebm,
        expectedTranscript: /النفس|بيصح|النوم/,
        expectedReply: /بصحى|مخنوق|النوم/,
      },
    ];
    const completedTurns: Array<{ label: string; transcript: string; groundedReply: string; audioBytes: number; latencyMs: number }> = [];
    const routeLatencies: number[] = [];
    for (let run = 0; run < routeStressRuns; run += 1) {
      const turn = routeTurns[run % routeTurns.length];
      const startedAt = Date.now();
      const response = await fetch(`${baseUrl}/api/sessions/${session.id}/voice-turn`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioBase64: turn.audio.toString('base64'),
          mimeType: 'audio/webm;codecs=opus',
          language: 'ar-EG',
          forceArabic: true,
          stage: 'history',
          endpoint: 'chat',
          recordingDurationMs: 1_400,
          speechDurationMs: 1_050,
        }),
      });
      const payload = await response.json() as VoiceRoutePayload;
      if (!response.ok) {
        throw new Error(`Voice route returned ${response.status}: ${String(payload?.['error'] || 'unknown error')}`);
      }
      const audioBytes = Buffer.from(payload.audioBase64 || '', 'base64');
      if (!payload.transcript?.trim() || !payload.replyMessage?.content?.trim() || payload.audioFormat !== 'mp3' || audioBytes.length < 4) {
        throw new Error('Voice route response was missing a transcript, grounded reply, or playable MP3.');
      }
      if (audioBytes[0] !== 0xff || (audioBytes[1] !== 0xfb && audioBytes[1] !== 0xf3 && audioBytes[1] !== 0xf2)) {
        throw new Error('Voice route returned audio that does not have an MP3 frame signature.');
      }
      if (!turn.expectedTranscript.test(payload.transcript) || !turn.expectedReply.test(payload.replyMessage.content)) {
        throw new Error(`Voice route did not preserve the grounded ${turn.label} turn: ${payload.transcript} -> ${payload.replyMessage.content}`);
      }
      routeLatencies.push(Date.now() - startedAt);
      completedTurns.push({
        label: turn.label,
        transcript: payload.transcript,
        groundedReply: payload.replyMessage.content,
        audioBytes: audioBytes.length,
        latencyMs: routeLatencies.at(-1)!,
      });
    }

    console.log('[voice-route-live] PASS', {
      transcriptionModel: process.env.OPENROUTER_TRANSCRIPTION_MODEL || OPENROUTER_TRANSCRIPTION_MODEL,
      inputFormat: 'webm',
      inputAudioBytes: questionWebm.length,
      sttStress: { runs: sttStressRuns, ...directSttStats },
      directTranscript,
      secondDirectTranscript: secondTranscript,
      consecutiveTurns: completedTurns,
      routeStress: {
        runs: routeStressRuns,
        successes: routeLatencies.length,
        latencyMs: routeLatencies,
      },
    });
  } finally {
    // Messages cascade from the fixture session; no persistent demo data is left behind.
    await prisma.session.delete({ where: { id: session.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[voice-route-live] FAIL', error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
