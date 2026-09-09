import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Save,
  Stethoscope,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import api from '../../lib/api';

type RoleFilter = 'PATIENT' | 'EXAMINER';
type KindFilter = 'PROMPT' | 'FILE' | 'MEDIA';
type ScopeFilter = 'category' | 'case';

type CategoryOpt = { id: string; nameEn: string; nameAr: string; parentId?: string | null };
type CaseOpt = { id: string; titleEn: string; titleAr: string };

type AiKnowledgeEntry = {
  id: string;
  role: RoleFilter;
  kind: KindFilter;
  titleEn: string;
  titleAr: string;
  content: string;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  categoryId?: string | null;
  caseId?: string | null;
  isActive: boolean;
  sortOrder: number;
  category?: CategoryOpt | null;
  case?: CaseOpt | null;
};

type FormState = {
  id?: string;
  role: RoleFilter;
  kind: KindFilter;
  titleEn: string;
  titleAr: string;
  content: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  categoryId: string;
  caseId: string;
  isActive: boolean;
  sortOrder: number;
};

const emptyForm = (role: RoleFilter): FormState => ({
  role,
  kind: 'PROMPT',
  titleEn: '',
  titleAr: '',
  content: '',
  fileUrl: '',
  fileName: '',
  mimeType: '',
  categoryId: '',
  caseId: '',
  isActive: true,
  sortOrder: 0,
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 || '');
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function AdminKnowledgeAiTab() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

  const [role, setRole] = useState<RoleFilter>('PATIENT');
  const [scope, setScope] = useState<ScopeFilter>('category');
  const [kindFilter, setKindFilter] = useState<'ALL' | KindFilter>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');

  const [categories, setCategories] = useState<CategoryOpt[]>([]);
  const [cases, setCases] = useState<CaseOpt[]>([]);
  const [entries, setEntries] = useState<AiKnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm('PATIENT'));

  const loadMeta = useCallback(async () => {
    const [catRes, caseRes] = await Promise.all([
      api.get('/admin/categories'),
      api.get('/admin/cases'),
    ]);
    const cats = (catRes.data.categories || []) as CategoryOpt[];
    setCategories(cats);
    setCases(
      ((caseRes.data.cases || []) as CaseOpt[]).map((c) => ({
        id: c.id,
        titleEn: c.titleEn,
        titleAr: c.titleAr,
      })),
    );
    setSelectedCategoryId((prev) => prev || cats[0]?.id || '');
    setSelectedCaseId((prev) => prev || (caseRes.data.cases?.[0]?.id as string) || '');
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { role, scope };
      if (kindFilter !== 'ALL') params.kind = kindFilter;
      if (scope === 'category' && selectedCategoryId) params.categoryId = selectedCategoryId;
      if (scope === 'case' && selectedCaseId) params.caseId = selectedCaseId;
      const res = await api.get('/admin/ai-knowledge', { params });
      setEntries(res.data.entries || []);
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('adminAiKbLoadError'));
    } finally {
      setLoading(false);
    }
  }, [role, scope, kindFilter, selectedCategoryId, selectedCaseId, t]);

  useEffect(() => {
    void loadMeta().catch(() => setError(t('adminAiKbLoadError')));
  }, [loadMeta, t]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const categoryLabel = useCallback(
    (c: CategoryOpt) => (isAr ? c.nameAr || c.nameEn : c.nameEn),
    [isAr],
  );
  const caseLabel = useCallback(
    (c: CaseOpt) => (isAr ? c.titleAr || c.titleEn : c.titleEn),
    [isAr],
  );

  const openCreate = () => {
    const next = emptyForm(role);
    if (scope === 'category') next.categoryId = selectedCategoryId;
    if (scope === 'case') next.caseId = selectedCaseId;
    setForm(next);
    setShowForm(true);
    setMessage('');
    setError('');
  };

  const openEdit = (entry: AiKnowledgeEntry) => {
    setForm({
      id: entry.id,
      role: entry.role,
      kind: entry.kind,
      titleEn: entry.titleEn,
      titleAr: entry.titleAr || '',
      content: entry.content || '',
      fileUrl: entry.fileUrl || '',
      fileName: entry.fileName || '',
      mimeType: entry.mimeType || '',
      categoryId: entry.categoryId || '',
      caseId: entry.caseId || '',
      isActive: entry.isActive,
      sortOrder: entry.sortOrder,
    });
    setShowForm(true);
    setMessage('');
    setError('');
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const dataBase64 = await fileToBase64(file);
      const folder =
        scope === 'case'
          ? `case-${selectedCaseId || 'draft'}`
          : `category-${selectedCategoryId || 'general'}`;
      const res = await api.post('/admin/ai-knowledge/upload', {
        fileName: file.name,
        mimeType: file.type,
        dataBase64,
        folder,
      });
      setForm((f) => ({
        ...f,
        fileUrl: res.data.url || '',
        fileName: res.data.fileName || file.name,
        mimeType: res.data.mimeType || file.type,
        content: f.content || res.data.excerpt || '',
      }));
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('adminAiKbUploadError'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        role: form.role,
        kind: form.kind,
        titleEn: form.titleEn.trim(),
        titleAr: form.titleAr.trim(),
        content: form.content,
        fileUrl: form.fileUrl || null,
        fileName: form.fileName || null,
        mimeType: form.mimeType || null,
        categoryId: scope === 'category' ? form.categoryId || selectedCategoryId || null : null,
        caseId: scope === 'case' ? form.caseId || selectedCaseId || null : null,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      };

      if (!payload.titleEn) throw new Error(t('adminAiKbTitleRequired'));
      if (scope === 'category' && !payload.categoryId) throw new Error(t('adminAiKbCategoryRequired'));
      if (scope === 'case' && !payload.caseId) throw new Error(t('adminAiKbCaseRequired'));

      if (form.id) {
        await api.put(`/admin/ai-knowledge/${form.id}`, payload);
      } else {
        await api.post('/admin/ai-knowledge', payload);
      }
      setShowForm(false);
      setMessage(t('adminAiKbSaved'));
      await loadEntries();
    } catch (err) {
      const apiErr = (err as { response?: { data?: { error?: string } }; message?: string })?.response
        ?.data?.error;
      setError(apiErr || (err as Error).message || t('adminAiKbSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t('adminAiKbDeleteConfirm'))) return;
    setError('');
    try {
      await api.delete(`/admin/ai-knowledge/${id}`);
      setMessage(t('adminAiKbDeleted'));
      await loadEntries();
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('adminAiKbSaveError'));
    }
  };

  const kindIcon = (kind: KindFilter) => {
    if (kind === 'PROMPT') return <Bot size={16} className="text-violet-500" />;
    if (kind === 'FILE') return <FileText size={16} className="text-amber-500" />;
    return <Film size={16} className="text-sky-500" />;
  };

  const filteredHint = useMemo(() => {
    if (scope === 'category') {
      const cat = categories.find((c) => c.id === selectedCategoryId);
      return cat ? categoryLabel(cat) : t('adminAiKbPickCategory');
    }
    const c = cases.find((x) => x.id === selectedCaseId);
    return c ? caseLabel(c) : t('adminAiKbPickCase');
  }, [scope, categories, cases, selectedCategoryId, selectedCaseId, categoryLabel, caseLabel, t]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('adminAiKbTitle')}</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">{t('adminAiKbDesc')}</p>
          </div>
          <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2 shrink-0">
            <Plus size={16} /> {t('adminAiKbAdd')}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(
            [
              { id: 'PATIENT' as const, label: t('adminAiKbPatient'), icon: UserRound },
              { id: 'EXAMINER' as const, label: t('adminAiKbExaminer'), icon: Stethoscope },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setRole(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                role === id
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-400'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="text-slate-500 mb-1 block">{t('adminAiKbScope')}</span>
            <select
              className="input-field"
              value={scope}
              onChange={(e) => setScope(e.target.value as ScopeFilter)}
            >
              <option value="category">{t('adminAiKbScopeCategory')}</option>
              <option value="case">{t('adminAiKbScopeCase')}</option>
            </select>
          </label>

          {scope === 'category' ? (
            <label className="block text-sm sm:col-span-1 lg:col-span-2">
              <span className="text-slate-500 mb-1 block">{t('categories')}</span>
              <select
                className="input-field"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
              >
                <option value="">{t('adminAiKbPickCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block text-sm sm:col-span-1 lg:col-span-2">
              <span className="text-slate-500 mb-1 block">{t('cases')}</span>
              <select
                className="input-field"
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
              >
                <option value="">{t('adminAiKbPickCase')}</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {caseLabel(c)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-sm">
            <span className="text-slate-500 mb-1 block">{t('adminAiKbKind')}</span>
            <select
              className="input-field"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as 'ALL' | KindFilter)}
            >
              <option value="ALL">{t('adminAiKbKindAll')}</option>
              <option value="PROMPT">{t('adminAiKbKindPrompt')}</option>
              <option value="FILE">{t('adminAiKbKindFile')}</option>
              <option value="MEDIA">{t('adminAiKbKindMedia')}</option>
            </select>
          </label>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          {t('adminAiKbFiltering')}: <span className="font-medium text-slate-700 dark:text-slate-300">{filteredHint}</span>
        </p>
      </div>

      {(error || message) && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            error
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}
        >
          {error || message}
        </div>
      )}

      {showForm && (
        <div className="card p-5 sm:p-6 space-y-4 border-teal-200/70 dark:border-teal-900">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {form.id ? t('adminAiKbEdit') : t('adminAiKbAdd')}
            </h3>
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => setShowForm(false)}>
              <X size={16} /> {t('cancel')}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-500 mb-1 block">{t('adminAiKbRole')}</span>
              <select
                className="input-field"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as RoleFilter }))}
              >
                <option value="PATIENT">{t('adminAiKbPatient')}</option>
                <option value="EXAMINER">{t('adminAiKbExaminer')}</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-500 mb-1 block">{t('adminAiKbKind')}</span>
              <select
                className="input-field"
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as KindFilter }))}
              >
                <option value="PROMPT">{t('adminAiKbKindPrompt')}</option>
                <option value="FILE">{t('adminAiKbKindFile')}</option>
                <option value="MEDIA">{t('adminAiKbKindMedia')}</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-500 mb-1 block">{t('adminAiKbTitleEn')}</span>
              <input
                className="input-field"
                value={form.titleEn}
                onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500 mb-1 block">{t('adminAiKbTitleAr')}</span>
              <input
                className="input-field"
                value={form.titleAr}
                onChange={(e) => setForm((f) => ({ ...f, titleAr: e.target.value }))}
                dir="rtl"
              />
            </label>
          </div>

          {scope === 'category' ? (
            <label className="block text-sm">
              <span className="text-slate-500 mb-1 block">{t('categories')}</span>
              <select
                className="input-field"
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="">{t('adminAiKbPickCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block text-sm">
              <span className="text-slate-500 mb-1 block">{t('cases')}</span>
              <select
                className="input-field"
                value={form.caseId}
                onChange={(e) => setForm((f) => ({ ...f, caseId: e.target.value }))}
              >
                <option value="">{t('adminAiKbPickCase')}</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {caseLabel(c)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-sm">
            <span className="text-slate-500 mb-1 block">
              {form.kind === 'PROMPT'
                ? t('adminAiKbPromptContent')
                : form.kind === 'FILE'
                  ? t('adminAiKbFileNotes')
                  : t('adminAiKbMediaCaption')}
            </span>
            <textarea
              className="input-field min-h-[140px]"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder={
                form.kind === 'PROMPT'
                  ? t('adminAiKbPromptPlaceholder')
                  : form.kind === 'FILE'
                    ? t('adminAiKbFileNotesPlaceholder')
                    : t('adminAiKbMediaCaptionPlaceholder')
              }
            />
          </label>

          {(form.kind === 'FILE' || form.kind === 'MEDIA') && (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {form.kind === 'MEDIA' ? t('adminAiKbUploadMedia') : t('adminAiKbUploadFile')}
                  <input
                    type="file"
                    className="hidden"
                    accept={
                      form.kind === 'MEDIA'
                        ? 'image/*,audio/*,video/*'
                        : '.txt,.md,.csv,.json,.pdf,.doc,.docx,image/*,audio/*,video/*'
                    }
                    onChange={(e) => void onUpload(e.target.files?.[0] || null)}
                  />
                </label>
                {form.fileUrl && (
                  <a
                    href={form.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1"
                  >
                    <ImageIcon size={14} />
                    {form.fileName || form.fileUrl}
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-500">{t('adminAiKbUploadHint')}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              {t('knowledgeEnabledForAI')}
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <span className="text-slate-500">{t('sortOrder')}</span>
              <input
                type="number"
                className="input-field w-24"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
              />
            </label>
            <button
              type="button"
              disabled={saving || uploading}
              onClick={() => void save()}
              className="btn-primary inline-flex items-center gap-2 ms-auto"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="animate-spin" size={18} /> {t('loading')}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">{t('adminAiKbEmpty')}</div>
        ) : (
          <div className="table-scroll">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>{t('adminAiKbKind')}</th>
                  <th>{t('adminAiKbTitleEn')}</th>
                  <th>{t('adminAiKbScope')}</th>
                  <th>{t('status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span className="inline-flex items-center gap-2 text-sm font-medium">
                        {kindIcon(entry.kind)}
                        {entry.kind === 'PROMPT'
                          ? t('adminAiKbKindPrompt')
                          : entry.kind === 'FILE'
                            ? t('adminAiKbKindFile')
                            : t('adminAiKbKindMedia')}
                      </span>
                    </td>
                    <td>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {isAr ? entry.titleAr || entry.titleEn : entry.titleEn}
                      </div>
                      {entry.content && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 max-w-md">
                          {entry.content}
                        </p>
                      )}
                      {entry.fileUrl && (
                        <a
                          href={entry.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                        >
                          {entry.fileName || entry.fileUrl}
                        </a>
                      )}
                    </td>
                    <td className="text-sm text-slate-600 dark:text-slate-300">
                      {entry.case
                        ? caseLabel(entry.case)
                        : entry.category
                          ? categoryLabel(entry.category)
                          : '—'}
                    </td>
                    <td>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          entry.isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {entry.isActive ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600"
                          onClick={() => openEdit(entry)}
                          title={t('edit')}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600"
                          onClick={() => void remove(entry.id)}
                          title={t('delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
