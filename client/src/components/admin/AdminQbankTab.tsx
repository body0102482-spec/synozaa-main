import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookMarked,
  ClipboardList,
  Download,
  FolderTree,
  Hash,
  Plus,
  Trash2,
  Upload,
  Pencil,
} from 'lucide-react';
import api from '../../lib/api';
import { AdminStickySaveBar } from './AdminStickySaveBar';
import { downloadTextFile } from '../../lib/download';
import { TagListInput } from './TagListInput';

type QbankTerm = {
  id: string;
  titleEn: string;
  titleAr: string;
  sortOrder: number;
  isActive: boolean;
  _count?: { modules: number };
};

type QbankModule = {
  id: string;
  termId: string;
  nameEn: string;
  nameAr: string;
  specialtyEn: string;
  specialtyAr: string;
  subjects: string[];
  free: boolean;
  bundled: boolean;
  priceEgp: number;
  sortOrder: number;
  isActive: boolean;
  universityIds?: string[];
  universities?: Array<{ id: string; nameEn: string; nameAr: string }>;
  _count?: { questions: number };
};

type PartnerUniversityOption = {
  id: string;
  nameEn: string;
  nameAr: string;
  isActive?: boolean;
};

type LookupRow = {
  id: string;
  nameEn: string;
  nameAr?: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { questions: number };
};

type QbankQuestion = {
  id: string;
  moduleId: string;
  chapterId: string;
  referenceId: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string | null;
  subjectTags: string[];
  isPublished: boolean;
  sortOrder: number;
  chapter?: { nameEn: string };
  reference?: { nameEn: string };
  module?: { id: string; nameEn: string; termId: string };
};

type ImportPreview = {
  total: number;
  validCount: number;
  invalidCount: number;
  invalid: Array<{ rowNum: number; errors: string[] }>;
  validPreview?: Array<{ text?: string; chapter?: string; reference?: string }>;
};

type ImportResult = {
  inserted: number;
  skipped: number;
  insertedPreview?: Array<{ text: string; chapter: string; reference: string }>;
};

type Section = 'terms' | 'lookups' | 'questions' | 'import';

const EMPTY_QUESTION = {
  moduleId: '',
  chapterId: '',
  referenceId: '',
  text: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  explanation: '',
  subjectTags: [] as string[],
  isPublished: true,
  sortOrder: 0,
};

export function AdminQbankTab() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [section, setSection] = useState<Section>('terms');
  const [terms, setTerms] = useState<QbankTerm[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [modules, setModules] = useState<QbankModule[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [chapters, setChapters] = useState<LookupRow[]>([]);
  const [references, setReferences] = useState<LookupRow[]>([]);
  const [partnerUniversities, setPartnerUniversities] = useState<PartnerUniversityOption[]>([]);
  const [questions, setQuestions] = useState<QbankQuestion[]>([]);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [termForm, setTermForm] = useState({ id: '', titleEn: '', titleAr: '', sortOrder: 0, isActive: true });
  const [editingTermId, setEditingTermId] = useState<string | null>(null);

  const [moduleForm, setModuleForm] = useState({
    id: '',
    nameEn: '',
    nameAr: '',
    specialtyEn: '',
    specialtyAr: '',
    subjects: [] as string[],
    free: false,
    bundled: false,
    priceEgp: 50,
    sortOrder: 0,
    isActive: true,
    universityIds: [] as string[],
  });
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  const [lookupForm, setLookupForm] = useState({ nameEn: '', nameAr: '', sortOrder: 0, isActive: true });
  const [lookupKind, setLookupKind] = useState<'chapters' | 'references'>('chapters');
  const [editingLookupId, setEditingLookupId] = useState<string | null>(null);

  const [questionForm, setQuestionForm] = useState(EMPTY_QUESTION);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const [csvContent, setCsvContent] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [structuredContent, setStructuredContent] = useState('');
  const [importMode, setImportMode] = useState<'csv' | 'structured'>('structured');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedImportSubject, setSelectedImportSubject] = useState('');

  const selectedModule = useMemo(
    () => modules.find((m) => m.id === selectedModuleId) ?? null,
    [modules, selectedModuleId],
  );
  const importSubjects = selectedModule?.subjects ?? [];

  const loadTerms = useCallback(async () => {
    const r = await api.get('/admin/qbank/terms');
    setTerms(r.data.terms);
    if (!selectedTermId && r.data.terms.length > 0) {
      setSelectedTermId(r.data.terms[0].id);
    }
  }, [selectedTermId]);

  const loadModules = useCallback(async (termId: string) => {
    if (!termId) return;
    const r = await api.get(`/admin/qbank/terms/${termId}/modules`);
    setModules(r.data.modules);
    if (!selectedModuleId && r.data.modules.length > 0) {
      setSelectedModuleId(r.data.modules[0].id);
    }
  }, [selectedModuleId]);

  const loadLookups = useCallback(async () => {
    const [ch, ref, uni] = await Promise.all([
      api.get('/admin/qbank/chapters'),
      api.get('/admin/qbank/references'),
      api.get('/admin/universities'),
    ]);
    setChapters(ch.data.chapters);
    setReferences(ref.data.references);
    setPartnerUniversities(uni.data.universities ?? []);
  }, []);

  const loadQuestions = useCallback(async (termId: string, moduleId: string) => {
    const params = new URLSearchParams();
    if (termId) params.set('termId', termId);
    if (moduleId) params.set('moduleId', moduleId);
    params.set('pageSize', '50');
    const r = await api.get(`/admin/qbank/questions?${params}`);
    setQuestions(r.data.questions);
    setQuestionTotal(r.data.total);
  }, []);

  useEffect(() => {
    void loadTerms().catch(() => setError(t('adminQbankLoadError')));
    void loadLookups().catch(() => setError(t('adminQbankLoadError')));
  }, [loadTerms, loadLookups, t]);

  useEffect(() => {
    if (selectedTermId) void loadModules(selectedTermId).catch(() => setError(t('adminQbankLoadError')));
  }, [selectedTermId, loadModules, t]);

  useEffect(() => {
    if (!selectedImportSubject) return;
    if (!importSubjects.includes(selectedImportSubject)) {
      setSelectedImportSubject('');
    }
  }, [importSubjects, selectedImportSubject]);

  useEffect(() => {
    if (section === 'questions') {
      void loadQuestions(selectedTermId, selectedModuleId).catch(() => setError(t('adminQbankLoadError')));
    }
  }, [section, selectedTermId, selectedModuleId, loadQuestions, t]);

  const saveTerm = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingTermId) {
        await api.put(`/admin/qbank/terms/${editingTermId}`, termForm);
      } else {
        await api.post('/admin/qbank/terms', termForm);
      }
      setTermForm({ id: '', titleEn: '', titleAr: '', sortOrder: 0, isActive: true });
      setEditingTermId(null);
      await loadTerms();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('adminQbankSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const saveModule = async () => {
    if (!selectedTermId) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...moduleForm,
        subjects: moduleForm.subjects,
      };
      if (editingModuleId) {
        await api.put(`/admin/qbank/modules/${editingModuleId}`, payload);
      } else {
        await api.post(`/admin/qbank/terms/${selectedTermId}/modules`, payload);
      }
      setModuleForm({
        id: '',
        nameEn: '',
        nameAr: '',
        specialtyEn: '',
        specialtyAr: '',
        subjects: [],
        free: false,
        bundled: false,
        priceEgp: 50,
        sortOrder: 0,
        isActive: true,
        universityIds: [],
      });
      setEditingModuleId(null);
      await loadModules(selectedTermId);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('adminQbankSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const saveLookup = async () => {
    setSaving(true);
    setError('');
    try {
      const path = lookupKind === 'chapters' ? '/admin/qbank/chapters' : '/admin/qbank/references';
      if (editingLookupId) {
        await api.put(`${path}/${editingLookupId}`, lookupForm);
      } else {
        await api.post(path, lookupForm);
      }
      setLookupForm({ nameEn: '', nameAr: '', sortOrder: 0, isActive: true });
      setEditingLookupId(null);
      await loadLookups();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('adminQbankSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const saveQuestion = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...questionForm,
        moduleId: questionForm.moduleId || selectedModuleId,
        subjectTags: questionForm.subjectTags,
      };
      if (editingQuestionId) {
        await api.put(`/admin/qbank/questions/${editingQuestionId}`, payload);
      } else {
        await api.post('/admin/qbank/questions', payload);
      }
      setQuestionForm({ ...EMPTY_QUESTION, moduleId: selectedModuleId });
      setEditingQuestionId(null);
      await loadQuestions(selectedTermId, selectedModuleId);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('adminQbankSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const downloadImportTemplate = async () => {
    setError('');
    try {
      const r = await api.get('/admin/qbank/questions/import/template', { responseType: 'text' });
      downloadTextFile('qbank-import-template.csv', r.data);
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('adminQbankTemplateError'));
    }
  };

  const previewImport = async () => {
    setSaving(true);
    setError('');
    setImportResult(null);
    try {
      const r = await api.post('/admin/qbank/questions/import/preview', { csvContent });
      setImportPreview(r.data);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('adminQbankImportError'));
    } finally {
      setSaving(false);
    }
  };

  const commitImport = async () => {
    setSaving(true);
    setError('');
    try {
      const r = await api.post('/admin/qbank/questions/import/commit', { csvContent });
      setImportResult({ inserted: r.data.inserted, skipped: r.data.skipped });
      setImportPreview(null);
      await loadQuestions(selectedTermId, selectedModuleId);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('adminQbankImportError'));
    } finally {
      setSaving(false);
    }
  };

  const previewStructuredImport = async () => {
    if (!selectedTermId || !selectedModuleId) {
      setError(t('adminQbankImportSelectModule'));
      return;
    }
    setSaving(true);
    setError('');
    setImportResult(null);
    try {
      const r = await api.post('/admin/qbank/questions/import/structured/preview', {
        content: structuredContent,
        termId: selectedTermId,
        moduleId: selectedModuleId,
        subject: selectedImportSubject || undefined,
        autoCreateLookups: true,
      });
      setImportPreview(r.data);
      if (r.data.parseErrors?.length) {
        setError(r.data.parseErrors.join(' '));
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('adminQbankImportError'));
    } finally {
      setSaving(false);
    }
  };

  const commitStructuredImport = async () => {
    if (!selectedTermId || !selectedModuleId) {
      setError(t('adminQbankImportSelectModule'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const r = await api.post('/admin/qbank/questions/import/structured/commit', {
        content: structuredContent,
        termId: selectedTermId,
        moduleId: selectedModuleId,
        subject: selectedImportSubject || undefined,
        autoCreateLookups: true,
      });
      setImportResult({
        inserted: r.data.inserted,
        skipped: r.data.skipped,
        insertedPreview: r.data.insertedPreview || [],
      });
      setImportPreview(null);
      await loadQuestions(selectedTermId, selectedModuleId);
      await loadLookups();
      if (r.data.parseErrors?.length) {
        setError(r.data.parseErrors.join(' '));
      }
      if (r.data.inserted > 0) {
        setSection('questions');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('adminQbankImportError'));
    } finally {
      setSaving(false);
    }
  };

  const sectionBtn = (id: Section, label: string, Icon: typeof FolderTree) => (
    <button
      type="button"
      key={id}
      onClick={() => setSection(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
        section === id
          ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300'
          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white">{t('adminQbankTitle')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('adminQbankDesc')}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {sectionBtn('terms', t('adminQbankTermsModules'), FolderTree)}
        {sectionBtn('lookups', t('adminQbankChaptersRefs'), BookMarked)}
        {sectionBtn('questions', t('adminQbankQuestions'), Hash)}
        {sectionBtn('import', t('adminQbankImport'), Upload)}
      </div>

      {section === 'terms' && (
        <div className="grid xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
          <div className="card p-6 space-y-3">
            <h3 className="font-semibold">{t('adminQbankTerms')}</h3>
            {terms.map((term) => (
              <button
                key={term.id}
                type="button"
                onClick={() => setSelectedTermId(term.id)}
                className={`w-full text-left p-3 rounded-lg border ${
                  selectedTermId === term.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <p className="font-medium">{term.titleEn}</p>
                <p className="text-xs text-slate-500">{term.id} · {term._count?.modules ?? 0} modules</p>
              </button>
            ))}
            <div className="border-t pt-4 space-y-2">
              <input className="input-field" placeholder="ID (401)" value={termForm.id} disabled={!!editingTermId} onChange={(e) => setTermForm({ ...termForm, id: e.target.value })} />
              <input className="input-field" placeholder="Title EN" value={termForm.titleEn} onChange={(e) => setTermForm({ ...termForm, titleEn: e.target.value })} />
              <input className="input-field" placeholder="Title AR" value={termForm.titleAr} onChange={(e) => setTermForm({ ...termForm, titleAr: e.target.value })} />
              <button type="button" onClick={saveTerm} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                <Plus size={16} /> {editingTermId ? t('save') : t('add')}
              </button>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="font-semibold">{t('adminQbankModules')} — {selectedTermId}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2">ID</th>
                    <th>Name</th>
                    <th>Universities</th>
                    <th>Price</th>
                    <th>Qs</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod) => (
                    <tr key={mod.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 font-mono text-xs">{mod.id}</td>
                      <td>{mod.nameEn}{mod.free ? ' (free)' : ''}{mod.bundled ? ' (bundled)' : ''}</td>
                      <td className="text-xs text-slate-500 max-w-[180px]">
                        {!mod.universityIds?.length
                          ? t('adminQbankGlobalModule')
                          : (mod.universities ?? [])
                              .map((u) => (isAr ? u.nameAr : u.nameEn))
                              .join(', ')}
                      </td>
                      <td>{mod.priceEgp} EGP</td>
                      <td>{mod._count?.questions ?? 0}</td>
                      <td className="text-end">
                        <button type="button" className="text-violet-600 p-1" onClick={() => {
                          setEditingModuleId(mod.id);
                          setModuleForm({
                            id: mod.id,
                            nameEn: mod.nameEn,
                            nameAr: mod.nameAr,
                            specialtyEn: mod.specialtyEn,
                            specialtyAr: mod.specialtyAr,
                            subjects: mod.subjects,
                            free: mod.free,
                            bundled: mod.bundled,
                            priceEgp: mod.priceEgp,
                            sortOrder: mod.sortOrder,
                            isActive: mod.isActive,
                            universityIds: mod.universityIds ?? [],
                          });
                        }}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" className="text-red-600 p-1" onClick={async () => {
                          if (!window.confirm(t('adminQbankDeleteConfirm'))) return;
                          await api.delete(`/admin/qbank/modules/${mod.id}`);
                          await loadModules(selectedTermId);
                        }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <input className="input-field" placeholder="Module ID" value={moduleForm.id} disabled={!!editingModuleId} onChange={(e) => setModuleForm({ ...moduleForm, id: e.target.value })} />
              <input className="input-field" placeholder="Name EN" value={moduleForm.nameEn} onChange={(e) => setModuleForm({ ...moduleForm, nameEn: e.target.value })} />
              <input className="input-field" placeholder="Name AR" value={moduleForm.nameAr} onChange={(e) => setModuleForm({ ...moduleForm, nameAr: e.target.value })} />
              <div className="sm:col-span-2">
                <p className="text-sm font-medium mb-2">{t('adminQbankModuleSubjects')}</p>
                <TagListInput
                  value={moduleForm.subjects}
                  onChange={(subjects) => setModuleForm({ ...moduleForm, subjects })}
                  placeholder={t('adminQbankModuleSubjectsPlaceholder')}
                />
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm font-medium mb-1">{t('adminQbankModuleUniversities')}</p>
                <p className="text-xs text-slate-500 mb-2">{t('adminQbankModuleUniversitiesHint')}</p>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  {partnerUniversities.filter((u) => u.isActive !== false).map((uni) => {
                    const checked = moduleForm.universityIds.includes(uni.id);
                    return (
                      <label key={uni.id} className="flex items-center gap-2 text-sm rounded-lg border border-slate-100 dark:border-slate-800 px-2 py-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setModuleForm((prev) => ({
                              ...prev,
                              universityIds: checked
                                ? prev.universityIds.filter((id) => id !== uni.id)
                                : [...prev.universityIds, uni.id],
                            }));
                          }}
                        />
                        {isAr ? uni.nameAr : uni.nameEn}
                      </label>
                    );
                  })}
                </div>
              </div>
              <input type="number" className="input-field" placeholder="Price EGP" value={moduleForm.priceEgp} onChange={(e) => setModuleForm({ ...moduleForm, priceEgp: Number(e.target.value) })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={moduleForm.free} onChange={(e) => setModuleForm({ ...moduleForm, free: e.target.checked })} /> Free</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={moduleForm.bundled} onChange={(e) => setModuleForm({ ...moduleForm, bundled: e.target.checked })} /> Bundled</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={moduleForm.isActive} onChange={(e) => setModuleForm({ ...moduleForm, isActive: e.target.checked })} /> Active</label>
            </div>
            <button type="button" onClick={saveModule} disabled={saving} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> {editingModuleId ? t('save') : t('adminQbankAddModule')}
            </button>
          </div>
          {(editingModuleId || moduleForm.nameEn.trim() || moduleForm.id.trim()) && (
            <AdminStickySaveBar
              onSave={() => void saveModule()}
              saving={saving}
              disabled={!moduleForm.id.trim() || !moduleForm.nameEn.trim()}
              saveLabel={editingModuleId ? t('save') : t('adminQbankAddModule')}
            />
          )}
        </div>
      )}

      {section === 'lookups' && (
        <div className="grid md:grid-cols-2 gap-6">
          {(['chapters', 'references'] as const).map((kind) => (
            <div key={kind} className="card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{kind === 'chapters' ? t('adminQbankChapters') : t('adminQbankReferences')}</h3>
                <button type="button" className="text-xs text-violet-600" onClick={() => { setLookupKind(kind); setEditingLookupId(null); setLookupForm({ nameEn: '', nameAr: '', sortOrder: 0, isActive: true }); }}>
                  {t('add')}
                </button>
              </div>
              {(kind === 'chapters' ? chapters : references).map((row) => (
                <div key={row.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span>{row.nameEn} <span className="text-xs text-slate-400">({row._count?.questions ?? 0})</span></span>
                  <div className="flex gap-1">
                    <button type="button" className="text-violet-600" onClick={() => { setLookupKind(kind); setEditingLookupId(row.id); setLookupForm({ nameEn: row.nameEn, nameAr: row.nameAr || '', sortOrder: row.sortOrder, isActive: row.isActive }); }}><Pencil size={14} /></button>
                    <button type="button" className="text-red-600" onClick={async () => {
                      if (!window.confirm(t('adminQbankDeleteConfirm'))) return;
                      await api.delete(`/admin/qbank/${kind}/${row.id}`);
                      await loadLookups();
                    }}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="md:col-span-2 card p-6 space-y-2">
            <p className="text-sm font-medium">{lookupKind === 'chapters' ? t('adminQbankEditChapter') : t('adminQbankEditReference')}</p>
            <input className="input-field" placeholder="Name EN" value={lookupForm.nameEn} onChange={(e) => setLookupForm({ ...lookupForm, nameEn: e.target.value })} />
            <input className="input-field" placeholder="Name AR" value={lookupForm.nameAr} onChange={(e) => setLookupForm({ ...lookupForm, nameAr: e.target.value })} />
            <button type="button" onClick={saveLookup} disabled={saving} className="btn-primary">{editingLookupId ? t('save') : t('add')}</button>
          </div>
        </div>
      )}

      {section === 'questions' && (
        <div className="space-y-6">
          {importResult && importResult.inserted > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
              <p className="font-semibold">{t('adminQbankImportDone', { inserted: importResult.inserted, skipped: importResult.skipped })}</p>
              <p className="text-xs mt-1 text-emerald-700/80 dark:text-emerald-300/80">
                Showing questions for the selected module below. Empty Source rows use reference &quot;Previous Years&quot;.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <select className="input-field w-auto" value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)}>
              {terms.map((term) => <option key={term.id} value={term.id}>{term.titleEn}</option>)}
            </select>
            <select className="input-field w-auto" value={selectedModuleId} onChange={(e) => setSelectedModuleId(e.target.value)}>
              {modules.map((mod) => <option key={mod.id} value={mod.id}>{mod.nameEn}</option>)}
            </select>
            <span className="text-sm text-slate-500 self-center">{questionTotal} {t('adminQbankQuestionsCount')}</span>
          </div>

          <div className="card p-6 space-y-3 max-h-96 overflow-y-auto">
            {questions.map((q) => (
              <div key={q.id} className="border border-slate-100 dark:border-slate-800 rounded-lg p-3">
                <p className="text-sm font-medium line-clamp-2">{q.text}</p>
                <p className="text-xs text-slate-500 mt-1">{q.chapter?.nameEn} · {q.reference?.nameEn} · {q.isPublished ? t('active') : t('inactive')}</p>
                <div className="flex gap-2 mt-2">
                  <button type="button" className="text-violet-600 text-xs font-semibold" onClick={() => {
                    setEditingQuestionId(q.id);
                    setQuestionForm({
                      moduleId: q.moduleId,
                      chapterId: q.chapterId,
                      referenceId: q.referenceId,
                      text: q.text,
                      options: [...q.options],
                      correctIndex: q.correctIndex,
                      explanation: q.explanation ?? '',
                      subjectTags: q.subjectTags,
                      isPublished: q.isPublished,
                      sortOrder: q.sortOrder,
                    });
                  }}>{t('edit')}</button>
                  <button type="button" className="text-red-600 text-xs font-semibold" onClick={async () => {
                    if (!window.confirm(t('adminQbankDeleteConfirm'))) return;
                    await api.delete(`/admin/qbank/questions/${q.id}`);
                    await loadQuestions(selectedTermId, selectedModuleId);
                  }}>{t('delete')}</button>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-6 space-y-3">
            <h3 className="font-semibold">{editingQuestionId ? t('adminQbankEditQuestion') : t('adminQbankAddQuestion')}</h3>
            <textarea className="input-field min-h-[80px]" placeholder="Question text" value={questionForm.text} onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })} />
            <div className="grid sm:grid-cols-2 gap-2">
              <select className="input-field" value={questionForm.chapterId} onChange={(e) => setQuestionForm({ ...questionForm, chapterId: e.target.value })}>
                <option value="">{t('adminQbankSelectChapter')}</option>
                {chapters.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
              </select>
              <select className="input-field" value={questionForm.referenceId} onChange={(e) => setQuestionForm({ ...questionForm, referenceId: e.target.value })}>
                <option value="">{t('adminQbankSelectReference')}</option>
                {references.map((r) => <option key={r.id} value={r.id}>{r.nameEn}</option>)}
              </select>
            </div>
            {questionForm.options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input type="radio" name="correct" checked={questionForm.correctIndex === idx} onChange={() => setQuestionForm({ ...questionForm, correctIndex: idx })} />
                <input className="input-field flex-1" placeholder={`Option ${String.fromCharCode(65 + idx)}`} value={opt} onChange={(e) => {
                  const next = [...questionForm.options];
                  next[idx] = e.target.value;
                  setQuestionForm({ ...questionForm, options: next });
                }} />
              </div>
            ))}
            <div>
              <p className="text-sm font-medium mb-2">{t('adminQbankExplanation')}</p>
              <textarea
                className="input-field min-h-[140px] font-mono text-xs sm:text-sm"
                placeholder={t('adminQbankExplanationPlaceholder')}
                value={questionForm.explanation}
                onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
              />
              <p className="text-[11px] text-slate-500 mt-1">{t('adminQbankExplanationHint')}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{t('adminQbankSubjectTags')}</p>
              <TagListInput
                value={questionForm.subjectTags}
                onChange={(subjectTags) => setQuestionForm({ ...questionForm, subjectTags })}
                placeholder={t('adminQbankSubjectTagsPlaceholder')}
              />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={questionForm.isPublished} onChange={(e) => setQuestionForm({ ...questionForm, isPublished: e.target.checked })} /> {t('adminQbankPublished')}</label>
            <button type="button" onClick={saveQuestion} disabled={saving} className="btn-primary">{editingQuestionId ? t('save') : t('add')}</button>
          </div>
          {(editingQuestionId || questionForm.text.trim()) && (
            <AdminStickySaveBar
              onSave={() => void saveQuestion()}
              saving={saving}
              disabled={!questionForm.text.trim() || !questionForm.moduleId}
              saveLabel={editingQuestionId ? t('save') : t('add')}
            />
          )}
        </div>
      )}

      {section === 'import' && (
        <div className="card p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setImportMode('structured'); setImportPreview(null); setImportResult(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${importMode === 'structured' ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
            >
              {t('adminQbankStructuredImport')}
            </button>
            <button
              type="button"
              onClick={() => { setImportMode('csv'); setImportPreview(null); setImportResult(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${importMode === 'csv' ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
            >
              {t('adminQbankCsvImport')}
            </button>
          </div>

          {importMode === 'structured' ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('adminQbankStructuredHint')}</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <select className="input-field" value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)}>
                  <option value="">{t('adminQbankSelectTerm')}</option>
                  {terms.map((term) => <option key={term.id} value={term.id}>{term.titleEn} ({term.id})</option>)}
                </select>
                <select className="input-field" value={selectedModuleId} onChange={(e) => setSelectedModuleId(e.target.value)}>
                  <option value="">{t('adminQbankSelectModule')}</option>
                  {modules.filter((m) => m.termId === selectedTermId).map((mod) => (
                    <option key={mod.id} value={mod.id}>{mod.nameEn} ({mod.id})</option>
                  ))}
                </select>
                <select
                  className="input-field"
                  value={selectedImportSubject}
                  onChange={(e) => setSelectedImportSubject(e.target.value)}
                  disabled={!selectedModuleId}
                >
                  <option value="">{t('adminQbankSelectSubject')}</option>
                  {importSubjects.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
              {selectedModuleId && importSubjects.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">{t('adminQbankNoModuleSubjects')}</p>
              )}
              <textarea
                className="input-field min-h-[320px] font-mono text-xs"
                placeholder={t('adminQbankStructuredPlaceholder')}
                value={structuredContent}
                onChange={(e) => setStructuredContent(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="button" onClick={previewStructuredImport} disabled={saving || !structuredContent.trim()} className="btn-secondary">{t('adminQbankPreviewImport')}</button>
                <button type="button" onClick={commitStructuredImport} disabled={saving || !structuredContent.trim()} className="btn-primary">{t('adminQbankCommitImport')}</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('adminQbankCsvHint')}</p>
              <button type="button" onClick={downloadImportTemplate} className="btn-secondary inline-flex items-center gap-2">
                <Download size={16} />
                {t('adminQbankDownloadTemplate')}
              </button>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('adminQbankCsvUpload')}</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="block w-full text-sm text-slate-600 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:file:text-slate-200"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setCsvFileName(file.name);
                    setImportPreview(null);
                    setImportResult(null);
                    const reader = new FileReader();
                    reader.onload = () => setCsvContent(String(reader.result ?? ''));
                    reader.readAsText(file);
                  }}
                />
                {csvFileName && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('adminQbankCsvSelected', { fileName: csvFileName })}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={previewImport} disabled={saving || !csvContent.trim()} className="btn-secondary">{t('adminQbankPreviewImport')}</button>
                <button type="button" onClick={commitImport} disabled={saving || !csvContent.trim()} className="btn-primary">{t('adminQbankCommitImport')}</button>
              </div>
            </>
          )}

          {importPreview && (
            <div className="text-sm space-y-2">
              <p>{t('adminQbankImportSummary', { valid: importPreview.validCount, invalid: importPreview.invalidCount, total: importPreview.total })}</p>
              {importPreview.invalid.slice(0, 10).map((row) => (
                <p key={row.rowNum} className="text-red-600">Row {row.rowNum}: {row.errors.join('; ')}</p>
              ))}
              {!!importPreview.validPreview?.length && (
                <ul className="space-y-1 text-slate-600 dark:text-slate-300 max-h-48 overflow-y-auto">
                  {importPreview.validPreview.map((row, idx) => (
                    <li key={`${idx}-${row.text}`} className="text-xs border-b border-slate-100 dark:border-slate-800 py-1">
                      <span className="font-semibold">{idx + 1}.</span> {row.text}
                      <span className="text-slate-400"> · {row.chapter} · {row.reference}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {importResult && (
            <div className="space-y-2">
              <p className="text-emerald-600 text-sm">{t('adminQbankImportDone', { inserted: importResult.inserted, skipped: importResult.skipped })}</p>
              {!!importResult.insertedPreview?.length && (
                <ul className="space-y-1 text-slate-600 dark:text-slate-300 text-xs max-h-48 overflow-y-auto">
                  {importResult.insertedPreview.map((row, idx) => (
                    <li key={`${idx}-${row.text}`} className="border-b border-slate-100 dark:border-slate-800 py-1">
                      <span className="font-semibold">{idx + 1}.</span> {row.text}
                      <span className="text-slate-400"> · {row.chapter} · {row.reference}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
