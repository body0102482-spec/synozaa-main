import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePathForUser } from '../lib/authStorage';
import {
  ArrowRight,
  Brain,
  Activity,
  Mic,
  ClipboardCheck,
  CheckCircle2,
} from 'lucide-react';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { StationSimulatorPreview } from '../components/landing/StationSimulatorPreview';
import { LandingBrandLogo } from '../components/landing/LandingBrandLogo';
import { AnimateOnScroll } from '../components/AnimateOnScroll';
import { PartnerUniversitiesSection } from '../components/PartnerUniversitiesSection';
import { LandingFaqSection } from '../components/landing/LandingFaqSection';
import api from '../lib/api';

const defaultSettings = {
  contactPhone: '01024828652',
};

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const enterPath = user ? homePathForUser(user) : '/register';
  const isAr = i18n.language?.startsWith('ar');
  const [universities, setUniversities] = useState<
    { id: string; nameEn: string; nameAr: string; logoUrl?: string | null; website?: string | null }[]
  >([]);

  useEffect(() => {
    api.get('/site/public').then((r) => setUniversities(r.data.universities || [])).catch(() => {});
  }, []);

  const featureTiles = [
    { icon: Brain, title: t('landingTile1Title'), desc: t('landingTile1Desc') },
    { icon: Activity, title: t('landingTile2Title'), desc: t('landingTile2Desc') },
    { icon: Mic, title: t('landingTile3Title'), desc: t('landingTile3Desc') },
    { icon: ClipboardCheck, title: t('landingTile4Title'), desc: t('landingTile4Desc') },
  ];

  const pillars = [
    { icon: Brain, title: t('landingPillar1Title'), desc: t('landingPillar1Desc') },
    { icon: Activity, title: t('landingPillar2Title'), desc: t('landingPillar2Desc') },
    { icon: ClipboardCheck, title: t('landingPillar3Title'), desc: t('landingPillar3Desc') },
  ];

  const ecosystemItems = [
    { title: t('landingEco1Title'), desc: t('landingEco1Desc') },
    { title: t('landingEco2Title'), desc: t('landingEco2Desc') },
    { title: t('landingEco3Title'), desc: t('landingEco3Desc') },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0c14] text-slate-900 dark:text-slate-100 selection:bg-teal-100 dark:selection:bg-teal-900/40">
      <LandingNavbar />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-8 text-center">
        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/50 border border-teal-100 dark:border-teal-800/60 text-[10px] sm:text-[11px] font-bold tracking-[0.14em] text-teal-700 dark:text-teal-300 uppercase mb-8">
          {t('landingHeroBadge')}
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] font-bold leading-[1.08] tracking-tight text-slate-900 dark:text-white mb-6">
          {t('landingHeroLine1')}{' '}
          <span className="text-gradient-brand block sm:inline mt-1 sm:mt-0">{t('landingHeroHighlight')}</span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
          {t('landingHeroSubtitle')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-2">
          <Link
            to={enterPath}
            className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 dark:from-teal-400 dark:to-cyan-400 text-slate-900 text-sm font-semibold shadow-lg shadow-teal-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            {t('landingEnterCenter')}
            <ArrowRight size={18} className={`group-hover:translate-x-0.5 transition-transform ${isAr ? 'rotate-180' : ''}`} />
          </Link>
          <a
            href="#features"
            className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors px-4 py-3 rounded-full border border-transparent dark:border-slate-700 dark:hover:border-slate-600"
          >
            {t('landingExplore')}
          </a>
        </div>

        <StationSimulatorPreview />
      </section>

      {/* Ecosystem */}
      <section id="about" className="py-16 sm:py-24 bg-slate-50/60 dark:bg-[#0d111c]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <AnimateOnScroll>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white leading-tight mb-2">
              {t('landingEcoHeading')}
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-teal-600 dark:text-teal-400 mb-6">{t('landingEcoSubheading')}</p>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-8">{t('landingEcoIntro')}</p>
            <ul className="space-y-6">
              {ecosystemItems.map(({ title, desc }) => (
                <li key={title} className="flex gap-4">
                  <CheckCircle2 size={22} className="text-teal-500 shrink-0 mt-0.5" strokeWidth={2} />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white mb-1">{title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </AnimateOnScroll>

          <AnimateOnScroll delay={120} animation="scale-in">
            <div className="rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm">
              <p className="text-[11px] font-bold tracking-[0.14em] text-teal-600 dark:text-teal-400 uppercase mb-4">
                {t('landingEcoBadge')}
              </p>
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">{t('landingEcoCardText')}</p>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Feature tiles */}
      <section id="features" className="py-16 sm:py-20 bg-white dark:bg-[#0a0c14]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {featureTiles.map(({ icon: Icon, title, desc }, i) => (
              <AnimateOnScroll key={title} delay={i * 60} animation="fade-in">
                <div className="h-full rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/50 p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-teal-200 dark:hover:border-teal-800 transition-all">
                  <Icon size={22} className="text-teal-600 mb-4" strokeWidth={1.75} />
                  <p className="text-[10px] font-bold tracking-[0.12em] text-teal-600 uppercase mb-2">{title}</p>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="py-16 sm:py-24 bg-slate-50/60 dark:bg-[#0d111c]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <AnimateOnScroll className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">{t('landingPillarsTitle')}</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">{t('landingPillarsSubtitle')}</p>
          </AnimateOnScroll>

          <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {pillars.map(({ icon: Icon, title, desc }, i) => (
              <AnimateOnScroll key={title} delay={i * 80} animation="scale-in">
                <div className="h-full rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-7 shadow-sm">
                  <Icon size={24} className="text-teal-600 dark:text-teal-400 mb-5" strokeWidth={1.75} />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">{title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      <LandingFaqSection />

      <PartnerUniversitiesSection
        universities={universities}
        isAr={!!isAr}
        title={t('partnerUniversities')}
        badge={t('landingPartnersBadge')}
        description={t('landingPartnersDesc')}
      />

      {/* Bottom CTA */}
      <section className="py-16 sm:py-24 bg-white dark:bg-[#0a0c14] border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-xl mx-auto px-5 sm:px-8 text-center">
          <LandingBrandLogo />
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-8 mb-4">{t('landingCtaTitle')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base leading-relaxed mb-8">{t('landingCtaSubtitle')}</p>
          <Link
            to={enterPath}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm font-semibold hover:border-teal-300 dark:hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-400 transition-all shadow-sm"
          >
            {t('landingCtaButton')}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="py-8 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500">
        <p className="mb-2">© {new Date().getFullYear()} Synoza · {defaultSettings.contactPhone}</p>
        <Link
          to="/refund-policy"
          className="text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 underline-offset-2 hover:underline"
        >
          {t('refundPolicyLink')}
        </Link>
      </footer>
    </div>
  );
}
