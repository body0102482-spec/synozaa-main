import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Stethoscope,
  FileText,
  LineChart,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SynozaLogo } from '../SynozaLogo';
import { ConnectionStatus } from '../ConnectionStatus';
import { ThemeToggle } from '../ThemeToggle';
import { getPlanTierKey } from '../../lib/dailyQuotes';
import api from '../../lib/api';
import { debounce } from '../../lib/debounce';
import { releaseStuckUiLayers } from '../../lib/uiCleanup';
import { rankLabel } from '../../lib/clinicalRanks';
import { QBANK } from '../../lib/qbankTheme';
import {
  dispatchEntitlementsChanged,
  ENTITLEMENTS_CHANGED_EVENT,
  readEntitlementsFromEvent,
  type EntitlementsSnapshot,
} from '../../lib/entitlementsEvents';
import { QbankPortalHeader } from './qbank/QbankPortalHeader';
import { QbankPortalSidebar } from './qbank/QbankPortalSidebar';
import type { RankSnapshot } from './XpBreakdownSection';

interface Entitlements {
  plan: string;
  isFree: boolean;
  casesQuota: number;
  casesUnlocked: number;
  casesRemaining: number;
  planEndDate?: string | null;
  totalXp?: number;
  rankProgress?: RankSnapshot;
  universityRank?: UniversityRankSnapshot | null;
}

export interface UniversityRankSnapshot {
  rank: number;
  cohortSize: number;
  higherCount: number;
  topPercent: number;
}

const NAV: Array<{
  path: string;
  icon: typeof Stethoscope;
  labelKey: 'portalNavOsce' | 'portalNavMcq' | 'portalNavDiagnostics' | 'portalNavUpgrade' | 'portalNavSettings';
  end?: boolean;
}> = [
  { path: '/student', icon: Stethoscope, labelKey: 'portalNavOsce', end: true },
  { path: '/student/mcq', icon: FileText, labelKey: 'portalNavMcq' },
  { path: '/student/diagnostics', icon: LineChart, labelKey: 'portalNavDiagnostics' },
  { path: '/student/upgrade', icon: CreditCard, labelKey: 'portalNavUpgrade' },
  { path: '/student/profile', icon: Settings, labelKey: 'portalNavSettings' },
] as const;

type NavLabelKey = (typeof NAV)[number]['labelKey'];

function getPortalPageTitleKey(pathname: string): NavLabelKey {
  for (const item of NAV) {
    if (item.end) {
      if (pathname === item.path) return item.labelKey;
      continue;
    }
    if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
      return item.labelKey;
    }
  }
  return 'portalNavOsce';
}

function formatExpiry(iso: string | null | undefined, isAr: boolean, noExpiry: string): string {
  if (!iso) return noExpiry;
  return new Date(iso).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function StudentPortalShell() {
  return <StudentPortalLayout />;
}

function StudentPortalLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAr = i18n.language?.startsWith('ar');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

  const closeSidebar = () => setSidebarOpen(false);
  const openSidebar = () => setSidebarOpen(true);

  const entitlementsLoadRef = useRef(0);

  const fetchEntitlements = useCallback(() => {
    const requestId = ++entitlementsLoadRef.current;
    api
      .get('/student/entitlements')
      .then((r) => {
        if (requestId === entitlementsLoadRef.current) {
          setEntitlements(r.data.entitlements);
        }
      })
      .catch(() => {});
  }, []);

  const debouncedFetchEntitlements = useMemo(
    () => debounce(fetchEntitlements, 500),
    [fetchEntitlements],
  );

  useEffect(() => {
    const onEntitlementsChanged = (event: Event) => {
      const detail = readEntitlementsFromEvent(event);
      if (detail) {
        setEntitlements(detail as Entitlements);
        return;
      }
      debouncedFetchEntitlements();
    };
    fetchEntitlements();
    window.addEventListener(ENTITLEMENTS_CHANGED_EVENT, onEntitlementsChanged);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) debouncedFetchEntitlements();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') debouncedFetchEntitlements();
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(ENTITLEMENTS_CHANGED_EVENT, onEntitlementsChanged);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [debouncedFetchEntitlements, fetchEntitlements]);

  useEffect(() => {
    closeSidebar();
    releaseStuckUiLayers();
    debouncedFetchEntitlements();
  }, [location.pathname, debouncedFetchEntitlements]);

  useEffect(() => {
    if (!sidebarOpen) {
      document.body.style.overflow = '';
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [sidebarOpen]);

  useEffect(() => () => {
    document.body.style.overflow = '';
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
        releaseStuckUiLayers();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'ST';
  const planKey = entitlements ? getPlanTierKey(entitlements.plan) : 'planTierFree';
  const used = entitlements?.casesUnlocked ?? 0;
  const total = entitlements?.isFree ? used : entitlements?.casesQuota ?? 0;
  const remaining = entitlements?.isFree ? '—' : String(entitlements?.casesRemaining ?? 0);
  const usedPct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const showFullSidebar = !collapsed || sidebarOpen;

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  const pageTitleKey = getPortalPageTitleKey(location.pathname);
  const isMcqSection = location.pathname.startsWith('/student/mcq');

  if (isMcqSection) {
    return (
      <div className="h-[100dvh] min-h-screen flex overflow-hidden bg-[#F8FAFC] dark:bg-[#060b14]">
        <aside className="hidden lg:flex flex-col shrink-0 h-full max-h-[100dvh] w-[260px] z-30">
          <QbankPortalSidebar isAr={!!isAr} />
        </aside>

        {sidebarOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={closeSidebar}
            />
            <aside className="lg:hidden fixed top-0 start-0 z-50 flex flex-col h-full max-h-[100dvh] w-[min(260px,88vw)] shadow-xl">
              <QbankPortalSidebar onNavigate={closeSidebar} isAr={!!isAr} />
            </aside>
          </>
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full w-full">
          <QbankPortalHeader onOpenMenu={openSidebar} />
          <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] min-h-screen bg-[#f4f6f8] dark:bg-[#060b14] flex overflow-hidden">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        id="student-sidebar"
        className={[
          'fixed lg:sticky top-0 start-0 z-50 flex flex-col shrink-0',
          'h-full max-h-[100dvh] lg:h-screen bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800',
          'w-[min(288px,88vw)]',
          collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]',
          'transition-transform duration-300 ease-out',
          sidebarOpen
            ? 'translate-x-0'
            : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full',
          'lg:translate-x-0 lg:visible lg:pointer-events-auto',
          !sidebarOpen && 'max-lg:invisible max-lg:pointer-events-none',
        ].join(' ')}
      >
        <div
          className={`px-3 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1 min-h-[64px] shrink-0 ${
            collapsed && !sidebarOpen ? 'justify-center' : 'justify-between'
          }`}
        >
          {showFullSidebar && (
            <div className="flex items-center flex-1 min-w-0 h-full overflow-hidden">
              <SynozaLogo height={44} to="/student" onClick={closeSidebar} />
            </div>
          )}
          <button
            type="button"
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft size={18} className={collapsed !== isAr ? 'rotate-180' : ''} />
          </button>
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 ms-auto"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {showFullSidebar && (
          <>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800">
                    {t(planKey)}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 p-3 space-y-2">
                {entitlements?.rankProgress && (
                  <div className="pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400 dark:text-slate-300 uppercase mb-1">
                      {t('portalClinicalRank')}
                    </p>
                    <p className="text-xs font-bold text-teal-700 dark:text-teal-400 leading-snug">
                      {rankLabel(entitlements.rankProgress.currentRank, !!isAr)}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {(entitlements.totalXp ?? 0).toLocaleString()} XP
                    </p>
                    {entitlements.rankProgress.nextRank && (
                      <div className="mt-2">
                        <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full"
                            style={{ width: `${entitlements.rankProgress.progressPercent}%` }}
                          />
                        </div>
                        <Link
                          to="/student/diagnostics"
                          className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 mt-1 inline-block hover:underline"
                        >
                          {t('xpCareerPath')} →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                {entitlements?.universityRank && (
                  <div className="pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400 dark:text-slate-300 uppercase mb-1">
                      University Rank
                    </p>
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400 leading-snug">
                      #{entitlements.universityRank.rank}
                      {entitlements.universityRank.cohortSize === 1 ? ' in your university' : ''}
                    </p>
                    {entitlements.universityRank.cohortSize > 1 && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Top {entitlements.universityRank.topPercent}% in your university
                      </p>
                    )}
                  </div>
                )}
                <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400 dark:text-slate-300 uppercase">
                  {t('portalPlanStatus')}
                </p>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${usedPct}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-slate-400 dark:text-slate-300">{t('welcomeCardCasesUsed')}</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{used}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 dark:text-slate-300">{t('welcomeCardCasesRemaining')}</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{remaining}</p>
                  </div>
                </div>
                {entitlements?.isFree && (
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-snug">
                    {t('portalFreePlanHint')}
                  </p>
                )}
                {!entitlements?.isFree && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-300 leading-snug">
                    {t('portalPaidPlanHint')}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 dark:text-slate-300">
                  {t('portalExpires')}:{' '}
                  <span className="font-semibold text-slate-600 dark:text-slate-200">
                    {entitlements?.isFree
                      ? t('welcomeCardNoExpiry')
                      : formatExpiry(entitlements?.planEndDate, !!isAr, t('welcomeCardActivePlan'))}
                  </span>
                </p>
                {entitlements?.isFree && (
                  <Link
                    to="/student/upgrade"
                    onClick={closeSidebar}
                    className={`mt-1 flex w-full items-center justify-center gap-2 rounded-lg text-white text-xs font-bold py-2.5 transition-colors ${
                      isMcqSection ? 'hover:opacity-90' : 'bg-violet-600 hover:bg-violet-700'
                    }`}
                    style={isMcqSection ? { backgroundColor: QBANK.primary } : undefined}
                  >
                    <CreditCard size={14} />
                    {t('portalUpgradeNow')}
                  </Link>
                )}
              </div>
            </div>

            <nav className="flex-1 min-h-0 p-3 space-y-0.5 overflow-y-auto overscroll-contain">
              <p className="px-3 py-2 text-[10px] font-bold tracking-[0.14em] text-slate-400 dark:text-slate-300 uppercase">
                {t('portalSimulationEngine')}
              </p>
              {NAV.map(({ path, icon: Icon, labelKey, end }) => {
                const active = isActive(path, end);
                const isMcqNav = path === '/student/mcq';
                const activeMcq = active && isMcqNav;
                const activeOther = active && !isMcqNav;
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={closeSidebar}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-start transition-colors ${
                      activeMcq
                        ? 'text-[#635BFF] dark:text-[#a5b4fc]'
                        : activeOther
                          ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700'
                    }`}
                    style={activeMcq ? { backgroundColor: QBANK.light } : undefined}
                  >
                    <Icon
                      size={18}
                      className={
                        activeMcq
                          ? 'text-[#635BFF]'
                          : activeOther
                            ? 'text-teal-600 dark:text-teal-400'
                            : 'text-slate-400 dark:text-slate-400'
                      }
                      strokeWidth={1.75}
                    />
                    {t(labelKey)}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="flex flex-1 items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors py-2 min-w-0"
                >
                  <LogOut size={16} className="shrink-0" />
                  <span className="truncate">{t('portalSignOut')}</span>
                </button>
                <ThemeToggle />
              </div>
            </div>
          </>
        )}

        {collapsed && !sidebarOpen && (
          <>
            <nav className="hidden lg:flex flex-1 flex-col p-2 space-y-1 min-h-0 overflow-y-auto">
              {NAV.map(({ path, icon: Icon, labelKey, end }) => {
                const active = isActive(path, end);
                const isMcqNav = path === '/student/mcq';
                const activeMcq = active && isMcqNav;
                const activeOther = active && !isMcqNav;
                return (
                  <Link
                    key={path}
                    to={path}
                    title={t(labelKey)}
                    className={`flex items-center justify-center p-2.5 rounded-xl ${
                      activeMcq
                        ? 'text-[#635BFF]'
                        : activeOther
                          ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                    style={activeMcq ? { backgroundColor: QBANK.light } : undefined}
                  >
                    <Icon size={20} strokeWidth={1.75} />
                  </Link>
                );
              })}
            </nav>
            <div className="hidden lg:flex flex-col shrink-0 p-2 gap-1 border-t border-slate-100 dark:border-slate-800 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <ThemeToggle className="w-full flex justify-center" />
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="flex items-center justify-center p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                aria-label={t('portalSignOut')}
                title={t('portalSignOut')}
              >
                <LogOut size={18} />
              </button>
            </div>
          </>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full w-full">
        <header className="sticky top-0 z-30 shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 h-full">
              <button
                type="button"
                className="lg:hidden p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 shrink-0"
                onClick={openSidebar}
                aria-expanded={sidebarOpen}
                aria-controls="student-sidebar"
              >
                <Menu size={20} />
              </button>
              <div className="flex items-center h-full min-w-0 overflow-hidden">
                <SynozaLogo height={40} to="/student" className="max-w-[min(160px,42vw)] sm:max-w-[200px]" />
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <ConnectionStatus />
              <span className="hidden sm:inline font-semibold text-slate-700 dark:text-slate-200">{t(pageTitleKey)}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default StudentPortalLayout;
