import { Bell, Menu, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { QBANK } from '../../../lib/qbankTheme';

interface QbankPortalHeaderProps {
  onOpenMenu?: () => void;
}

export function QbankPortalHeader({ onOpenMenu }: QbankPortalHeaderProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'ST';

  return (
    <header className="sticky top-0 z-30 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
          onClick={onOpenMenu}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="flex-1 max-w-xl mx-auto hidden sm:block">
          <div className="relative">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              readOnly
              placeholder={t('portalSearchPlaceholder')}
              className="w-full ps-9 pe-20 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#635BFF]/20 focus:border-[#C7C2FF] dark:focus:border-violet-700"
            />
            <kbd className="absolute end-3 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-[10px] font-medium text-slate-400 dark:text-slate-500">
              Ctrl K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ms-auto shrink-0">
          <button
            type="button"
            className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
            aria-label={t('portalNotifications')}
          >
            <Bell size={18} />
            <span
              className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full border-2 border-white dark:border-slate-900"
              style={{ backgroundColor: QBANK.primary }}
              aria-hidden
            />
          </button>

          <div className="flex items-center gap-2.5 ps-1">
            <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="hidden md:block min-w-0 text-start">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('portalMedicalStudent')}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
