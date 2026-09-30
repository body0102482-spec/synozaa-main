import type { TFunction } from 'i18next';

export type PendingCaseStart =
  | { type: 'random'; categoryIds?: string[] }
  | { type: 'station'; caseId: string };

interface EntitlementsLike {
  isFree: boolean;
  freeAttemptsRemaining: number;
  casesRemaining: number;
  attemptsByCase: Record<string, number>;
}

export function shouldConfirmCaseStart(
  entitlements: EntitlementsLike | null | undefined,
  pending: PendingCaseStart,
): boolean {
  if (!entitlements) return true;
  if (entitlements.isFree) {
    return entitlements.freeAttemptsRemaining > 0;
  }
  return true;
}

export function startCaseConfirmMessage(
  t: TFunction,
  entitlements: EntitlementsLike | null | undefined,
  pending: PendingCaseStart | null,
): string {
  if (!entitlements || !pending) return '';

  if (entitlements.isFree) {
    return t('startCaseConfirmFreeMessage', { count: entitlements.freeAttemptsRemaining });
  }

  const remaining = entitlements.casesRemaining;
  if (pending.type === 'random') {
    return t('startCaseConfirmRandomMessage', { count: remaining });
  }
  return t('startCaseConfirmNewCaseMessage', { count: remaining });
}
