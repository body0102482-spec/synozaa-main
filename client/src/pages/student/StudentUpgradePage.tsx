import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { SubscriptionPlansSection } from '../../components/SubscriptionPlansSection';
import { RandomCasePreview } from '../../components/student/RandomCasePreview';

interface Entitlements {
  plan: string;
  isFree: boolean;
  casesQuota: number;
  casesUnlocked: number;
  casesRemaining: number;
  freeAttemptsPerCase: number;
  attemptsByCase: Record<string, number>;
}

interface PlanOption {
  id: string;
  priceEgp: number;
  casesQuota: number;
  durationMonths: number;
  labelEn: string;
  labelAr: string;
}

export default function StudentUpgradePage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);

  useEffect(() => {
    api.get('/student/entitlements').then((r) => {
      setEntitlements(r.data.entitlements);
      setPlans(r.data.plans ?? []);
    });
  }, []);

  if (!entitlements) return null;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t('portalUpgradeTitle')}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">{t('portalUpgradeDesc')}</p>
      </div>
      {!entitlements.isFree && <RandomCasePreview entitlements={entitlements} />}
      <SubscriptionPlansSection entitlements={entitlements} plans={plans} isAr={!!isAr} />
    </div>
  );
}
