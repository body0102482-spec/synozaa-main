import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bookmark, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import {
  groupSavedByModule,
  loadAllSavedQuestions,
  removeSavedQuestion,
  subscribeSavedQuestions,
  type QbankSavedModuleGroup,
} from '../../lib/qbankSavedQuestions';
import { QBANK } from '../../lib/qbankTheme';
import { splitQuestionContent } from '../../lib/qbankQuestionContent';
import { QbankQuestionInsightPanel } from '../../components/student/qbank/QbankQuestionInsightPanel';

export default function StudentMcqSavedPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [groups, setGroups] = useState<QbankSavedModuleGroup[]>([]);
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});

  const refresh = () => {
    const records = loadAllSavedQuestions();
    setGroups(groupSavedByModule(records, !!isAr));
  };

  useEffect(() => {
    refresh();
    return subscribeSavedQuestions(refresh);
  }, [isAr]);

  const totalCount = useMemo(
    () => groups.reduce((sum, group) => sum + group.questions.length, 0),
    [groups],
  );

  const toggleOpen = (key: string) => {
    setOpenKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Bookmark size={22} style={{ color: QBANK.primary }} />
          <h1 className="text-2xl font-bold text-slate-900">{t('portalNavSaved')}</h1>
        </div>
        <p className="text-sm text-slate-500">{t('portalMcqSavedDesc')}</p>
        {totalCount > 0 && (
          <p className="text-xs font-semibold mt-2" style={{ color: QBANK.primary }}>
            {t('portalMcqSavedCount', { count: totalCount })}
          </p>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: QBANK.light }}
          >
            <Bookmark size={24} style={{ color: QBANK.primary }} />
          </div>
          <p className="font-semibold text-slate-900 mb-1">{t('portalMcqSavedEmptyTitle')}</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">{t('portalMcqSavedEmptyDesc')}</p>
          <Link
            to="/student/mcq"
            className="inline-flex items-center gap-1.5 mt-5 text-sm font-bold"
            style={{ color: QBANK.primary }}
          >
            {t('portalMcqBrowseModules')}
            <ChevronRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section
              key={`${group.termId}-${group.moduleId}`}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm"
            >
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                  {group.termId} · {group.termTitle}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{group.moduleTitle}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{group.specialty}</p>
                  </div>
                  <span
                    className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold"
                    style={{ backgroundColor: QBANK.light, color: QBANK.primary }}
                  >
                    {t('portalMcqSavedInModule', { count: group.questions.length })}
                  </span>
                </div>
              </div>

              <ul className="divide-y divide-slate-100">
                {group.questions.map((record) => (
                  <li key={record.key} className="px-5 py-4">
                    {(() => {
                      const display = splitQuestionContent(record.question.text, record.question.explanation);
                      return (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 leading-relaxed">
                          {display.stem}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-2">
                          {record.question.chapter} · {record.question.source}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleOpen(record.key)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-violet-300 hover:text-violet-700"
                          >
                            {openKeys[record.key] ? t('portalMcqHideAnswer') : t('portalMcqReviewSaved')}
                            <ChevronDown
                              size={14}
                              className={`transition-transform ${openKeys[record.key] ? 'rotate-180' : ''}`}
                            />
                          </button>

                          <Link
                            to={`/student/mcq/${record.termId}/${record.moduleId}/setup`}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                            style={{ backgroundColor: QBANK.primary }}
                          >
                            {t('portalMcqPracticeModule')}
                            <ChevronRight size={14} />
                          </Link>
                        </div>

                        {openKeys[record.key] && (
                          <div className="mt-4 space-y-2.5">
                            {record.question.options.map((option, index) => {
                              const isCorrect = index === record.question.correctIndex;
                              return (
                                <div
                                  key={`${record.key}-${index}`}
                                  className={`rounded-xl border px-4 py-3 text-sm ${
                                    isCorrect
                                      ? 'border-emerald-300 bg-emerald-50'
                                      : 'border-slate-200 bg-slate-50/60'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <span className="text-slate-800">{option}</span>
                                    {isCorrect && (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                        {t('portalMcqCorrectAnswer')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            <QbankQuestionInsightPanel
                              className="mt-3"
                              question={record.question}
                              revealed
                            />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSavedQuestion(record.key)}
                        className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        aria-label={t('portalMcqRemoveSaved')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
