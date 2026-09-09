import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Cpu, Save } from 'lucide-react';
import api from '../../lib/api';

type UsageSummary = {
  calls: number;
  successCount: number;
  failCount: number;
  totalTokens: number;
  estimatedCostUsd: number;
  tokensToday: number;
  costTodayUsd: number;
};

type SeriesPoint = { date: string; calls: number; tokens: number; costUsd: number };
type Breakdown = { feature?: string; model?: string; calls: number; tokens: number; costUsd: number };
type RateRow = { model: string; inputPer1MUsd: number; outputPer1MUsd: number };

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function AdminApiUsageTab() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [daily, setDaily] = useState<SeriesPoint[]>([]);
  const [byFeature, setByFeature] = useState<Breakdown[]>([]);
  const [byModel, setByModel] = useState<Breakdown[]>([]);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [savingRates, setSavingRates] = useState(false);
  const [ratesSaved, setRatesSaved] = useState(false);

  const load = async () => {
    const [usageRes, ratesRes] = await Promise.all([
      api.get('/admin/ai-usage', { params: { from, to } }),
      api.get('/admin/ai-usage/rates'),
    ]);
    setSummary(usageRes.data.summary);
    setDaily(usageRes.data.daily || []);
    setByFeature(usageRes.data.byFeature || []);
    setByModel(usageRes.data.byModel || []);
    setRates(ratesRes.data.rates || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const maxTokens = Math.max(1, ...daily.map((d) => d.tokens));

  const saveRates = async () => {
    setSavingRates(true);
    try {
      const r = await api.put('/admin/ai-usage/rates', { rates });
      setRates(r.data.rates || []);
      setRatesSaved(true);
      setTimeout(() => setRatesSaved(false), 2000);
      await load();
    } finally {
      setSavingRates(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t('adminDateFrom')}</label>
          <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t('adminDateTo')}</label>
          <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="button" className="btn-primary" onClick={() => void load()}>
          {t('adminApplyFilters')}
        </button>
      </div>

      {summary && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: t('adminApiCalls'), value: summary.calls, icon: Cpu },
            { label: t('adminTokensToday'), value: summary.tokensToday.toLocaleString(), icon: Cpu },
            { label: t('adminTotalTokens'), value: summary.totalTokens.toLocaleString(), icon: Cpu },
            {
              label: t('adminEstimatedCost'),
              value: `$${summary.estimatedCostUsd.toFixed(4)}`,
              icon: DollarSign,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="stat-card">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
                  <Icon className="text-violet-600" size={20} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card p-6">
        <h3 className="font-semibold mb-4">{t('adminDailyUsage')}</h3>
        {daily.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">{t('adminNoUsageYet')}</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {daily.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div
                  className="w-full rounded-t bg-violet-500/80 hover:bg-violet-600 transition-colors"
                  style={{ height: `${Math.max(4, (d.tokens / maxTokens) * 100)}%` }}
                  title={`${d.date}: ${d.tokens} tokens, $${d.costUsd.toFixed(4)}`}
                />
                <span className="text-[9px] text-slate-400 truncate w-full text-center">
                  {d.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold">{t('adminByFeature')}</h3>
          </div>
          <div className="table-scroll">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>{t('adminFeature')}</th>
                  <th>{t('adminApiCalls')}</th>
                  <th>{t('adminTokens')}</th>
                  <th>{t('adminCost')}</th>
                </tr>
              </thead>
              <tbody>
                {byFeature.map((row) => (
                  <tr key={row.feature}>
                    <td>{row.feature}</td>
                    <td>{row.calls}</td>
                    <td>{row.tokens.toLocaleString()}</td>
                    <td>${row.costUsd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold">{t('adminByModel')}</h3>
          </div>
          <div className="table-scroll">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>{t('adminModel')}</th>
                  <th>{t('adminApiCalls')}</th>
                  <th>{t('adminTokens')}</th>
                  <th>{t('adminCost')}</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((row) => (
                  <tr key={row.model}>
                    <td>{row.model}</td>
                    <td>{row.calls}</td>
                    <td>{row.tokens.toLocaleString()}</td>
                    <td>${row.costUsd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold">{t('adminCostRates')}</h3>
            <p className="text-sm text-slate-500">{t('adminCostRatesDesc')}</p>
          </div>
          <div className="flex items-center gap-2">
            {ratesSaved && <span className="text-sm text-emerald-600">{t('saved')}</span>}
            <button type="button" className="btn-primary flex items-center gap-2" disabled={savingRates} onClick={() => void saveRates()}>
              <Save size={16} /> {t('save')}
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {rates.map((rate, idx) => (
            <div key={rate.model} className="grid md:grid-cols-3 gap-3">
              <input className="input-field" value={rate.model} readOnly />
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={rate.inputPer1MUsd}
                onChange={(e) => {
                  const next = [...rates];
                  next[idx] = { ...rate, inputPer1MUsd: Number(e.target.value) || 0 };
                  setRates(next);
                }}
                placeholder={t('adminInputPer1M')}
              />
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={rate.outputPer1MUsd}
                onChange={(e) => {
                  const next = [...rates];
                  next[idx] = { ...rate, outputPer1MUsd: Number(e.target.value) || 0 };
                  setRates(next);
                }}
                placeholder={t('adminOutputPer1M')}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
