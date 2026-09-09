import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import api from '../../lib/api';

type AdminUserSummary = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type SessionRow = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
  messageCount: number;
  aiTotalTokens: number;
  score: number | null;
  case: { titleEn: string };
};

type ActivityPayload = {
  user: AdminUserSummary & { university?: string | null };
  entitlements: {
    plan: string;
    casesQuota: number;
    casesUnlocked: number;
    casesRemaining: number;
    planEndDate: string | null;
    attemptsByCase: Record<string, number>;
  };
  totalAiTokens: number;
  sessions: SessionRow[];
  caseAccess: Array<{ attempts: number; case: { titleEn: string } }>;
};

type Props = {
  user: AdminUserSummary;
  open: boolean;
  onClose: () => void;
};

export function AdminStudentDetailModal({ user, open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US';
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ActivityPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    void api
      .get(`/admin/users/${user.id}/activity`)
      .then((res) => setData(res.data as ActivityPayload))
      .catch(() => setError(t('adminStudentLoadError')))
      .finally(() => setLoading(false));
  }, [open, user.id, t]);

  if (!open) return null;

  const fmt = (v: string | null) => {
    if (!v) return '—';
    try {
      return new Date(v).toLocaleString(locale);
    } catch {
      return '—';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{t('adminStudentActivity')}</h3>
            <p className="text-sm text-slate-500">{user.firstName} {user.lastName} · {user.email}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading && <p className="text-sm text-slate-500">{t('loading')}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {data && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs text-slate-500">{t('subscriptions')}</p>
                  <p className="font-semibold mt-1">{data.entitlements.plan}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs text-slate-500">{t('adminCasesUsed')}</p>
                  <p className="font-semibold mt-1">{data.entitlements.casesUnlocked} / {data.entitlements.casesQuota || '—'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs text-slate-500">{t('adminPlanValidUntil')}</p>
                  <p className="font-semibold mt-1">{fmt(data.entitlements.planEndDate)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <p className="text-xs text-slate-500">{t('adminTotalAiTokens')}</p>
                  <p className="font-semibold mt-1">{data.totalAiTokens.toLocaleString()}</p>
                </div>
              </div>

              {data.caseAccess.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t('adminAttemptsByCase')}</h4>
                  <div className="space-y-1">
                    {data.caseAccess.map((row, i) => (
                      <div key={i} className="flex justify-between text-sm py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span>{row.case.titleEn}</span>
                        <span className="text-slate-500">{row.attempts} {t('adminAttempts')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-2">{t('adminSessionHistory')}</h4>
                <div className="table-scroll">
                  <table className="dashboard-table text-sm">
                    <thead>
                      <tr>
                        <th>{t('cases')}</th>
                        <th>{t('status')}</th>
                        <th>{t('adminScore')}</th>
                        <th>{t('adminMessages')}</th>
                        <th>{t('adminAiTokens')}</th>
                        <th>{t('date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sessions.length === 0 ? (
                        <tr><td colSpan={6} className="text-center text-slate-400 py-6">{t('adminNoSessions')}</td></tr>
                      ) : (
                        data.sessions.map((s) => (
                          <tr key={s.id}>
                            <td className="font-medium max-w-[140px] truncate">{s.case.titleEn}</td>
                            <td><span className="badge text-xs">{s.status}</span></td>
                            <td>{s.score != null ? `${Math.round(s.score)}%` : '—'}</td>
                            <td>{s.messageCount}</td>
                            <td>{s.aiTotalTokens > 0 ? s.aiTotalTokens.toLocaleString() : '—'}</td>
                            <td className="text-slate-500 whitespace-nowrap">{fmt(s.startedAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400 mt-2">{t('adminTokenUsageHint')}</p>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">{t('close')}</button>
        </div>
      </div>
    </div>
  );
}
