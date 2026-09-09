export const ENTITLEMENTS_CHANGED_EVENT = 'synoza:entitlements-changed';

export type EntitlementsSnapshot = {
  plan: string;
  isFree: boolean;
  casesQuota: number;
  casesUnlocked: number;
  casesRemaining: number;
  freeAttemptsPerCase?: number;
  attemptsByCase?: Record<string, number>;
  planEndDate?: string | null;
  planStartDate?: string | null;
  totalXp?: number;
  universityRank?: {
    rank: number;
    cohortSize: number;
    higherCount: number;
    topPercent: number;
  } | null;
};

export function dispatchEntitlementsChanged(entitlements?: EntitlementsSnapshot | null) {
  window.dispatchEvent(
    new CustomEvent(ENTITLEMENTS_CHANGED_EVENT, { detail: entitlements ?? null }),
  );
}

export function readEntitlementsFromEvent(event: Event): EntitlementsSnapshot | null | undefined {
  return (event as CustomEvent<EntitlementsSnapshot | null>).detail;
}
