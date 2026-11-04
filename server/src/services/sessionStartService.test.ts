import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Prisma } from '@prisma/client';
import {
  createFreeCaseSession,
  createPaidCaseSession,
  getSessionCreditCost,
  normalizeSessionType,
  SessionStartError,
  type SessionStartTransactionRunner,
} from './subscriptionService.js';

type TestSession = {
  id: string;
  userId: string;
  caseId: string;
  sessionType: 'CHAT' | 'LIVE_VOICE';
  creditCost: number;
  idempotencyKey: string | null;
  startedAt: Date;
  messages: unknown[];
  case: { isFreeTier: boolean };
};

type TestState = {
  sessions: TestSession[];
  freeCasesUsed: number;
  freeUsageMonth: string | null;
  casesQuotaOverride: number | null;
  subscription: {
    userId: string;
    status: 'ACTIVE';
    plan: 'PACKAGE_50';
    casesQuota: number;
    startDate: Date;
  } | null;
  caseAttempts: Record<string, number>;
  nextSessionId: number;
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function createTestState(options?: { paidQuota?: number; freeQuotaOverride?: number }) : TestState {
  return {
    sessions: [],
    freeCasesUsed: 0,
    freeUsageMonth: currentMonth(),
    casesQuotaOverride: options?.freeQuotaOverride ?? null,
    subscription: options?.paidQuota === undefined
      ? null
      : {
          userId: 'user-1',
          status: 'ACTIVE',
          plan: 'PACKAGE_50',
          casesQuota: options.paidQuota,
          startDate: new Date(0),
        },
    caseAttempts: {},
    nextSessionId: 1,
  };
}

function createFakeTransaction(state: TestState): Prisma.TransactionClient {
  const fake = {
    session: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        state.sessions.find(
          (session) =>
            session.userId === where.userId &&
            session.idempotencyKey === where.idempotencyKey,
        ) ?? null,
      aggregate: async ({ where }: { where: Record<string, unknown> }) => {
        const startedAt = where.startedAt as { gte?: Date } | undefined;
        const total = state.sessions
          .filter(
            (session) =>
              session.userId === where.userId &&
              (!startedAt?.gte || session.startedAt >= startedAt.gte),
          )
          .reduce((sum, session) => sum + session.creditCost, 0);
        return { _sum: { creditCost: total || null } };
      },
      count: async () => state.sessions.filter((session) => session.case.isFreeTier).length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const session: TestSession = {
          id: `session-${state.nextSessionId++}`,
          userId: String(data.userId),
          caseId: String(data.caseId),
          sessionType: data.sessionType as TestSession['sessionType'],
          creditCost: Number(data.creditCost),
          idempotencyKey: String(data.idempotencyKey),
          startedAt: new Date(),
          messages: [],
          case: { isFreeTier: true },
        };
        state.sessions.push(session);
        return session;
      },
    },
    subscription: {
      findFirst: async () => state.subscription,
    },
    user: {
      findUnique: async () => ({
        casesQuotaOverride: state.casesQuotaOverride,
        freeCasesUsed: state.freeCasesUsed,
        freeUsageMonth: state.freeUsageMonth,
      }),
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (
          'freeUsageMonth' in where &&
          where.freeUsageMonth !== state.freeUsageMonth
        ) {
          return { count: 0 };
        }
        const lessThan = (where.freeCasesUsed as { lt?: number } | undefined)?.lt;
        if (lessThan !== undefined && state.freeCasesUsed >= lessThan) return { count: 0 };

        const nextUsed = data.freeCasesUsed as number | { increment: number } | undefined;
        if (typeof nextUsed === 'number') state.freeCasesUsed = nextUsed;
        else if (nextUsed && 'increment' in nextUsed) {
          state.freeCasesUsed += nextUsed.increment;
        }
        if (typeof data.freeUsageMonth === 'string') {
          state.freeUsageMonth = data.freeUsageMonth;
        }
        return { count: 1 };
      },
    },
    caseAccess: {
      upsert: async ({
        where,
        create,
      }: {
        where: { userId_caseId: { userId: string; caseId: string } };
        create: { attempts: number };
      }) => {
        const key = `${where.userId_caseId.userId}:${where.userId_caseId.caseId}`;
        state.caseAttempts[key] = (state.caseAttempts[key] ?? 0) + create.attempts;
        return { attempts: state.caseAttempts[key] };
      },
    },
  };
  return fake as unknown as Prisma.TransactionClient;
}

function createSerializedRunner(state: TestState): SessionStartTransactionRunner {
  let queue = Promise.resolve();
  return async <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) => {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const snapshot = structuredClone(state) as TestState;
    try {
      return await operation(createFakeTransaction(state));
    } catch (error) {
      Object.assign(state, snapshot);
      throw error;
    } finally {
      release();
    }
  };
}

const sessionArgs = {
  userId: 'user-1',
  caseId: 'case-1',
  language: 'AR' as const,
  resolvedStationConfig: '{}',
};

test('CHAT records exactly one credit of paid usage', async () => {
  const state = createTestState({ paidQuota: 5 });
  const session = await createPaidCaseSession(
    sessionArgs.userId,
    sessionArgs.caseId,
    sessionArgs.language,
    sessionArgs.resolvedStationConfig,
    normalizeSessionType(undefined),
    'chat-1',
    createSerializedRunner(state),
  );

  assert.equal(getSessionCreditCost('CHAT'), 1);
  assert.equal(session.creditCost, 1);
  assert.equal(state.sessions.reduce((sum, item) => sum + item.creditCost, 0), 1);
});

test('LIVE_VOICE records exactly three credits of paid usage', async () => {
  const state = createTestState({ paidQuota: 5 });
  const session = await createPaidCaseSession(
    sessionArgs.userId,
    sessionArgs.caseId,
    sessionArgs.language,
    sessionArgs.resolvedStationConfig,
    'LIVE_VOICE',
    'voice-1',
    createSerializedRunner(state),
  );

  assert.equal(getSessionCreditCost('LIVE_VOICE'), 3);
  assert.equal(session.creditCost, 3);
});

test('insufficient paid balance rejects without creating a session', async () => {
  const state = createTestState({ paidQuota: 2 });
  await assert.rejects(
    createPaidCaseSession(
      sessionArgs.userId,
      sessionArgs.caseId,
      sessionArgs.language,
      sessionArgs.resolvedStationConfig,
      'LIVE_VOICE',
      'voice-too-expensive',
      createSerializedRunner(state),
    ),
    (error: unknown) =>
      error instanceof SessionStartError &&
      error.code === 'INSUFFICIENT_CREDITS' &&
      error.details?.required === 3 &&
      error.details.available === 2,
  );
  assert.equal(state.sessions.length, 0);
});

test('invalid session type is rejected and omitted sessionType defaults to CHAT', () => {
  assert.equal(normalizeSessionType(undefined), 'CHAT');
  assert.equal(normalizeSessionType('live_voice'), 'LIVE_VOICE');
  assert.throws(
    () => normalizeSessionType('UNKNOWN'),
    (error: unknown) =>
      error instanceof SessionStartError && error.code === 'INVALID_SESSION_TYPE',
  );
});

test('duplicate idempotency key returns the existing session without charging twice', async () => {
  const state = createTestState({ paidQuota: 3 });
  const runner = createSerializedRunner(state);
  const first = await createPaidCaseSession(
    sessionArgs.userId,
    sessionArgs.caseId,
    sessionArgs.language,
    sessionArgs.resolvedStationConfig,
    'LIVE_VOICE',
    'same-start',
    runner,
  );
  const retry = await createPaidCaseSession(
    sessionArgs.userId,
    sessionArgs.caseId,
    sessionArgs.language,
    sessionArgs.resolvedStationConfig,
    'LIVE_VOICE',
    'same-start',
    runner,
  );

  assert.equal(retry.id, first.id);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].creditCost, 3);
});

test('concurrent paid starts cannot overspend the subscription quota', async () => {
  const state = createTestState({ paidQuota: 3 });
  const runner = createSerializedRunner(state);
  const starts = await Promise.allSettled([
    createPaidCaseSession(
      sessionArgs.userId,
      sessionArgs.caseId,
      sessionArgs.language,
      sessionArgs.resolvedStationConfig,
      'LIVE_VOICE',
      'concurrent-1',
      runner,
    ),
    createPaidCaseSession(
      sessionArgs.userId,
      sessionArgs.caseId,
      sessionArgs.language,
      sessionArgs.resolvedStationConfig,
      'LIVE_VOICE',
      'concurrent-2',
      runner,
    ),
  ]);

  assert.equal(starts.filter((start) => start.status === 'fulfilled').length, 1);
  assert.equal(starts.filter((start) => start.status === 'rejected').length, 1);
  assert.equal(state.sessions.reduce((sum, item) => sum + item.creditCost, 0), 3);
});

test('free sessions still consume one monthly attempt irrespective of session type', async () => {
  const state = createTestState({ freeQuotaOverride: 2 });
  const runner = createSerializedRunner(state);
  for (const [index, key] of ['free-1', 'free-2'].entries()) {
    const session = await createFreeCaseSession(
      sessionArgs.userId,
      sessionArgs.caseId,
      sessionArgs.language,
      sessionArgs.resolvedStationConfig,
      index === 0 ? 'LIVE_VOICE' : 'CHAT',
      key,
      runner,
    );
    assert.ok(session);
  }
  const exhausted = await createFreeCaseSession(
    sessionArgs.userId,
    sessionArgs.caseId,
    sessionArgs.language,
    sessionArgs.resolvedStationConfig,
    'CHAT',
    'free-3',
    runner,
  );

  assert.equal(exhausted, null);
  assert.equal(state.freeCasesUsed, 2);
  assert.equal(state.sessions.length, 2);
});

test('paid plan quota cannot be consumed twice by an idempotent retry', async () => {
  const state = createTestState({ paidQuota: 1 });
  const runner = createSerializedRunner(state);
  const first = await createPaidCaseSession(
    sessionArgs.userId,
    sessionArgs.caseId,
    sessionArgs.language,
    sessionArgs.resolvedStationConfig,
    normalizeSessionType(undefined),
    'legacy-chat',
    runner,
  );
  const retry = await createPaidCaseSession(
    sessionArgs.userId,
    sessionArgs.caseId,
    sessionArgs.language,
    sessionArgs.resolvedStationConfig,
    normalizeSessionType(undefined),
    'legacy-chat',
    runner,
  );

  assert.equal(first.id, retry.id);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].creditCost, 1);
});
