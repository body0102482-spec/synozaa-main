import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import api from '../../lib/api';

type AdminUserSummary = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

type PlanOption = {
  id: string;
  priceEgp: number;
  casesQuota: number;
  durationMonths: number;
  labelEn: string;
  labelAr: string;
};

type SubscriptionRecord = {
  id: string;
  plan: string;
  status: string;
  casesQuota: number;
  startDate: string;
  endDate: string | null;
};

type EntitlementsPayload = {
  user: AdminUserSummary;
  entitlements: {
    plan: string;
    isFree: boolean;
    casesQuota: number;
    casesUnlocked: number;
    casesRemaining: number;
    planEndDate: string | null;
    planStartDate: string | null;
    planDurationMonths: number;
  };
  subscription: SubscriptionRecord | null;
  plans: PlanOption[];
};

type Props = {
  user: AdminUserSummary;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(locale);
  } catch {
    return '—';
  }
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function AdminUserPlanModal({ user, open, onClose, onSaved }: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const locale = isAr ? 'ar-EG' : 'en-US';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<EntitlementsPayload | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('FREE');
  const [endDateInput, setEndDateInput] = useState('');

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError('');
    void api
      .get(`/admin/users/${user.id}/entitlements`)
      .then((res) => {
        const payload = res.data as EntitlementsPayload;
        setData(payload);
        const currentPlan = payload.entitlements.plan ?? 'FREE';
        setSelectedPlan(currentPlan);
        setEndDateInput(toDateInputValue(payload.entitlements.planEndDate ?? payload.subscription?.endDate));
      })
      .catch(() => setError(t('adminPlanUpdateError')))
      .finally(() => setLoading(false));
  }, [open, user.id, t]);

  const planOptions = useMemo(() => data?.plans ?? [], [data?.plans]);
  const selectedPlanMeta = planOptions.find((p) => p.id === selectedPlan);
  const isPaidSelection = selectedPlan !== 'FREE';

  const planLabel = (plan: PlanOption) => (isAr ? plan.labelAr : plan.labelEn);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/admin/users/${user.id}/subscription`, {
        plan: selectedPlan,
        ...(isPaidSelection && endDateInput ? { endDate: endDateInput } : {}),
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || t('adminPlanUpdateError'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{t('adminManagePlan')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {user.firstName} {user.lastName} · {user.email}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {loading && <p className="text-sm text-slate-500">{t('loading')}</p>}

          {!loading && data && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs text-slate-500">{t('adminCurrentPlan')}</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-1">
                    {planOptions.find((p) => p.id === data.entitlements.plan)?.[isAr ? 'labelAr' : 'labelEn'] ??
                      data.entitlements.plan}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs text-slate-500">{t('adminPlanValidUntil')}</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-1">
                    {formatDate(data.entitlements.planEndDate, locale)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs text-slate-500">{t('adminCasesUsed')}</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-1">
                    {data.entitlements.isFree ? '—' : data.entitlements.casesUnlocked}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs text-slate-500">{t('adminCasesRemaining')}</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-1">
                    {data.entitlements.isFree ? '—' : data.entitlements.casesRemaining}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="admin-plan-select">
                  {t('adminChangePlan')}
                </label>
                <select
                  id="admin-plan-select"
                  className="input-field"
                  value={selectedPlan}
                  onChange={(e) => {
                    setSelectedPlan(e.target.value);
                    const meta = planOptions.find((p) => p.id === e.target.value);
                    if (meta && meta.durationMonths > 0) {
                      const end = new Date();
                      end.setMonth(end.getMonth() + meta.durationMonths);
                      setEndDateInput(end.toISOString().slice(0, 10));
                    } else if (e.target.value === 'FREE') {
                      setEndDateInput('');
                    }
                  }}
                >
                  {planOptions.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {planLabel(plan)}
                      {plan.casesQuota > 0 ? ` · ${plan.casesQuota} cases` : ''}
                    </option>
                  ))}
                </select>
                {selectedPlan === 'FREE' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('adminPlanFreeHint')}</p>
                )}
              </div>

              {isPaidSelection && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="admin-plan-end">
                    {t('adminPlanValidUntil')}
                  </label>
                  <input
                    id="admin-plan-end"
                    type="date"
                    className="input-field"
                    value={endDateInput}
                    onChange={(e) => setEndDateInput(e.target.value)}
                  />
                  {selectedPlanMeta && (
                    <p className="text-xs text-slate-500">
                      {t('planQuoteValidity', { count: selectedPlanMeta.durationMonths || 1 })}
                    </p>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            {t('cancel')}
          </button>
          <button type="button" onClick={handleSave} disabled={loading || saving || !data} className="btn-primary">
            {saving ? t('loading') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
