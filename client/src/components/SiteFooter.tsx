import { Link } from 'react-router-dom';
import { Phone, Mail, ArrowUpRight } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { IconBox } from './IconBox';

export interface SiteSettings {
  footerTaglineEn: string;
  footerTaglineAr: string;
  contactPhone: string;
  contactEmail?: string | null;
  ctaTitleEn: string;
  ctaTitleAr: string;
  ctaSubtitleEn: string;
  ctaSubtitleAr: string;
}

interface SiteFooterProps {
  settings: SiteSettings;
  isAr: boolean;
  appName: string;
  contactLabel: string;
  getStartedLabel: string;
}

export function SiteCtaSection({ settings, isAr, getStartedLabel }: Pick<SiteFooterProps, 'settings' | 'isAr' | 'getStartedLabel'>) {
  return (
    <section className="relative py-16 sm:py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950" />
      <div className="absolute inset-0 opacity-50 pointer-events-none">
        <div className="brand-glow w-72 h-72 bg-teal-400/25 top-0 left-1/4" />
        <div className="brand-glow w-80 h-80 bg-indigo-400/20 bottom-0 right-1/4" style={{ animationDelay: '3s' }} />
      </div>
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center animate-fade-in">
        <h3 className="text-heading mb-4">
          {isAr ? settings.ctaTitleAr : settings.ctaTitleEn}
        </h3>
        <p className="text-body mb-8 text-base lg:text-lg">
          {isAr ? settings.ctaSubtitleAr : settings.ctaSubtitleEn}
        </p>
        <Link
          to="/register"
          className="group inline-flex items-center gap-2 btn-primary px-8 py-3.5 text-base"
        >
          {getStartedLabel}
          <ArrowUpRight size={18} strokeWidth={2.5} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </section>
  );
}

export function SiteFooter({ settings, isAr, appName, contactLabel }: Omit<SiteFooterProps, 'getStartedLabel'>) {
  const tagline = isAr ? settings.footerTaglineAr : settings.footerTaglineEn;

  return (
    <footer className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-t border-slate-200/70 dark:border-slate-800/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          <div className="md:col-span-1">
            <BrandLogo size="md" subtitle={tagline} showSubtitle />
          </div>

          <div>
            <h4 className="text-label mb-4 !text-slate-700 dark:!text-slate-200">
              {isAr ? 'روابط سريعة' : 'Quick Links'}
            </h4>
            <ul className="space-y-2.5 text-sm font-medium">
              <li><Link to="/login" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">{isAr ? 'تسجيل الدخول' : 'Login'}</Link></li>
              <li><Link to="/register" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">{isAr ? 'إنشاء حساب' : 'Register'}</Link></li>
              <li><a href="#about" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">{isAr ? 'عن المنصة' : 'About'}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-label mb-4 !text-slate-700 dark:!text-slate-200">{contactLabel}</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href={`tel:${settings.contactPhone}`} className="flex items-center gap-3 hover:text-teal-600 dark:hover:text-teal-400 transition-colors group font-medium">
                  <IconBox icon={Phone} variant="soft" size="sm" />
                  {settings.contactPhone}
                </a>
              </li>
              {settings.contactEmail && (
                <li>
                  <a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-3 hover:text-teal-600 dark:hover:text-teal-400 transition-colors group font-medium">
                    <IconBox icon={Mail} variant="soft" size="sm" />
                    <span className="break-all">{settings.contactEmail}</span>
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {appName}. {isAr ? 'جميع الحقوق محفوظة' : 'All rights reserved.'}</p>
          <p>{isAr ? 'منصة تدريب OSCE بالذكاء الاصطناعي' : 'AI-Powered OSCE Training Platform'}</p>
        </div>
      </div>
    </footer>
  );
}
