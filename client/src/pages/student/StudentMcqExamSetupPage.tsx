import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BookMarked,
  ChevronRight,
  ClipboardList,
  Hash,
  PlayCircle,
  Stethoscope,
  Timer,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  QBANK_QUESTION_COUNTS,
  examStorageKey,
  examQuestionsStorageKey,
  resolveQuestionCount,
} from '../../data/qbankMock';
import api from '../../lib/api';

type SetupChapter = { id: string; nameEn: string; nameAr?: string | null };
type SetupReference = { id: string; nameEn: string; nameAr?: string | null };
type SetupMeta = {
  module: { id: string; nameEn: string; nameAr: string; subjects: string[] };
  chapters: SetupChapter[];
  references: SetupReference[];
  pairCounts: Array<{ chapterId: string; chapter: string; referenceId: string; reference: string; count: number }>;
};

type TubeId = 'subjects' | 'chapters' | 'references' | 'questions' | 'mode';

const TUBES: Array<{ id: TubeId; icon: LucideIcon; labelKey: string }> = [
  { id: 'subjects', icon: Stethoscope, labelKey: 'portalMcqTubeSubjects' },
  { id: 'chapters', icon: ClipboardList, labelKey: 'portalMcqTubeChapters' },
  { id: 'references', icon: BookMarked, labelKey: 'portalMcqTubeReferences' },
  { id: 'questions', icon: Hash, labelKey: 'portalMcqTubeQuestions' },
  { id: 'mode', icon: Timer, labelKey: 'portalMcqTubeMode' },
];

export default function StudentMcqExamSetupPage() {
  const { termId = '401', moduleId = 'med-1' } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isAr = i18n.language?.startsWith('ar');

  const [setupMeta, setSetupMeta] = useState<SetupMeta | null>(null);
  const [termTitle, setTermTitle] = useState('');
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const [accessRes, setupRes, termRes] = await Promise.all([
          api.get(`/student/qbank/${termId}/modules/${moduleId}/access`),
          api.get(`/student/qbank/${termId}/modules/${moduleId}/setup`),
          api.get(`/student/qbank/${termId}/modules`),
        ]);
        if (!accessRes.data.hasAccess) {
          navigate(`/student/mcq/${termId}`, { replace: true });
          return;
        }
        setSetupMeta(setupRes.data);
        setTermTitle(termRes.data.term?.titleEn ?? termId);
        const chapterNames = setupRes.data.chapters.map((c: SetupChapter) => c.nameEn);
        const refsWithQuestions = new Set(
          (setupRes.data.pairCounts as SetupMeta['pairCounts'])
            .filter((p) => p.count > 0)
            .map((p) => p.reference),
        );
        const refNames = setupRes.data.references
          .map((r: SetupReference) => r.nameEn)
          .filter((name: string) => refsWithQuestions.has(name));
        setSelectedChapters(chapterNames);
        setSelectedRefs(refNames.length ? refNames : setupRes.data.references.map((r: SetupReference) => r.nameEn));
        setSelectedSubjects(setupRes.data.module.subjects.slice(0, 2));
        // Default to entire module when no subject tags are configured
        if (!setupRes.data.module.subjects?.length) {
          setScope('entire');
        }
      } catch {
        navigate(`/student/mcq/${termId}`, { replace: true });
        return;
      }
      setAccessChecked(true);
    };
    void check();
  }, [termId, moduleId, navigate]);

  const module = setupMeta?.module;
  const term = setupMeta ? { id: termId, titleEn: termTitle, titleAr: termTitle } : null;

  const [activeTube, setActiveTube] = useState<TubeId | null>('subjects');
  const [scope, setScope] = useState<'entire' | 'specific'>('specific');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [examCoverage, setExamCoverage] = useState(true);
  const [questionCount, setQuestionCount] = useState<number | 'all'>(20);
  const [customCountInput, setCustomCountInput] = useState('20');
  const [useCustomCount, setUseCustomCount] = useState(false);
  const [examMode, setExamMode] = useState<'practice' | 'exam'>('practice');
  const [examDurationInput, setExamDurationInput] = useState('60');

  const examDurationMinutes = Math.min(
    600,
    Math.max(1, Number.parseInt(examDurationInput, 10) || 0),
  );
  const examDurationValid = examMode !== 'exam' || (Number.parseInt(examDurationInput, 10) >= 1 && Number.parseInt(examDurationInput, 10) <= 600);

  const availableTotal = useMemo(() => {
    if (!setupMeta) return 0;
    return setupMeta.pairCounts
      .filter((p) => selectedChapters.includes(p.chapter) && selectedRefs.includes(p.reference))
      .reduce((sum, p) => sum + p.count, 0);
  }, [setupMeta, selectedChapters, selectedRefs]);

  const resolvedQuestionCount = useMemo(
    () =>
      useCustomCount
        ? resolveQuestionCount(Number.parseInt(customCountInput, 10) || 0, availableTotal)
        : resolveQuestionCount(questionCount, availableTotal),
    [useCustomCount, customCountInput, questionCount, availableTotal],
  );

  useEffect(() => {
    if (useCustomCount && availableTotal > 0) {
      const parsed = Number.parseInt(customCountInput, 10);
      if (!Number.isNaN(parsed) && parsed > availableTotal) {
        setCustomCountInput(String(availableTotal));
      }
    }
  }, [availableTotal, customCountInput, useCustomCount]);

  const startExam = async () => {
    if (resolvedQuestionCount <= 0 || !module || !setupMeta) return;
    const chapterIds = setupMeta.chapters.filter((c) => selectedChapters.includes(c.nameEn)).map((c) => c.id);
    const referenceIds = setupMeta.references.filter((r) => selectedRefs.includes(r.nameEn)).map((r) => r.id);
    const cfg = {
      mode: examMode,
      questionCount: resolvedQuestionCount,
      subjects: scope === 'entire' ? module.subjects : selectedSubjects,
      chapters: selectedChapters,
      references: selectedRefs,
      chapterIds,
      referenceIds,
      ...(examMode === 'exam' ? { examDurationMinutes } : {}),
    };

    try {
      const params = new URLSearchParams({
        chapters: chapterIds.join(','),
        references: referenceIds.join(','),
        count: String(resolvedQuestionCount),
        mode: examMode,
      });
      if (cfg.subjects.length) params.set('subjects', cfg.subjects.join(','));
      const res = await api.get(`/student/qbank/${termId}/modules/${moduleId}/questions?${params}`);
      sessionStorage.setItem(examQuestionsStorageKey(termId, moduleId), JSON.stringify(res.data.questions));
      sessionStorage.setItem(
        examStorageKey(termId, moduleId),
        JSON.stringify({
          config: cfg,
          meta: { termTitleEn: termTitle, moduleNameEn: module.nameEn },
        }),
      );
      navigate(`/student/mcq/${termId}/${moduleId}/exam`, { state: { fromCaseStart: true } });
    } catch {
      navigate(`/student/mcq/${termId}/${moduleId}/setup`, { replace: true });
    }
  };

  if (!accessChecked) {
    return (
      <div className="flex justify-center py-20">
        <p className="text-slate-500 text-sm">{t('loading')}</p>
      </div>
    );
  }

  if (!term || !module) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-slate-500">{t('error')}</p>
        <Link to="/student/mcq" className="text-teal-600 font-semibold mt-4 inline-block">
          {t('portalMcqTitle')}
        </Link>
      </div>
    );
  }

  const moduleName = isAr ? module.nameAr : module.nameEn;
  const termLabel = isAr ? term.titleAr : term.titleEn;

  const openTube = (id: TubeId) => {
    setActiveTube(id);
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    );
  };

  const toggleChapter = (chapter: string) => {
    setSelectedChapters((prev) =>
      prev.includes(chapter) ? prev.filter((c) => c !== chapter) : [...prev, chapter],
    );
  };

  const toggleRef = (ref: string) => {
    setSelectedRefs((prev) =>
      prev.includes(ref) ? prev.filter((r) => r !== ref) : [...prev, ref],
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
        <Link to="/student/mcq" className="hover:text-violet-600 dark:hover:text-violet-400">
          {t('portalMcqTitle')}
        </Link>
        <ChevronRight size={14} />
        <Link to={`/student/mcq/${termId}`} className="hover:text-violet-600 dark:hover:text-violet-400">
          {termId}
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-800 dark:text-slate-200 font-medium">{moduleName}</span>
        <ChevronRight size={14} />
        <span className="text-violet-600 dark:text-violet-400 font-semibold">{t('portalMcqExamSetup')}</span>
      </div>

      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => navigate(`/student/mcq/${termId}`)}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
          aria-label={t('back')}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t('portalMcqExamSetup')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {moduleName} · {termLabel}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <nav
          className="flex lg:flex-col gap-2 lg:w-[72px] shrink-0 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0"
          aria-label={t('portalMcqExamSetup')}
        >
          {TUBES.map(({ id, icon: Icon, labelKey }) => {
            const active = activeTube === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => openTube(id)}
                title={t(labelKey)}
                aria-expanded={active}
                aria-controls={`qbank-tube-${id}`}
                className={`flex lg:flex-col items-center justify-center gap-1.5 min-w-[64px] lg:min-w-0 lg:w-[72px] lg:py-4 px-3 py-3 rounded-2xl border-2 transition-all ${
                  active
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 shadow-md shadow-violet-500/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 hover:border-violet-300 dark:hover:border-violet-700'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wide text-center leading-tight max-w-[56px] hidden sm:block lg:block">
                  {t(labelKey)}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0">
          {activeTube === null ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40 p-10 text-center text-slate-500 dark:text-slate-400 text-sm">
              {t('portalMcqTubePick')}
            </div>
          ) : (
            <div
              id={`qbank-tube-${activeTube}`}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 shadow-sm overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40">
                <h2 className="font-bold text-slate-900 dark:text-white">
                  {t(TUBES.find((tube) => tube.id === activeTube)!.labelKey)}
                </h2>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                {activeTube === 'subjects' && (
                  <>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('portalMcqSubjectScopeDesc')}</p>
                    <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer hover:border-violet-300 dark:hover:border-violet-700">
                      <input
                        type="radio"
                        name="scope"
                        checked={scope === 'entire'}
                        onChange={() => setScope('entire')}
                        className="text-violet-600"
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-200">{t('portalMcqEntireModule')}</span>
                    </label>
                    <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer hover:border-violet-300 dark:hover:border-violet-700">
                      <input
                        type="radio"
                        name="scope"
                        checked={scope === 'specific'}
                        onChange={() => setScope('specific')}
                        className="text-violet-600 mt-1"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-slate-800 dark:text-slate-200 block mb-3">
                          {t('portalMcqSpecificSubjects')}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {module.subjects.map((subject) => (
                            <button
                              key={subject}
                              type="button"
                              disabled={scope !== 'specific'}
                              onClick={() => toggleSubject(subject)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                selectedSubjects.includes(subject)
                                  ? 'bg-violet-600 text-white border-violet-600'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                              } ${scope !== 'specific' ? 'opacity-50' : ''}`}
                            >
                              {subject}
                            </button>
                          ))}
                        </div>
                      </div>
                    </label>
                  </>
                )}

                {activeTube === 'chapters' && (
                  <>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedSubjects.map((s) => (
                        <span
                          key={s}
                          className="px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 text-xs font-semibold"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('portalMcqChooseChapters')}</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {(setupMeta?.chapters ?? []).map((chapter) => (
                        <label
                          key={chapter.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedChapters.includes(chapter.nameEn)}
                            onChange={() => toggleChapter(chapter.nameEn)}
                            className="rounded text-violet-600"
                          />
                          <span className="text-sm text-slate-800 dark:text-slate-200">{chapter.nameEn}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {activeTube === 'references' && (
                  <>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('portalMcqReferencesDesc')}</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {(setupMeta?.references ?? []).map((ref) => (
                        <label
                          key={ref.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRefs.includes(ref.nameEn)}
                            onChange={() => toggleRef(ref.nameEn)}
                            className="rounded text-violet-600"
                          />
                          <span className="text-sm text-slate-800 dark:text-slate-200">{ref.nameEn}</span>
                        </label>
                      ))}
                    </div>
                    <label className="flex items-center gap-3 p-4 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20 cursor-pointer mt-4">
                      <input
                        type="checkbox"
                        checked={examCoverage}
                        onChange={(e) => setExamCoverage(e.target.checked)}
                        className="rounded text-teal-600"
                      />
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white block">{t('portalMcqExamCoverage')}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{t('portalMcqExamCoverageDesc')}</span>
                      </div>
                    </label>
                  </>
                )}

                {activeTube === 'questions' && (
                  <>
                    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/30 px-4 py-3">
                      <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                        {availableTotal > 0
                          ? t('portalMcqAvailableQuestions', { count: availableTotal })
                          : t('portalMcqNoQuestionsAvailable')}
                      </p>
                      <p className="text-xs text-violet-600/80 dark:text-violet-300/80 mt-1">
                        {t('portalMcqAvailableQuestionsHint')}
                      </p>
                    </div>

                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('portalMcqQuestionCountDesc')}</p>
                    <div className="flex flex-wrap gap-2">
                      {QBANK_QUESTION_COUNTS.map((count) => {
                        const isAll = count === 'all';
                        const active =
                          !useCustomCount &&
                          (isAll ? questionCount === 'all' : questionCount === count);
                        return (
                          <button
                            key={String(count)}
                            type="button"
                            onClick={() => {
                              setUseCustomCount(false);
                              setQuestionCount(count);
                              if (!isAll && typeof count === 'number') {
                                setCustomCountInput(String(count));
                              }
                            }}
                            disabled={availableTotal === 0}
                            className={`min-w-[56px] px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              active
                                ? 'border-violet-500 bg-violet-600 text-white'
                                : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-violet-300'
                            }`}
                          >
                            {isAll ? t('portalMcqAll') : count}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2">
                      <label className="text-label block mb-1.5" htmlFor="qbank-custom-count">
                        {t('portalMcqCustomQuestionCount')}
                      </label>
                      <input
                        id="qbank-custom-count"
                        type="number"
                        min={1}
                        max={availableTotal || undefined}
                        value={customCountInput}
                        disabled={availableTotal === 0}
                        onChange={(e) => {
                          setUseCustomCount(true);
                          setCustomCountInput(e.target.value);
                        }}
                        onFocus={() => setUseCustomCount(true)}
                        placeholder={t('portalMcqEnterQuestionCount')}
                        className={`input w-full max-w-[200px] font-semibold tabular-nums ${
                          useCustomCount ? 'ring-2 ring-violet-500/30 border-violet-400' : ''
                        }`}
                      />
                      {useCustomCount && availableTotal > 0 && resolvedQuestionCount > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          {t('portalMcqWillUseQuestions', { count: resolvedQuestionCount })}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {activeTube === 'mode' && (
                  <>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{t('portalMcqModeDesc')}</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {(
                        [
                          {
                            id: 'practice' as const,
                            titleKey: 'portalMcqPracticeMode',
                            features: [
                              'portalMcqPracticeF1',
                              'portalMcqPracticeF2',
                              'portalMcqPracticeF3',
                              'portalMcqPracticeF4',
                            ],
                          },
                          {
                            id: 'exam' as const,
                            titleKey: 'portalMcqExamMode',
                            features: ['portalMcqExamF1', 'portalMcqExamF2', 'portalMcqExamF3', 'portalMcqExamF4'],
                          },
                        ] as const
                      ).map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setExamMode(mode.id)}
                          className={`text-start p-5 rounded-2xl border-2 transition-all ${
                            examMode === mode.id
                              ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 ring-2 ring-violet-500/20'
                              : 'border-slate-200 dark:border-slate-600 hover:border-violet-300'
                          }`}
                        >
                          <p className="font-bold text-slate-900 dark:text-white mb-3">{t(mode.titleKey)}</p>
                          <ul className="space-y-1.5">
                            {mode.features.map((f) => (
                              <li key={f} className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-violet-500 shrink-0" />
                                {t(f)}
                              </li>
                            ))}
                          </ul>
                        </button>
                      ))}
                    </div>

                    {examMode === 'exam' && (
                      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <label className="text-label block mb-1.5" htmlFor="qbank-exam-duration">
                          {t('portalMcqExamDuration')}
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          {t('portalMcqExamDurationHint')}
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <input
                            id="qbank-exam-duration"
                            type="number"
                            min={1}
                            max={600}
                            value={examDurationInput}
                            onChange={(e) => setExamDurationInput(e.target.value)}
                            className={`input w-full max-w-[160px] font-semibold tabular-nums ${
                              !examDurationValid ? 'border-red-400 ring-2 ring-red-500/20' : 'ring-2 ring-violet-500/20 border-violet-400'
                            }`}
                          />
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            {t('portalMcqMinutes')}
                          </span>
                        </div>
                        {!examDurationValid && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                            {t('portalMcqExamDurationInvalid')}
                          </p>
                        )}
                        {examDurationValid && (
                          <p className="text-xs text-violet-600 dark:text-violet-400 mt-2">
                            {t('portalMcqExamDurationSet', { minutes: examDurationMinutes })}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={startExam}
            disabled={resolvedQuestionCount <= 0 || !examDurationValid}
            className="mt-6 w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-colors"
          >
            <PlayCircle size={18} />
            {t('portalMcqStartExam')}
          </button>
        </div>
      </div>
    </div>
  );
}
