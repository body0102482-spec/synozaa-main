import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { homePathForUser } from '../../lib/authStorage';
import { ThemeToggle } from '../ThemeToggle';
import { Menu, X } from 'lucide-react';
import { LandingBrandLogo } from './LandingBrandLogo';

export function LandingNavbar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = () => setMobileOpen(false);

  const portalTo = user ? homePathForUser(user) : '/login';

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#0a0c14]/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 sm:h-[72px] flex items-center justify-between">
        <div className="flex items-center h-full">
          <LandingBrandLogo onClick={close} />
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a href="#features" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">{t('landingNavFeatures')}</a>
          <a href="#faq" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">{t('landingNavFaq')}</a>
          <a href="#about" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">{t('landingNavAbout')}</a>
          <Link to={portalTo} className="text-slate-900 dark:text-white font-semibold hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
            {t('landingNavPortal')}
          </Link>
          <ThemeToggle />
        </nav>

        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Menu"
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0a0c14] px-5 py-4 space-y-1">
          <a href="#features" onClick={close} className="block py-3 text-sm font-medium text-slate-700 dark:text-slate-200">{t('landingNavFeatures')}</a>
          <a href="#faq" onClick={close} className="block py-3 text-sm font-medium text-slate-700 dark:text-slate-200">{t('landingNavFaq')}</a>
          <a href="#about" onClick={close} className="block py-3 text-sm font-medium text-slate-700 dark:text-slate-200">{t('landingNavAbout')}</a>
          <Link to={portalTo} onClick={close} className="block py-3 text-sm font-semibold text-teal-700 dark:text-teal-400">{t('landingNavPortal')}</Link>
        </div>
      )}
    </header>
  );
}
