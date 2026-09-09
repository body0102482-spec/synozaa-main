import { prisma } from '../lib/prisma.js';

export type AiUsageFeature =
  | 'patient_chat'
  | 'examiner_viva'
  | 'evaluation'
  | 'stt'
  | 'tts'
  | 'realtime';

export type AiUsageMeta = {
  feature: AiUsageFeature;
  userId?: string | null;
  sessionId?: string | null;
};

export type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

const DEFAULT_RATES: Record<string, { inputPer1MUsd: number; outputPer1MUsd: number }> = {
  'qwen/qwen3.7-flash': { inputPer1MUsd: 0.1, outputPer1MUsd: 0.3 },
  'google/gemini-2.5-flash': { inputPer1MUsd: 0.075, outputPer1MUsd: 0.3 },
  'gpt-4o-mini': { inputPer1MUsd: 0.15, outputPer1MUsd: 0.6 },
  'gpt-4o': { inputPer1MUsd: 2.5, outputPer1MUsd: 10 },
  'gpt-5-mini': { inputPer1MUsd: 0.25, outputPer1MUsd: 2 },
  'gpt-realtime-mini': { inputPer1MUsd: 10, outputPer1MUsd: 20 },
  default: { inputPer1MUsd: 0.2, outputPer1MUsd: 0.5 },
};

let ratesCache: { map: Record<string, { inputPer1MUsd: number; outputPer1MUsd: number }>; expiresAt: number } | null =
  null;

export async function ensureDefaultCostRates() {
  const existing = await prisma.aiCostRate.count();
  if (existing > 0) return;
  await prisma.aiCostRate.createMany({
    data: Object.entries(DEFAULT_RATES)
      .filter(([model]) => model !== 'default')
      .map(([model, rates]) => ({
        model,
        inputPer1MUsd: rates.inputPer1MUsd,
        outputPer1MUsd: rates.outputPer1MUsd,
      })),
  });
}

export async function getCostRatesMap(): Promise<Record<string, { inputPer1MUsd: number; outputPer1MUsd: number }>> {
  const now = Date.now();
  if (ratesCache && ratesCache.expiresAt > now) return ratesCache.map;

  await ensureDefaultCostRates();
  const rows = await prisma.aiCostRate.findMany();
  const map: Record<string, { inputPer1MUsd: number; outputPer1MUsd: number }> = { ...DEFAULT_RATES };
  for (const row of rows) {
    map[row.model] = { inputPer1MUsd: row.inputPer1MUsd, outputPer1MUsd: row.outputPer1MUsd };
  }
  ratesCache = { map, expiresAt: now + 60_000 };
  return map;
}

export function clearCostRatesCache() {
  ratesCache = null;
}

export async function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): Promise<number> {
  const rates = await getCostRatesMap();
  const rate = rates[model] || rates.default || DEFAULT_RATES.default;
  return (promptTokens / 1_000_000) * rate.inputPer1MUsd + (completionTokens / 1_000_000) * rate.outputPer1MUsd;
}

export async function logAiUsage(params: {
  feature: AiUsageFeature;
  model: string;
  usage?: TokenUsage | null;
  userId?: string | null;
  sessionId?: string | null;
  success?: boolean;
  error?: string | null;
}) {
  try {
    const promptTokens = params.usage?.prompt_tokens ?? 0;
    const completionTokens = params.usage?.completion_tokens ?? 0;
    const totalTokens = params.usage?.total_tokens ?? promptTokens + completionTokens;
    const estimatedCostUsd = await estimateCostUsd(params.model, promptTokens, completionTokens);

    await prisma.aiUsageLog.create({
      data: {
        feature: params.feature,
        model: params.model,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
        userId: params.userId || null,
        sessionId: params.sessionId || null,
        success: params.success !== false,
        error: params.error || null,
      },
    });
  } catch (err) {
    console.warn('[AI usage] failed to log:', err instanceof Error ? err.message : err);
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getAiUsageSummary(from: Date, to: Date) {
  const logs = await prisma.aiUsageLog.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: {
      createdAt: true,
      feature: true,
      model: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      estimatedCostUsd: true,
      success: true,
    },
  });

  const todayStart = startOfDay(new Date());
  let tokensToday = 0;
  let costToday = 0;
  let totalTokens = 0;
  let totalCost = 0;
  let successCount = 0;
  let failCount = 0;

  const byFeature: Record<string, { calls: number; tokens: number; costUsd: number }> = {};
  const byModel: Record<string, { calls: number; tokens: number; costUsd: number }> = {};
  const dailyMap: Record<string, { date: string; calls: number; tokens: number; costUsd: number }> = {};

  for (const log of logs) {
    totalTokens += log.totalTokens;
    totalCost += log.estimatedCostUsd;
    if (log.success) successCount += 1;
    else failCount += 1;

    if (log.createdAt >= todayStart) {
      tokensToday += log.totalTokens;
      costToday += log.estimatedCostUsd;
    }

    const feat = byFeature[log.feature] || { calls: 0, tokens: 0, costUsd: 0 };
    feat.calls += 1;
    feat.tokens += log.totalTokens;
    feat.costUsd += log.estimatedCostUsd;
    byFeature[log.feature] = feat;

    const mod = byModel[log.model] || { calls: 0, tokens: 0, costUsd: 0 };
    mod.calls += 1;
    mod.tokens += log.totalTokens;
    mod.costUsd += log.estimatedCostUsd;
    byModel[log.model] = mod;

    const key = dayKey(log.createdAt);
    const day = dailyMap[key] || { date: key, calls: 0, tokens: 0, costUsd: 0 };
    day.calls += 1;
    day.tokens += log.totalTokens;
    day.costUsd += log.estimatedCostUsd;
    dailyMap[key] = day;
  }

  return {
    summary: {
      calls: logs.length,
      successCount,
      failCount,
      totalTokens,
      estimatedCostUsd: totalCost,
      tokensToday,
      costTodayUsd: costToday,
    },
    byFeature: Object.entries(byFeature).map(([feature, v]) => ({ feature, ...v })),
    byModel: Object.entries(byModel).map(([model, v]) => ({ model, ...v })),
    daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
