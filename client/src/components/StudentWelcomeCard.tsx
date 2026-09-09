import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Crown,
  FolderOpen,
  Layers,
  CalendarDays,
  ArrowUpRight,
  Quote,
} from 'lucide-react';
import type { User } from '../context/AuthContext';
import { getDailyQuote, getPlanTierKey } from '../lib/dailyQuotes';

export interface WelcomeEntitlements {
  plan: string;
  isFree: boolean;
  casesQuota: number;
  casesUnlocked: number;
  casesRemaining: number;
  planEndDate?: string | null;
  planStartDate?: string | null;
  planDurationMonths?: number;
}

interface StudentWelcomeCardProps {
  user: User | null;
  entitlements: WelcomeEntitlements;
  isAr: boolean;
}

function resolveExpiryIso(entitlements: WelcomeEntitlements): string | null {
  if (entitlements.planEndDate) return entitlements.planEndDate;
  if (!entitlements.isFree && entitlements.planStartDate) {
    const months = entitlements.planDurationMonths ?? 12;
    const end = new Date(entitlements.planStartDate);
    end.setMonth(end.getMonth() + months);
    return end.toISOString();
  }
  return null;
}

function formatPlanDate(iso: string | null | undefined, isAr: boolean, fallback: string): string {
  if (!iso) return fallback;
  return new Date(iso).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function StudentWelcomeCard({ user, entitlements, isAr }: StudentWelcomeCardProps) {
  const { t } = useTranslation();
  const quote = getDailyQuote(isAr);
  const planKey = getPlanTierKey(entitlements.plan);
  const displayName = user?.firstName?.trim() || t('studentFallbackName');

  const casesUsed = entitlements.casesUnlocked;
  const casesRemaining = entitlements.isFree ? null : entitlements.casesRemaining;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-slate-700/40 shadow-xl shadow-slate-900/10 dark:shadow-black/40"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 dark:from-[#0a1628] dark:via-slate-900 dark:to-teal-950"
        aria-hidden
      />
      <div
        className="absolute -top-20 -end-16 w-64 h-64 rounded-full bg-teal-500/15 blur-3xl pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute -bottom-24 -start-10 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"
        aria-hidden
      />

      <div className="relative p-6 sm:p-8 lg:p-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/15 border border-teal-400/25 text-teal-200 text-[11px] font-semibold uppercase tracking-wider mb-5">
          <Sparkles size={14} className="text-teal-300 shrink-0" />
          {t('welcomeCardBadge')}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight mb-3">
              {t('welcomeCardGreeting', { name: displayName })}
            </h1>
            <div className="flex gap-3 items-start">
              <Quote
                size={22}
                className="text-teal-400/80 shrink-0 mt-0.5 rotate-180"
                strokeWidth={1.5}
              />
              <p className="text-sm sm:text-base text-slate-300/90 leading-relaxed italic">
                {quote}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 pb-5 border-b border-white/10">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-teal-500/20 shrink-0">
                <Crown size={22} className="text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                  {t('welcomeCardCurrentPlan')}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-white truncate">
                  {t(planKey)}
                </p>
              </div>
            </div>

            {entitlements.isFree && (
              <Link
                to="#subscription-plans"
                className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-teal-300 hover:text-teal-200 transition-colors sm:ms-auto"
              >
                {t('welcomeCardUpgrade')}
                <ArrowUpRight size={16} />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/8 px-4 py-3.5">
              <div className="w-9 h-9 rounded-lg bg-teal-500/20 flex items-center justify-center shrink-0">
                <FolderOpen size={18} className="text-teal-300" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">{t('welcomeCardCasesUsed')}</p>
                <p className="text-lg font-bold text-white">{casesUsed}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/8 px-4 py-3.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                <Layers size={18} className="text-indigo-300" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">
                  {t('welcomeCardCasesRemaining')}
                </p>
                <p className="text-lg font-bold text-white">
                  {casesRemaining !== null ? casesRemaining : t('welcomeCardFreeCasesNote')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/8 px-4 py-3.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <CalendarDays size={18} className="text-amber-300" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">{t('welcomeCardPlanExpiry')}</p>
                <p className="text-lg font-bold text-white">
                  {entitlements.isFree
                    ? t('welcomeCardNoExpiry')
                    : formatPlanDate(resolveExpiryIso(entitlements), isAr, t('welcomeCardActivePlan'))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
