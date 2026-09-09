import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ConnectionStatus } from './ConnectionStatus';
import { ThemeToggle } from './ThemeToggle';
import { BrandLogo } from './BrandLogo';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  variant?: 'default' | 'landing';
}

export function Navbar({ variant = 'default' }: NavbarProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLanding = variant === 'landing';

  const closeMobile = () => setMobileOpen(false);

  const navClass = isLanding
    ? 'sticky top-0 z-50 glass-nav'
    : 'sticky top-0 z-50 glass-nav';

  const containerClass = isLanding
    ? 'max-w-7xl mx-auto px-6 sm:px-8 h-18 sm:h-20 flex items-center justify-between'
    : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';

  const rowClass = isLanding ? 'contents' : 'flex items-center justify-between h-14 sm:h-16';

  return (
    <nav className={navClass}>
      <div className={containerClass}>
        <div className={rowClass}>
          <BrandLogo
            size={isLanding ? 'lg' : 'md'}
            subtitle={isLanding ? t('portalSubtitle') : t('tagline')}
            onClick={closeMobile}
          />

          <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
            {isLanding ? (
              <>
                <ThemeToggle />
              </>
            ) : (
              <>
                <ConnectionStatus />
                <ThemeToggle />
              </>
            )}
            {user ? (
              <>
                {user.role === 'STUDENT' && (
                  <Link to="/student" className="btn-ghost text-sm">
                    {t('dashboard')}
                  </Link>
                )}
                {user.role === 'ADMIN' && (
                  <Link to="/admin" className="btn-ghost text-sm">
                    {t('adminPanel')}
                  </Link>
                )}
                <button onClick={logout} className="btn-secondary text-sm">
                  {t('logout')}
                </button>
              </>
            ) : isLanding ? (
              <Link to="/login" className="btn-primary text-sm px-6">
                {t('login')}
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm">
                  {t('login')}
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  {t('register')}
                </Link>
              </>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Menu"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden animate-fade-in" onClick={closeMobile} aria-hidden />
          <div className="absolute top-full left-0 right-0 z-50 md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl animate-slide-down">
            <div className="px-4 py-4 space-y-1">
              {!isLanding && (
                <div className="pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <ConnectionStatus />
                </div>
              )}
              {user ? (
                <>
                  {user.role === 'STUDENT' && (
                    <Link to="/student" onClick={closeMobile} className="block px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
                      {t('dashboard')}
                    </Link>
                  )}
                  {user.role === 'ADMIN' && (
                    <Link to="/admin" onClick={closeMobile} className="block px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
                      {t('adminPanel')}
                    </Link>
                  )}
                  <button onClick={() => { logout(); closeMobile(); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                    {t('logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={closeMobile} className="block px-4 py-3 rounded-xl text-sm font-semibold text-center btn-primary">
                    {t('login')}
                  </Link>
                  {!isLanding && (
                    <Link to="/register" onClick={closeMobile} className="block px-4 py-3 rounded-xl text-sm font-medium text-center mt-2 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300">
                      {t('register')}
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
