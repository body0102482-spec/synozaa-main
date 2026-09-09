import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { CareerPathSection } from '../../components/student/CareerPathSection';
import type { RankSnapshot } from '../../components/student/XpBreakdownSection';
import type { UniversityRankSnapshot } from '../../components/student/StudentPortalLayout';

interface Stats {
  totalSessions: number;
  completedStations: number;
  averageScore: number;
}

export default function StudentDiagnosticsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [stats, setStats] = useState<Stats | null>(null);
  const [rankProgress, setRankProgress] = useState<RankSnapshot | null>(null);
  const [universityRank, setUniversityRank] = useState<UniversityRankSnapshot | null>(null);
  const [recent, setRecent] = useState<
    Array<{ id: string; case: { titleEn: string; titleAr: string }; result?: { totalScore: number } | null }>
  >([]);

  useEffect(() => {
    api.get('/student/overview').then((r) => {
      setStats(r.data.stats);
      setRecent(r.data.recentSessions ?? []);
    });
    api.get('/student/entitlements').then((r) => {
      setRankProgress(r.data.entitlements?.rankProgress ?? null);
      setUniversityRank(r.data.entitlements?.universityRank ?? null);
    }).catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t('portalDiagnosticsTitle')}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">{t('portalDiagnosticsDesc')}</p>
      </div>

      {rankProgress && <CareerPathSection progress={rankProgress} isAr={!!isAr} universityRank={universityRank} />}

      {stats && (
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: t('portalStatRotations'), value: stats.totalSessions },
            { label: t('portalStatAvgGrade'), value: `${stats.averageScore}%` },
            { label: t('portalStatCompleted'), value: stats.completedStations },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-5 shadow-sm">
              <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400 dark:text-slate-300 uppercase mb-2">{label}</p>
              <p className="text-3xl font-bold text-teal-700 dark:text-teal-400">{value}</p>
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="text-xs font-bold tracking-[0.14em] text-slate-500 dark:text-slate-400 uppercase mb-4">
          {t('portalHistoryTitle')}
        </h2>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 divide-y divide-slate-100 dark:divide-slate-700">
          {recent.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 dark:text-slate-400 text-center">{t('noResults')}</p>
          ) : (
            recent.map((s) => (
              <Link
                key={s.id}
                to="/student/results"
                className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <span className="font-medium text-slate-800 dark:text-slate-200">{s.case.titleEn}</span>
                {s.result && (
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{s.result.totalScore}%</span>
                )}
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
