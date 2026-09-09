import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AnimateOnScroll } from '../AnimateOnScroll';

const FAQ_KEYS = ['landingFaq1', 'landingFaq2', 'landingFaq3', 'landingFaq4', 'landingFaq5'] as const;

export function LandingFaqSection() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="py-16 sm:py-20 bg-slate-50/60 dark:bg-[#0d111c]">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <AnimateOnScroll>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-950/50 border border-teal-100 dark:border-teal-800/60 shrink-0">
              <HelpCircle size={22} className="text-teal-600 dark:text-teal-400" strokeWidth={2.25} />
            </div>
            <h2 className="text-sm sm:text-base font-bold tracking-[0.12em] text-slate-800 dark:text-slate-200 uppercase">
              {t('landingFaqTitle')}
            </h2>
          </div>
        </AnimateOnScroll>

        <ul className="space-y-3">
          {FAQ_KEYS.map((key, index) => {
            const isOpen = openIndex === index;
            const isRefund = key === 'landingFaq5';
            return (
              <AnimateOnScroll key={key} delay={index * 50}>
                <li id={isRefund ? 'refund-policy' : undefined}>
                  <div
                    className={`rounded-2xl border transition-colors shadow-sm ${
                      isOpen
                        ? 'border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/60'
                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? -1 : index)}
                      className="w-full flex items-start justify-between gap-4 p-5 sm:p-6 text-start"
                      aria-expanded={isOpen}
                    >
                      <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-snug pe-2">
                        {t(`${key}Question`)}
                      </span>
                      <ChevronDown
                        size={20}
                        className={`shrink-0 text-slate-400 mt-0.5 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-1 space-y-3">
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{t(`${key}Answer`)}</p>
                        {isRefund && (
                          <Link
                            to="/refund-policy"
                            className="inline-flex text-sm font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors"
                          >
                            {t('landingFaq5Link')}
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              </AnimateOnScroll>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
