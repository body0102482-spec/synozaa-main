import api from './api';
import { getStoredUser } from './authStorage';

export type SessionType = 'CHAT' | 'LIVE_VOICE';

const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000;

function getIdempotencyScope(
  userId: string,
  caseId: string,
  language: string,
  sessionType: SessionType,
) {
  return [
    'synoza-session-start',
    encodeURIComponent(userId),
    encodeURIComponent(caseId),
    encodeURIComponent(language),
    sessionType,
  ].join(':');
}

function getOrCreateIdempotencyKey(scope: string) {
  const stored = localStorage.getItem(scope);
  if (stored) {
    const separator = stored.indexOf(':');
    const createdAt = Number(stored.slice(0, separator));
    const key = stored.slice(separator + 1);
    if (
      separator > 0 &&
      Number.isFinite(createdAt) &&
      Date.now() - createdAt < IDEMPOTENCY_KEY_TTL_MS &&
      key
    ) {
      return { key, storedValue: stored };
    }
    localStorage.removeItem(scope);
  }

  const key = crypto.randomUUID();
  const storedValue = `${Date.now()}:${key}`;
  localStorage.setItem(scope, storedValue);
  return { key, storedValue };
}

export async function startSession(
  caseId: string,
  language = 'AR',
  sessionType: SessionType = 'CHAT',
) {
  const userId = getStoredUser()?.id;
  if (!userId) throw new Error('Authenticated user is required to start a session');

  const scope = getIdempotencyScope(userId, caseId, language, sessionType);
  const { key, storedValue } = getOrCreateIdempotencyKey(scope);
  const response = await api.post(
    '/sessions/start',
    { caseId, language, sessionType },
    { headers: { 'Idempotency-Key': key } },
  );
  if (localStorage.getItem(scope) === storedValue) localStorage.removeItem(scope);
  return response;
}
