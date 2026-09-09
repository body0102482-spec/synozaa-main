import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bookmark,
  BookOpen,
  Headphones,
  Home,
  LineChart,
  LogOut,
  Settings,
  Stethoscope,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SynozaLogo } from '../../SynozaLogo';
import { ThemeToggle } from '../../ThemeToggle';
import { useAuth } from '../../../context/AuthContext';
import { QBANK } from '../../../lib/qbankTheme';
import { buildSupportWhatsAppUrl } from '../../../lib/supportContacts';

type NavItem = {
  path?: string;
  icon: LucideIcon;
  labelKey: string;
  end?: boolean;
  soon?: boolean;
};

const MAIN_NAV: NavItem[] = [
  { path: '/student', icon: Home, labelKey: 'portalNavHome', end: true },
  { path: '/student', icon: Stethoscope, labelKey: 'portalNavOsce' },
  { path: '/student/mcq', icon: BookOpen, labelKey: 'portalNavQbank' },
  { path: '/student/diagnostics', icon: LineChart, labelKey: 'portalNavDiagnostics' },
  { path: '/student/mcq/saved', icon: Bookmark, labelKey: 'portalNavSaved' },
  { path: '/student/profile', icon: Settings, labelKey: 'portalNavSettings' },
];

interface QbankPortalSidebarProps {
  onNavigate?: () => void;
  isAr?: boolean;
}

export function QbankPortalSidebar({ onNavigate, isAr }: QbankPortalSidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const whatsappUrl = buildSupportWhatsAppUrl(!!isAr, 'qbank');

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  const isOsceActive = location.pathname.startsWith('/simulation');

  const goTo = (path: string) => {
    onNavigate?.();
    if (location.pathname !== path) navigate(path);
  };

  const navClass = (active: boolean, soon?: boolean) => {
    if (soon) {
      return 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 dark:text-slate-500 cursor-not-allowed';
    }
    if (active) {
      return 'flex items-center gap-3 py-2.5 pe-3 rounded-xl text-sm font-semibold transition-colors border-s-[3px] bg-[#EEF0FF] dark:bg-violet-950/40';
    }
    return 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors';
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800">
      <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <SynozaLogo height={40} to="/student/mcq" onClick={onNavigate} />
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-0.5">
        {MAIN_NAV.map(({ path, icon: Icon, labelKey, end, soon }) => {
          let active = false;
          if (path && labelKey === 'portalNavOsce') active = isOsceActive;
          else if (path && labelKey === 'portalNavQbank') {
            active =
              location.pathname === '/student/mcq' ||
              (location.pathname.startsWith('/student/mcq/') &&
                !location.pathname.startsWith('/student/mcq/saved'));
          } else if (path) active = isActive(path, end);
          const label = t(labelKey);

          if (soon || !path) {
            return (
              <div key={labelKey} className={navClass(false, true)} aria-disabled>
                <Icon size={18} className="text-slate-300 shrink-0" strokeWidth={1.75} />
                <span>{label}</span>
              </div>
            );
          }

          return (
            <button
              key={labelKey}
              type="button"
              onClick={() => goTo(path)}
              className={navClass(active)}
              style={
                active
                  ? {
                      color: QBANK.primary,
                      borderColor: QBANK.primary,
                      paddingInlineStart: '9px',
                    }
                  : undefined
              }
            >
              <Icon
                size={18}
                className={active ? '' : 'text-slate-400 dark:text-slate-500'}
                style={active ? { color: QBANK.primary } : undefined}
                strokeWidth={active ? 2 : 1.75}
              />
              <span style={active ? { color: QBANK.primary } : undefined}>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="shrink-0 p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Headphones size={16} className="text-slate-500 dark:text-slate-400" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('portalNeedHelp')}</p>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">{t('portalNeedHelpDesc')}</p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold hover:underline"
            style={{ color: QBANK.primary }}
          >
            {t('portalContactSupport')} →
          </a>
        </div>
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
    </div>
  );
}
