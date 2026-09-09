import { getMicConstraints } from './mobileAudio';

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

let activeRecognition: SpeechRecognitionLike | null = null;
let sharedMicStream: MediaStream | null = null;
let sharedMicRefCount = 0;
let lastRecognitionEndedAt = 0;

export function isSpeechRecognitionActive(): boolean {
  return activeRecognition !== null;
}

export function markRecognitionEnded() {
  lastRecognitionEndedAt = Date.now();
}

export function recognitionCooldownMs(): number {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIos) return 700;
  if (isMobile) return 450;
  return 150;
}

export async function waitForRecognitionCooldown(): Promise<void> {
  const elapsed = Date.now() - lastRecognitionEndedAt;
  const wait = recognitionCooldownMs() - elapsed;
  if (wait > 0) {
    await waitForSpeechRecognition(wait);
  }
}

export function abortActiveSpeechRecognition() {
  const current = activeRecognition;
  activeRecognition = null;
  if (!current) return;
  try {
    current.abort();
  } catch {
    // Browser may already be idle.
  }
}

export function claimSpeechRecognition(recognition: SpeechRecognitionLike) {
  if (activeRecognition && activeRecognition !== recognition) {
    try {
      activeRecognition.abort();
    } catch {
      // ignore
    }
  }
  activeRecognition = recognition;
}

export function releaseSpeechRecognition(recognition: SpeechRecognitionLike) {
  if (activeRecognition === recognition) {
    activeRecognition = null;
  }
}

export function waitForSpeechRecognition(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Keep the mic stream open while listening — stopping tracks too early breaks recognition on many devices. */
export async function acquireMicrophoneStream(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (sharedMicStream?.active) {
    sharedMicRefCount += 1;
    return 'granted';
  }
  if (!navigator.mediaDevices?.getUserMedia) return 'unavailable';

  try {
    sharedMicStream = await navigator.mediaDevices.getUserMedia({
      audio: getMicConstraints(),
    });
    sharedMicRefCount = 1;
    return 'granted';
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
    return 'unavailable';
  }
}

/**
 * Release the shared mic stream.
 * - Skips release while Web Speech recognition is active (unless force).
 * - Uses ref-counting so concurrent owners (browser STT + live call handoff) don't yank the mic.
 */
export function releaseMicrophoneStream(force = false) {
  if (!force && activeRecognition) return;

  if (!force && sharedMicRefCount > 1) {
    sharedMicRefCount -= 1;
    return;
  }

  sharedMicRefCount = 0;
  sharedMicStream?.getTracks().forEach((track) => track.stop());
  sharedMicStream = null;
}

/** @deprecated Use acquireMicrophoneStream — kept for compatibility */
export async function ensureMicrophonePermission(): Promise<'granted' | 'denied' | 'unavailable'> {
  return acquireMicrophoneStream();
}

export function isIgnorableSpeechError(code: string) {
  return code === 'aborted' || code === 'no-speech';
}

/** Rebuild display text from all finals + latest interim in this event. */
export function eventDisplayTranscript(event: SpeechRecognitionEventLike): string {
  let finals = '';
  for (let i = 0; i < event.results.length; i++) {
    if (event.results[i]?.isFinal) {
      finals += event.results[i]?.[0]?.transcript ?? '';
    }
  }

  let interim = '';
  for (let i = event.results.length - 1; i >= 0; i--) {
    const part = event.results[i];
    if (part && !part.isFinal) {
      interim = part[0]?.transcript ?? '';
      break;
    }
  }

  const finalsTrim = finals.trim();
  const interimTrim = interim.trim();
  if (!finalsTrim) return interimTrim;
  if (!interimTrim) return finalsTrim;
  if (interimTrim.startsWith(finalsTrim) || interimTrim.includes(finalsTrim)) return interimTrim;
  return `${finalsTrim} ${interimTrim}`.replace(/\s+/g, ' ').trim();
}

/** Rebuild display text without duplicating mobile cumulative results. */
export function transcriptFromEvent(event: SpeechRecognitionEventLike): string {
  return eventDisplayTranscript(event);
}

/** Accumulate finals across events (correct pattern for continuous recognition). */
export function appendFinalTranscriptFromEvent(
  committed: string,
  event: SpeechRecognitionEventLike,
): string {
  let next = committed;
  for (let i = event.resultIndex; i < event.results.length; i++) {
    if (event.results[i]?.isFinal) {
      const piece = (event.results[i]?.[0]?.transcript ?? '').trim();
      if (!piece) continue;
      next = next ? `${next} ${piece}`.replace(/\s+/g, ' ').trim() : piece;
    }
  }
  return next;
}

/** Interim line from the latest non-final result only. */
export function interimTranscriptFromEvent(event: SpeechRecognitionEventLike): string {
  for (let i = event.results.length - 1; i >= event.resultIndex; i--) {
    const part = event.results[i];
    if (part && !part.isFinal) {
      return (part[0]?.transcript ?? '').trim();
    }
  }
  return '';
}

/** Collapse only obvious STT repetition (same chunk repeated 3+ times), not real speech. */
export function collapseCumulativeStt(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length < 30) return normalized;

  const repeatedChunk = normalized.match(/^(.{10,}?)(?:\s*\1){2,}$/u);
  if (repeatedChunk?.[1]) return repeatedChunk[1].trim();

  return collapseSttRepetition(normalized);
}

/** Mobile Arabic STT often loops short phrases ("طيب طيب هل …"). */
export function collapseSttRepetition(text: string): string {
  let normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length < 16) return normalized;

  const repeatedChunk = normalized.match(/^(.{6,}?)(?:\s+\1){2,}$/u);
  if (repeatedChunk?.[1]) return repeatedChunk[1].trim();

  const words = normalized.split(' ');
  if (words.length < 8) return normalized;

  for (let size = 1; size <= 3; size++) {
    const counts = new Map<string, number>();
    for (let i = 0; i <= words.length - size; i++) {
      const phrase = words.slice(i, i + size).join(' ');
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }

    let hotPhrase = '';
    let hotCount = 0;
    for (const [phrase, count] of counts) {
      if (count > hotCount && phrase.length >= 2) {
        hotCount = count;
        hotPhrase = phrase;
      }
    }

    if (hotCount >= 4 && hotPhrase) {
      const escaped = hotPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      normalized = normalized.replace(new RegExp(`(?:${escaped}\\s+){2,}`, 'gu'), `${hotPhrase} `);
      normalized = normalized.replace(/\s+/g, ' ').trim();
    }
  }

  return normalized;
}

/** On mobile, engines often put the full cumulative line in the longest result. */
export function longestTranscriptFromEvent(event: SpeechRecognitionEventLike): string {
  let best = '';
  for (let i = 0; i < event.results.length; i++) {
    const piece = (event.results[i]?.[0]?.transcript ?? '').trim();
    if (piece.length > best.length) best = piece;
  }
  return best;
}

export function buildSessionTranscript(
  sessionCommitted: string,
  eventOrInterim: SpeechRecognitionEventLike | string,
): string {
  const session = sessionCommitted.trim();
  const eventText =
    typeof eventOrInterim === 'string'
      ? eventOrInterim.trim()
      : eventDisplayTranscript(eventOrInterim);

  if (!session) return collapseCumulativeStt(eventText);
  if (!eventText) return collapseCumulativeStt(session);

  if (eventText.startsWith(session) || eventText.includes(session)) {
    return collapseCumulativeStt(eventText.length >= session.length ? eventText : session);
  }
  if (session.endsWith(eventText)) return collapseCumulativeStt(session);

  return collapseCumulativeStt(`${session} ${eventText}`.replace(/\s+/g, ' ').trim());
}

/** Only the finalized segment(s) from this event — avoids duplicate/interim churn on mobile. */
export function finalTranscriptFromEvent(event: SpeechRecognitionEventLike): string {
  let text = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    if (event.results[i]?.isFinal) {
      text += event.results[i]?.[0]?.transcript ?? '';
    }
  }
  return text.trim();
}
