import { Building2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimateOnScroll } from './AnimateOnScroll';

export interface PartnerUniversity {
  id: string;
  nameEn: string;
  nameAr: string;
  logoUrl?: string | null;
  website?: string | null;
}

const ARABIC_NAMES: Record<string, string> = {
  'Misr University for Science and Technology': 'جامعة مصر للعلوم والتكنولوجيا',
  'Cairo University': 'جامعة القاهرة',
  'Ain Shams University': 'جامعة عين شمس',
  'Al-Azhar University': 'جامعة الأزهر',
  '6th October University': 'جامعة 6 أكتوبر',
  'Alexandria University': 'جامعة الإسكندرية',
  'Mansoura University': 'جامعة المنصورة',
  'Benha University': 'جامعة بنها',
  'Fayoum University': 'جامعة الفيوم',
  'Galala University': 'جامعة الجلالة',
  'Nahda University': 'جامعة النهضة',
  'MTI University': 'جامعة MTI',
};

interface PartnerUniversitiesSectionProps {
  universities: PartnerUniversity[];
  isAr: boolean;
  title: string;
  badge: string;
  description: string;
}

export function PartnerUniversitiesSection({
  universities,
  isAr,
  title,
  badge,
  description,
}: PartnerUniversitiesSectionProps) {
  const { t } = useTranslation();
  if (universities.length === 0) return null;

  return (
    <section id="partners" className="py-16 sm:py-24 bg-white dark:bg-[#0d111c]">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <AnimateOnScroll className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 text-[11px] font-bold tracking-[0.14em] uppercase mb-5">
            {badge}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">{title}</h2>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed" dir={isAr ? 'rtl' : 'ltr'}>
            {description}
          </p>
        </AnimateOnScroll>

        <div className="space-y-3">
          {universities.map((uni, i) => {
            const nameAr = ARABIC_NAMES[uni.nameEn] || uni.nameAr || uni.nameEn;
            const content = (
              <div className="flex items-center gap-4 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:border-teal-200 dark:hover:border-teal-800 hover:shadow-md transition-all duration-300">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-100 dark:border-teal-900/60 flex items-center justify-center">
                  {uni.logoUrl ? (
                    <img src={uni.logoUrl} alt="" className="w-7 h-7 object-contain" />
                  ) : (
                    <Building2 size={20} className="text-teal-600" strokeWidth={1.75} />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                  <div className="min-w-0 text-start">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base truncate">{uni.nameEn}</p>
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 shrink-0 hidden sm:block" dir="rtl">
                    {nameAr}
                  </p>
                </div>
              </div>
            );

            return (
              <AnimateOnScroll key={uni.id} delay={i * 40}>
                {uni.website ? (
                  <a href={uni.website} target="_blank" rel="noopener noreferrer" className="block">
                    {content}
                  </a>
                ) : (
                  content
                )}
              </AnimateOnScroll>
            );
          })}
        </div>

        <AnimateOnScroll delay={universities.length * 40 + 80}>
          <div
            className="relative mt-8 sm:mt-10 pt-8 sm:pt-10"
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div
              className="absolute inset-x-6 sm:inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"
              aria-hidden
            />
            <div className="rounded-2xl border border-teal-100/80 dark:border-teal-900/50 bg-gradient-to-br from-teal-50/70 via-white to-slate-50/80 dark:from-teal-950/25 dark:via-slate-900/50 dark:to-indigo-950/20 px-5 py-6 sm:px-8 sm:py-7 text-center shadow-sm">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-teal-100/80 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 mb-4">
                <Sparkles size={18} strokeWidth={2} />
              </div>
              <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                {t('landingPartnersAmbassadorLead')}
              </p>
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-1.5 text-sm sm:text-base font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-600 dark:hover:text-teal-200 transition-colors underline-offset-4 hover:underline"
              >
                {t('landingPartnersAmbassadorCta')}
              </Link>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
