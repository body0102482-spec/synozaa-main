import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileQuestion,
  Filter,
  Lightbulb,
  RotateCcw,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  examStorageKey,
  scoreExamResult,
  type QbankExamResult,
} from '../../data/qbankMock';
import { splitQuestionContent } from '../../lib/qbankQuestionContent';
import { QbankQuestionInsightPanel } from '../../components/student/qbank/QbankQuestionInsightPanel';

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function StudentMcqExamReportPage() {
  const { termId = '401', moduleId = 'med-1' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [result, setResult] = useState<QbankExamResult | null>(null);
  const [reviewMode, setReviewMode] = useState<'incorrect' | 'all'>('all');
  const reviewSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(`${examStorageKey(termId, moduleId)}-result`);
    if (!raw) {
      navigate(`/student/mcq/${termId}/${moduleId}/setup`, { replace: true });
      return;
    }
    try {
      setResult(JSON.parse(raw) as QbankExamResult);
    } catch {
      navigate(`/student/mcq/${termId}/${moduleId}/setup`, { replace: true });
    }
  }, [moduleId, navigate, termId]);

  const moduleName = moduleId;
  const scored = useMemo(() => (result ? scoreExamResult(result) : null), [result]);

  const chapterStats = useMemo(() => {
    if (!result || !scored) return [];
    const map = new Map<string, { correct: number; total: number }>();
    result.questions.forEach((q, i) => {
      const entry = map.get(q.chapter) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (result.answers[i]?.selected === q.correctIndex) entry.correct += 1;
      map.set(q.chapter, entry);
    });
    return [...map.entries()].map(([chapter, v]) => ({
      chapter,
      pct: v.total ? Math.round((v.correct / v.total) * 100) : 0,
    }));
  }, [result, scored]);

  const sourceStats = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, { correct: number; total: number }>();
    result.questions.forEach((q, i) => {
      const entry = map.get(q.source) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (result.answers[i]?.selected === q.correctIndex) entry.correct += 1;
      map.set(q.source, entry);
    });
    return [...map.entries()]
      .map(([source, v]) => ({ source, pct: v.total ? Math.round((v.correct / v.total) * 100) : 0 }))
      .slice(0, 5);
  }, [result]);

  const openReview = (mode: 'incorrect' | 'all') => {
    setReviewMode(mode);
    window.setTimeout(() => {
      reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const reviewQuestions = useMemo(() => {
    if (!result) return [];
    return result.questions
      .map((question, index) => {
        const answer = result.answers[index];
        const selectedIndex = answer?.selected ?? null;
        const isCorrect = selectedIndex === question.correctIndex;
        const isUnanswered = selectedIndex == null;
        return {
          index,
          question,
          answer,
          selectedIndex,
          isCorrect,
          isUnanswered,
        };
      })
      .filter((entry) => (reviewMode === 'all' ? true : !entry.isCorrect));
  }, [result, reviewMode]);

  if (!result || !scored) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const duration = result.finishedAt - result.startedAt;
  const gradeLabel =
    scored.scorePct >= 85 ? t('portalMcqGradeExcellent') : scored.scorePct >= 70 ? t('portalMcqGradeGood') : t('portalMcqGradeKeepGoing');

  const donutStyle = {
    background: `conic-gradient(#10b981 0 ${(scored.correct / scored.total) * 100}%, #ef4444 ${(scored.correct / scored.total) * 100}% ${((scored.correct + scored.incorrect) / scored.total) * 100}%, #e2e8f0 ${((scored.correct + scored.incorrect) / scored.total) * 100}% 100%)`,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to={`/student/mcq/${termId}`}
            className="inline-flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400 font-semibold mb-3"
          >
            <ArrowLeft size={16} />
            {t('portalMcqBackModules')}
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {t('portalMcqExamCompleted')} 🎉
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {termId} · {moduleName} · {result.config.mode === 'practice' ? t('portalMcqPracticeMode') : t('portalMcqExamMode')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openReview('incorrect')}
            className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors ${
              reviewMode === 'incorrect'
                ? 'border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300'
                : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
            }`}
          >
            {t('portalMcqReviewIncorrect')}
          </button>
          <button
            type="button"
            onClick={() => openReview('all')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              reviewMode === 'all'
                ? 'bg-violet-600 text-white'
                : 'border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
            }`}
          >
            {t('portalMcqReviewAll')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: t('portalMcqYourScore'), value: `${scored.scorePct}%`, sub: `${scored.correct}/${scored.total}`, icon: Trophy, accent: 'text-violet-600', badge: gradeLabel },
          { label: t('portalMcqCorrect'), value: String(scored.correct), sub: `${Math.round((scored.correct / scored.total) * 100)}%`, icon: CheckCircle2, accent: 'text-emerald-600' },
          { label: t('portalMcqIncorrect'), value: String(scored.incorrect), sub: `${Math.round((scored.incorrect / scored.total) * 100)}%`, icon: XCircle, accent: 'text-red-500' },
          { label: t('portalMcqUnanswered'), value: String(scored.unanswered), sub: '0%', icon: FileQuestion, accent: 'text-slate-500' },
          { label: t('portalMcqTimeTaken'), value: formatDuration(duration), sub: t('portalMcqUnlimited'), icon: Clock, accent: 'text-blue-600' },
        ].map(({ label, value, sub, icon: Icon, accent, badge }) => (
          <div key={label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-4 shadow-sm">
            <Icon size={18} className={`${accent} mb-2`} />
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
            {badge && <p className="text-xs font-bold text-violet-600 dark:text-violet-400 mt-1">{badge}</p>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-6">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">{t('portalMcqPerformanceOverview')}</h2>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 rounded-full shrink-0" style={donutStyle} />
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500" />{t('portalMcqCorrect')} ({scored.correct})</p>
              <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" />{t('portalMcqIncorrect')} ({scored.incorrect})</p>
              <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-300" />{t('portalMcqUnanswered')} ({scored.unanswered})</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-6">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">{t('portalMcqByChapter')}</h2>
          <div className="space-y-3">
            {chapterStats.map(({ chapter, pct }) => (
              <div key={chapter}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-300">{chapter}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-6">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">{t('portalMcqBySource')}</h2>
          <div className="space-y-3">
            {sourceStats.map(({ source, pct }) => (
              <div key={source}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{source}</span>
                  <span className="font-bold">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-6">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">{t('portalMcqAccuracyByType')}</h2>
          <div className="flex items-center gap-6">
            <div
              className="w-28 h-28 rounded-full shrink-0"
              style={{ background: 'conic-gradient(#8b5cf6 0 45%, #14b8a6 45% 75%, #f59e0b 75% 100%)' }}
            />
            <div className="text-xs space-y-2">
              <p><span className="font-bold text-violet-600">Conceptual</span> — 45%</p>
              <p><span className="font-bold text-teal-600">Application</span> — 30%</p>
              <p><span className="font-bold text-amber-600">Recall</span> — 25%</p>
            </div>
          </div>
        </div>
      </div>

      <section
        ref={reviewSectionRef}
        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-5 sm:p-6 scroll-mt-24"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">{t('portalMcqReviewSectionTitle')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {reviewMode === 'all' ? t('portalMcqReviewAllDesc') : t('portalMcqReviewIncorrectDesc')}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Filter size={14} />
            {reviewQuestions.length} {t('portalMcqQuestions')}
          </div>
        </div>

        <div className="space-y-4">
          {reviewQuestions.map(({ index, question, selectedIndex, isCorrect, isUnanswered }) => {
            const display = splitQuestionContent(question.text, question.explanation);
            return (
            <article
              key={`${question.id}-${index}`}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t('portalMcqQuestionOf', { current: index + 1, total: result.questions.length })}
                  </p>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white mt-1">
                    {display.stem}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    {question.chapter} · {question.source}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    isCorrect
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : isUnanswered
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                  }`}
                >
                  {isCorrect
                    ? t('portalMcqAnswerStatusCorrect')
                    : isUnanswered
                      ? t('portalMcqAnswerStatusUnanswered')
                      : t('portalMcqAnswerStatusIncorrect')}
                </span>
              </div>

              <div className="space-y-2.5">
                {question.options.map((option, optionIndex) => {
                  const isSelected = selectedIndex === optionIndex;
                  const isRight = question.correctIndex === optionIndex;
                  return (
                    <div
                      key={option}
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        isRight
                          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/20'
                          : isSelected
                            ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/20'
                            : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-800 dark:text-slate-200">{option}</span>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {isSelected && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                              {t('portalMcqYourAnswer')}
                            </span>
                          )}
                          {isRight && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                              {t('portalMcqCorrectAnswer')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <QbankQuestionInsightPanel
                className="mt-4"
                question={question}
                selectedIndex={selectedIndex}
                revealed
              />
            </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-bold text-slate-900 dark:text-white mb-4">{t('portalMcqWhatsNext')}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { key: 'portalMcqReviewIncorrect', icon: XCircle },
            { key: 'portalMcqReviewAll', icon: FileQuestion },
            { key: 'portalMcqRetryIncorrect', icon: RotateCcw },
            { key: 'portalMcqGenerateNew', icon: Lightbulb },
            { key: 'portalMcqBackModules', icon: ArrowLeft, to: `/student/mcq/${termId}` },
          ].map(({ key, icon: Icon, to }) =>
            to ? (
              <Link key={key} to={to} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-4 text-center hover:border-violet-300 transition-colors">
                <Icon size={20} className="mx-auto mb-2 text-violet-600" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{t(key)}</p>
              </Link>
            ) : (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === 'portalMcqReviewIncorrect') openReview('incorrect');
                  if (key === 'portalMcqReviewAll') openReview('all');
                }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-4 text-center hover:border-violet-300 transition-colors"
              >
                <Icon size={20} className="mx-auto mb-2 text-violet-600" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{t(key)}</p>
              </button>
            ),
          )}
        </div>
      </section>

      <div className="rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 p-5 flex items-start gap-3">
        <Lightbulb size={20} className="text-violet-600 shrink-0 mt-0.5" />
        <p className="text-sm text-violet-900 dark:text-violet-200">{t('portalMcqKeepPracticing')}</p>
      </div>
    </div>
  );
}
