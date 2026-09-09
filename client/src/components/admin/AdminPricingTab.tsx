import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import api from '../../lib/api';
import { PlanMarketingCards, type PlanOption } from '../PlanMarketingCards';

type PlanRow = {
  id: string;
  labelEn: string;
  labelAr: string;
  priceEgp: number;
  casesQuota: number;
  durationMonths: number;
  isActive: boolean;
  sortOrder: number;
};

const VISUAL_PLAN_IDS = new Set(['FREE', 'PACKAGE_50', 'PACKAGE_150', 'PACKAGE_300']);

export function AdminPricingTab() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void api.get('/admin/plans').then((r) => setPlans(r.data.plans || []));
  }, []);

  const previewPlans: PlanOption[] = useMemo(
    () =>
      plans
        .filter((p) => VISUAL_PLAN_IDS.has(p.id))
        .map((p) => ({
          id: p.id,
          priceEgp: p.priceEgp,
          casesQuota: p.casesQuota,
          durationMonths: p.durationMonths,
          labelEn: p.labelEn,
          labelAr: p.labelAr,
        })),
    [plans],
  );

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put('/admin/plans', {
        plans: plans.map((p) => ({
          id: p.id,
          nameEn: p.labelEn,
          nameAr: p.labelAr,
          priceEgp: p.priceEgp,
          casesQuota: p.casesQuota,
          durationMonths: p.durationMonths,
          isActive: p.isActive,
          sortOrder: p.sortOrder,
        })),
      });
      setPlans(r.data.plans || []);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const update = (id: string, patch: Partial<PlanRow>) => {
    setPlans((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">{t('adminPricing')}</h2>
            <p className="text-sm text-slate-500">{t('adminPricingDesc')}</p>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-sm text-emerald-600">{t('saved')}</span>}
            <button type="button" className="btn-primary flex items-center gap-2" disabled={saving} onClick={() => void save()}>
              <Save size={16} /> {t('save')}
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">{t('adminPricingPreview')}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('adminPricingPreviewDesc')}</p>
          <PlanMarketingCards plans={previewPlans} mode="preview" />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">{t('adminPricingEdit')}</h3>
        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-slate-900 dark:text-white">{plan.id}</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={plan.isActive}
                    onChange={(e) => update(plan.id, { isActive: e.target.checked })}
                  />
                  {t('active')}
                </label>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <input
                  className="input-field"
                  value={plan.labelEn}
                  onChange={(e) => update(plan.id, { labelEn: e.target.value })}
                  placeholder="Name (EN)"
                />
                <input
                  className="input-field"
                  value={plan.labelAr}
                  onChange={(e) => update(plan.id, { labelAr: e.target.value })}
                  placeholder="الاسم (عربي)"
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('adminPriceEgp')}</label>
                  <input
                    type="number"
                    className="input-field"
                    value={plan.priceEgp}
                    onChange={(e) => update(plan.id, { priceEgp: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('adminCasesQuota')}</label>
                  <input
                    type="number"
                    className="input-field"
                    value={plan.casesQuota}
                    onChange={(e) => update(plan.id, { casesQuota: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('adminDurationMonths')}</label>
                  <input
                    type="number"
                    className="input-field"
                    value={plan.durationMonths}
                    onChange={(e) => update(plan.id, { durationMonths: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
