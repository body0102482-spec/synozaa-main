import type { ElementType } from 'react';
import {
  Check,
  ClipboardList,
  Clock3,
  Crown,
  Gem,
  Gift,
  Loader2,
  Star,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface PlanOption {
  id: string;
  priceEgp: number;
  casesQuota: number;
  durationMonths: number;
  labelEn: string;
  labelAr: string;
}

type PlanTheme = {
  name: string;
  icon: ElementType;
  iconBg: string;
  iconFg: string;
  check: string;
  tipBg: string;
  tipText: string;
  pillBg: string;
  pillText: string;
  badgeBg: string;
  btnSolid: string;
  btnOutline: string;
  accentBorder: string;
};

const THEMES: Record<'free' | 'basic' | 'pro' | 'premium', PlanTheme> = {
  free: {
    name: 'text-teal-600',
    icon: Gift,
    iconBg: 'bg-teal-50',
    iconFg: 'text-teal-600',
    check: 'text-teal-500',
    tipBg: 'bg-teal-50',
    tipText: 'text-teal-700',
    pillBg: 'bg-teal-50',
    pillText: 'text-teal-700',
    badgeBg: 'bg-teal-600 text-white',
    btnSolid: 'bg-teal-600 hover:bg-teal-700 text-white',
    btnOutline: 'border-2 border-teal-500 text-teal-600 hover:bg-teal-50 bg-white',
    accentBorder: 'border-slate-200',
  },
  basic: {
    name: 'text-blue-600',
    icon: Clock3,
    iconBg: 'bg-blue-50',
    iconFg: 'text-blue-600',
    check: 'text-blue-500',
    tipBg: 'bg-blue-50',
    tipText: 'text-blue-700',
    pillBg: 'bg-blue-50',
    pillText: 'text-blue-700',
    badgeBg: 'bg-blue-700 text-white',
    btnSolid: 'bg-blue-700 hover:bg-blue-800 text-white',
    btnOutline: 'border-2 border-blue-600 text-blue-700 hover:bg-blue-50 bg-white',
    accentBorder: 'border-slate-200',
  },
  pro: {
    name: 'text-emerald-700',
    icon: Star,
    iconBg: 'bg-emerald-50',
    iconFg: 'text-emerald-700',
    check: 'text-emerald-600',
    tipBg: 'bg-emerald-50',
    tipText: 'text-emerald-800',
    pillBg: 'bg-emerald-50',
    pillText: 'text-emerald-800',
    badgeBg: 'bg-emerald-700 text-white',
    btnSolid: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    btnOutline: 'border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-white',
    accentBorder: 'border-slate-200',
  },
  premium: {
    name: 'text-violet-600',
    icon: Gem,
    iconBg: 'bg-violet-50',
    iconFg: 'text-violet-600',
    check: 'text-violet-500',
    tipBg: 'bg-violet-50',
    tipText: 'text-violet-700',
    pillBg: 'bg-violet-50',
    pillText: 'text-violet-700',
    badgeBg: 'bg-violet-600 text-white',
    btnSolid: 'bg-violet-600 hover:bg-violet-700 text-white',
    btnOutline: 'border-2 border-violet-500 text-violet-600 hover:bg-violet-50 bg-white',
    accentBorder: 'border-slate-200',
  },
};

type PlanCardDef = {
  id: string;
  themeKey: keyof typeof THEMES;
  tierKey: string;
  nameKey: string;
  taglineKey: string;
  tipKey: string;
  ctaKey: string;
  badgeKey?: 'examNightPlan' | 'mostPopular' | 'bestValue';
  badgeIcon?: ElementType;
  featureKeys: string[];
  casesFirstIcon?: boolean;
  isFree?: boolean;
};

export const FREE_CARD: PlanCardDef = {
  id: 'FREE',
  themeKey: 'free',
  tierKey: 'planTier0',
  nameKey: 'planNameFree',
  taglineKey: 'planFreeTagline',
  tipKey: 'planFreeTip',
  ctaKey: 'planStartForFree',
  featureKeys: [
    'planFreeFeatureCases',
    'planFreeFeatureAiPatient',
    'planFreeFeatureAiExaminer',
    'planFreeFeatureFeedback',
  ],
  isFree: true,
};

export const PAID_CARD: Record<string, PlanCardDef> = {
  PACKAGE_50: {
    id: 'PACKAGE_50',
    themeKey: 'basic',
    tierKey: 'planTier1',
    nameKey: 'planNameBasic',
    taglineKey: 'planBasicTagline',
    tipKey: 'planBasicTip',
    ctaKey: 'purchaseBasicPlan',
    badgeKey: 'examNightPlan',
    featureKeys: [
      'planBasicFeatureCases',
      'planBasicFeatureAiPatient',
      'planBasicFeatureAiExaminer',
      'planBasicFeatureVoice',
      'planBasicFeatureReasoning',
      'planBasicFeatureFeedback',
    ],
    casesFirstIcon: true,
  },
  PACKAGE_150: {
    id: 'PACKAGE_150',
    themeKey: 'pro',
    tierKey: 'planTier2',
    nameKey: 'planNamePro',
    taglineKey: 'planProTagline',
    tipKey: 'planProTip',
    ctaKey: 'purchaseProPlan',
    badgeKey: 'mostPopular',
    badgeIcon: Star,
    featureKeys: [
      'planProFeatureCases',
      'planProFeatureIncludesBasic',
      'planProFeatureSpecialties',
      'planProFeatureTracking',
      'planProFeatureFeedback',
    ],
    casesFirstIcon: true,
  },
  PACKAGE_300: {
    id: 'PACKAGE_300',
    themeKey: 'premium',
    tierKey: 'planTier3',
    nameKey: 'planNamePremium',
    taglineKey: 'planPremiumTagline',
    tipKey: 'planPremiumTip',
    ctaKey: 'purchasePremiumPlan',
    badgeKey: 'bestValue',
    badgeIcon: Crown,
    featureKeys: [
      'planPremiumFeatureCases',
      'planPremiumFeatureIncludesPro',
      'planPremiumFeatureFullAccess',
      'planPremiumFeatureExtended',
      'planPremiumFeatureAnalytics',
      'planPremiumFeaturePriority',
    ],
    casesFirstIcon: true,
  },
};

function featureLabel(key: string, casesCount: number, t: ReturnType<typeof useTranslation>['t']) {
  if (key.includes('FeatureCases')) {
    return t(key, { count: casesCount });
  }
  return t(key);
}

export function resolveMarketingPlans(plans: PlanOption[]): Array<{ plan: PlanOption; def: PlanCardDef }> {
  const byId = new Map(plans.map((p) => [p.id, p]));
  const free: PlanOption = byId.get('FREE') ?? {
    id: 'FREE',
    priceEgp: 0,
    casesQuota: 3,
    durationMonths: 0,
    labelEn: 'Free',
    labelAr: 'مجاني',
  };
  const rows: Array<{ plan: PlanOption; def: PlanCardDef }> = [{ plan: free, def: FREE_CARD }];
  for (const id of ['PACKAGE_50', 'PACKAGE_150', 'PACKAGE_300'] as const) {
    const def = PAID_CARD[id];
    const plan = byId.get(id) ?? {
      id,
      priceEgp: id === 'PACKAGE_50' ? 150 : id === 'PACKAGE_150' ? 300 : 500,
      casesQuota: id === 'PACKAGE_50' ? 30 : id === 'PACKAGE_150' ? 60 : 100,
      durationMonths: id === 'PACKAGE_50' ? 2 : id === 'PACKAGE_150' ? 4 : 6,
      labelEn: def.nameKey.includes('Basic') ? 'Basic' : def.nameKey.includes('Pro') ? 'Pro' : 'Premium',
      labelAr: def.nameKey.includes('Basic') ? 'Basic' : def.nameKey.includes('Pro') ? 'Pro' : 'Premium',
    };
    rows.push({ plan, def });
  }
  return rows;
}

interface PlanMarketingCardsProps {
  plans: PlanOption[];
  mode?: 'checkout' | 'preview';
  currentPlanId?: string;
  checkoutPlanId?: string | null;
  startingFree?: boolean;
  canStartFree?: boolean;
  onStartFree?: () => void;
  onCheckout?: (planId: string) => void;
}

export function PlanMarketingCards({
  plans,
  mode = 'checkout',
  currentPlanId,
  checkoutPlanId = null,
  startingFree = false,
  canStartFree = true,
  onStartFree,
  onCheckout,
}: PlanMarketingCardsProps) {
  const { t } = useTranslation();
  const rows = resolveMarketingPlans(plans);
  const preview = mode === 'preview';

  return (
    <div className="grid grid-cols-1 gap-6 max-w-md mx-auto sm:max-w-none sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
      {rows.map(({ plan, def }) => {
        const theme = THEMES[def.themeKey];
        const Icon = theme.icon;
        const BadgeIcon = def.badgeIcon;
        const casesCount = plan.casesQuota || (def.isFree ? 3 : 0);
        const isCurrent = currentPlanId === plan.id;

        return (
          <article
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border bg-white dark:bg-slate-900 shadow-sm pt-8 pb-6 px-6 ${theme.accentBorder} ${
              isCurrent ? 'ring-2 ring-offset-2 ring-teal-400' : ''
            }`}
          >
            {def.badgeKey && (
              <span
                className={`absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm whitespace-nowrap ${theme.badgeBg}`}
              >
                {BadgeIcon ? <BadgeIcon size={12} fill="currentColor" /> : null}
                {t(def.badgeKey)}
              </span>
            )}

            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2 text-center">
              {t(def.tierKey)}
            </p>
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3 className={`text-3xl font-bold ${theme.name}`}>{t(def.nameKey)}</h3>
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${theme.iconBg}`}>
                <Icon size={18} className={theme.iconFg} />
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-5">{t(def.taglineKey)}</p>

            {!def.isFree && (
              <>
                <div className="text-center mb-3">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {plan.priceEgp}
                  </span>
                  <span className="ms-1.5 text-base font-semibold text-slate-500">{t('egp')}</span>
                </div>
                <div className="flex justify-center mb-6">
                  <span
                    className={`inline-flex rounded-full px-3.5 py-1 text-xs font-semibold ${theme.pillBg} ${theme.pillText}`}
                  >
                    {t('planValidForMonths', { count: plan.durationMonths })}
                  </span>
                </div>
              </>
            )}

            {def.isFree && <div className="mb-6" />}

            <ul className="space-y-3 mb-6 flex-1">
              {def.featureKeys.map((key, idx) => {
                const useClipboard = Boolean(def.casesFirstIcon && idx === 0);
                return (
                  <li key={key} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                    {useClipboard ? (
                      <ClipboardList size={18} className={`${theme.check} shrink-0 mt-0.5`} strokeWidth={2.2} />
                    ) : (
                      <Check size={18} className={`${theme.check} shrink-0 mt-0.5`} strokeWidth={2.5} />
                    )}
                    <span>{featureLabel(key, casesCount, t)}</span>
                  </li>
                );
              })}
            </ul>

            <div className={`rounded-xl px-4 py-3 text-sm text-center mb-5 ${theme.tipBg} ${theme.tipText}`}>
              {t(def.tipKey)}
            </div>

            {preview ? (
              <div
                className={`w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-center ${
                  def.isFree ? theme.btnOutline : theme.btnSolid
                }`}
              >
                {isCurrent ? t('planCurrentPlan') : t(def.ctaKey)}
              </div>
            ) : def.isFree ? (
              <button
                type="button"
                onClick={() => onStartFree?.()}
                disabled={!canStartFree || startingFree}
                className={`w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition-colors disabled:opacity-60 ${theme.btnOutline}`}
              >
                {startingFree ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    {t('paymentProcessing')}
                  </span>
                ) : (
                  t(def.ctaKey)
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onCheckout?.(plan.id)}
                disabled={checkoutPlanId !== null}
                className={`w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition-colors disabled:opacity-70 ${theme.btnSolid}`}
              >
                {checkoutPlanId === plan.id ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    {t('paymentProcessing')}
                  </span>
                ) : isCurrent ? (
                  t('planCurrentPlan')
                ) : (
                  t(def.ctaKey)
                )}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
