import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function StationSimulatorPreview() {
  const { t } = useTranslation();

  return (
    <div className="landing-simulator mx-auto w-full max-w-4xl mt-12 sm:mt-16">
      <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.18)] dark:shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="ms-3 text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
            {t('landingSimulatorTitle')}
          </span>
        </div>

        <div className="relative grid md:grid-cols-[1fr_1.2fr] gap-0 min-h-[280px] sm:min-h-[320px]">
          <div className="p-5 sm:p-6 border-b md:border-b-0 md:border-e border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <p className="text-[10px] font-bold tracking-[0.16em] text-teal-600 dark:text-teal-400 uppercase mb-3">
              {t('landingSimulatorPatient')}
            </p>
            <p className="text-lg font-bold text-slate-900 dark:text-white mb-5">Ahmed Mansour</p>
            <div className="space-y-3">
              {[
                { label: 'BP', value: '145/92', pct: 72, color: 'bg-amber-400' },
                { label: 'HR', value: '98 bpm', pct: 65, color: 'bg-teal-400' },
                { label: 'RR', value: '22/min', pct: 58, color: 'bg-indigo-400' },
              ].map(({ label, value, pct, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{label}</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-6 bg-slate-50/40 dark:bg-slate-950/40 relative">
            <div className="space-y-3 text-sm">
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-tr-md bg-teal-600 text-white px-3.5 py-2 max-w-[85%] text-xs sm:text-sm">
                  {t('landingChatDoctor')}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2 max-w-[85%] text-xs sm:text-sm shadow-sm">
                  {t('landingChatPatient')}
                </div>
              </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-900/85 flex items-center justify-center shadow-xl">
                <Play size={22} className="text-white ms-0.5" fill="white" />
              </div>
            </div>

            <div className="absolute bottom-4 end-4 flex items-end gap-0.5 h-8">
              {[3, 6, 4, 8, 5, 9, 4, 7].map((h, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-teal-400/70"
                  style={{ height: `${h * 3}px` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
