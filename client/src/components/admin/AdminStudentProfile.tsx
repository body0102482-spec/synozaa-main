import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import api from '../../lib/api';

type Props = {
  userId: string | null;
  open: boolean;
  onClose: () => void;
};

type ProfilePayload = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
    university?: string | null;
    academicYear?: string | null;
    studentId?: string | null;
    lastSeenAt?: string | null;
    totalXp: number;
    rankProgress?: { rank: string; nextRank?: string; progress?: number };
  };
  subscription: {
    plan: string;
    status: string;
    startDate: string;
    endDate?: string | null;
    planNameEn?: string;
    planNameAr?: string;
    casesQuota: number;
  } | null;
  entitlements: {
    casesQuota: number;
    casesRemaining: number;
    casesUnlocked: number;
  };
  qbankModules: { id: string; nameEn: string; nameAr: string }[];
  activity: {
    completedCount: number;
    averageScore: number;
    recentSessions: {
      id: string;
      startedAt: string;
      status: string;
      case?: { titleEn: string; titleAr?: string };
      result?: { totalScore: number } | null;
    }[];
  };
  commonMistakes: { phrase: string; count: number }[];
};

export function AdminStudentProfile({ userId, open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    setError('');
    setData(null);
    void api
      .get(`/admin/users/${userId}/profile`)
      .then((r) => setData(r.data))
      .catch(() => setError(t('adminProfileLoadError')))
      .finally(() => setLoading(false));
  }, [open, userId, t]);

  if (!open) return null;

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString(isAr ? 'ar-EG' : 'en-US');
    } catch {
      return '—';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <aside className="relative w-full max-w-lg h-full bg-white dark:bg-slate-900 shadow-xl overflow-y-auto animate-fade-in">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
          <h2 className="font-semibold text-slate-900 dark:text-white">{t('adminStudentProfile')}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading && <p className="text-sm text-slate-500">{t('loading')}...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {data && (
            <>
              <div className="flex items-start gap-4">
                {data.user.avatarUrl ? (
                  <img src={data.user.avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 font-bold text-xl">
                    {data.user.firstName?.[0]}
                    {data.user.lastName?.[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {data.user.firstName} {data.user.lastName}
                  </p>
                  <p className="text-sm text-slate-500 truncate">{data.user.email}</p>
                  <p className="text-sm text-slate-500">{data.user.phone || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-500">{t('university')}</p>
                  <p className="font-medium mt-1">{data.user.university || '—'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-500">{t('adminAcademicYear')}</p>
                  <p className="font-medium mt-1">{data.user.academicYear || '—'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-500">{t('adminLastSeen')}</p>
                  <p className="font-medium mt-1">{formatDate(data.user.lastSeenAt)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-500">XP</p>
                  <p className="font-medium mt-1">
                    {Math.round(data.user.totalXp)}
                    {data.user.rankProgress?.rank ? ` · ${data.user.rankProgress.rank}` : ''}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                <h3 className="font-semibold">{t('subscriptions')}</h3>
                <p className="text-sm">
                  {(isAr ? data.subscription?.planNameAr : data.subscription?.planNameEn) ||
                    data.subscription?.plan ||
                    'FREE'}
                </p>
                <p className="text-sm text-slate-500">
                  {t('adminCasesRemaining')}: {data.entitlements.casesRemaining} / {data.entitlements.casesQuota}
                </p>
                <p className="text-sm text-slate-500">
                  {t('adminPlanValidUntil')}: {formatDate(data.subscription?.endDate)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                <h3 className="font-semibold">{t('adminQbankOwnedModules')}</h3>
                {data.qbankModules.length === 0 ? (
                  <p className="text-sm text-slate-400">{t('adminNoModules')}</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {data.qbankModules.map((m) => (
                      <li key={m.id}>{isAr ? m.nameAr : m.nameEn}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                <h3 className="font-semibold">{t('adminPerformance')}</h3>
                <p className="text-sm">
                  {t('adminCompletedSessions')}: {data.activity.completedCount}
                </p>
                <p className="text-sm">
                  {t('adminAvgScore')}: {Math.round(data.activity.averageScore * 10) / 10}%
                </p>
                <div className="pt-2 space-y-2">
                  {data.activity.recentSessions.map((s) => (
                    <div key={s.id} className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{s.case?.titleEn || '—'}</span>
                      <span className="text-slate-500 shrink-0">
                        {s.result?.totalScore != null ? `${s.result.totalScore}%` : s.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                <h3 className="font-semibold">{t('adminCommonMistakes')}</h3>
                {data.commonMistakes.length === 0 ? (
                  <p className="text-sm text-slate-400">—</p>
                ) : (
                  <ul className="text-sm space-y-2">
                    {data.commonMistakes.map((m) => (
                      <li key={m.phrase} className="flex justify-between gap-3">
                        <span>{m.phrase}</span>
                        <span className="text-slate-400 shrink-0">×{m.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
