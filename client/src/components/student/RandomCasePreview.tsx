import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shuffle, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { dispatchEntitlementsChanged } from '../../lib/entitlementsEvents';
import { StartCaseConfirmDialog } from './StartCaseConfirmDialog';
import { shouldConfirmCaseStart } from '../../lib/startCaseConfirm';

interface EntitlementsLike {
  isFree: boolean;
  freeAttemptsPerCase: number;
  casesRemaining: number;
  attemptsByCase: Record<string, number>;
}

interface RandomCasePreviewProps {
  entitlements: EntitlementsLike;
  categoryRootId?: string;
}

export function RandomCasePreview({ entitlements, categoryRootId }: RandomCasePreviewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const startRandom = async () => {
    setError('');
    setLoading(true);
    try {
      const randomRes = await api.get('/student/random-case', {
        params: categoryRootId ? { categoryRootId } : {},
      });
      const caseId = randomRes.data?.case?.id;
      if (!caseId) {
        setError(t('error'));
        return;
      }
      const sessionRes = await api.post('/sessions/start', { caseId, language: 'AR' });
      if (sessionRes.data.entitlements) {
        dispatchEntitlementsChanged(sessionRes.data.entitlements);
      } else {
        dispatchEntitlementsChanged();
      }
      navigate(`/simulation/${sessionRes.data.session.id}`, { state: { fromCaseStart: true } });
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (code === 'NO_ELIGIBLE_CASES') setError(t('noEligibleRandomCase'));
      else if (code === 'CASE_QUOTA_EXCEEDED') setError(t('caseQuotaExceeded'));
      else setError(t('error'));
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  const handleClick = () => {
    const pending = { type: 'random' as const };
    if (shouldConfirmCaseStart(entitlements, pending)) {
      setConfirmOpen(true);
      return;
    }
    void startRandom();
  };

  return (
    <>
      <StartCaseConfirmDialog
        open={confirmOpen}
        pending={{ type: 'random' }}
        entitlements={entitlements}
        confirming={loading}
        title={t('startCaseConfirmTitle')}
        confirmLabel={t('startCaseConfirmButton')}
        cancelLabel={t('stayInExam')}
        onConfirm={() => void startRandom()}
        onCancel={() => {
          if (!loading) setConfirmOpen(false);
        }}
      />

      <section className="mb-8 rounded-2xl border border-teal-200 dark:border-teal-800/60 bg-gradient-to-br from-teal-50/80 to-white dark:from-teal-950/30 dark:to-slate-900/80 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{t('randomCaseSectionTitle')}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xl">{t('randomCaseSectionDesc')}</p>
            {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
          </div>
          <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 text-white text-sm font-bold uppercase tracking-wide hover:bg-teal-700 disabled:opacity-60 transition-colors"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Shuffle size={18} />}
            {loading ? t('randomCaseLoading') : t('portalSurpriseMe')}
          </button>
        </div>
      </section>
    </>
  );
}
