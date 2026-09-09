import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save } from 'lucide-react';
import api from '../../lib/api';

export type CaseFormData = {
  titleEn: string;
  titleAr: string;
  specialtyId: string;
  difficultyId: string;
  categoryId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientNationality: string;
  patientBirthPlace: string;
  patientResidence: string;
  patientOccupation: string;
  patientMaritalStatus: string;
  patientSmokingStatus: string;
  patientAlcoholStatus: string;
  chiefComplaint: string;
  medicalHistory: string;
  medicationHistory: string;
  surgicalHistory: string;
  familyHistory: string;
  socialHistory: string;
  physicalExam: string;
  labResults: string;
  examImages: string;
  vitalSigns: string;
  finalDiagnosis: string;
  teachingPoints: string;
  evaluationRubric: string;
  scenarioPrompt: string;
  patientPersonality: string;
  isPublished: boolean;
  isFreeTier: boolean;
};

const EMPTY: CaseFormData = {
  titleEn: '',
  titleAr: '',
  specialtyId: '',
  difficultyId: '',
  categoryId: '',
  patientName: '',
  patientAge: 30,
  patientGender: 'Male',
  patientNationality: 'Egyptian',
  patientBirthPlace: '',
  patientResidence: '',
  patientOccupation: '',
  patientMaritalStatus: '',
  patientSmokingStatus: '',
  patientAlcoholStatus: '',
  chiefComplaint: '',
  medicalHistory: '',
  medicationHistory: '',
  surgicalHistory: '',
  familyHistory: '',
  socialHistory: '',
  physicalExam: JSON.stringify({ inspection: '', palpation: '', percussion: '', auscultation: '' }, null, 2),
  labResults: JSON.stringify({ sections: [] }, null, 2),
  examImages: '[]',
  vitalSigns: JSON.stringify({ bp: '', hr: '', temp: '', spo2: '' }, null, 2),
  finalDiagnosis: '',
  teachingPoints: '',
  evaluationRubric: '',
  scenarioPrompt: '',
  patientPersonality: '',
  isPublished: false,
  isFreeTier: false,
};

type Lookup = { id: string; nameEn: string; level?: number };

type Props = {
  caseId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function AdminCaseEditor({ caseId, open, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CaseFormData>(EMPTY);
  const [specialties, setSpecialties] = useState<Lookup[]>([]);
  const [difficulties, setDifficulties] = useState<Lookup[]>([]);
  const [categories, setCategories] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setLoading(true);
    void Promise.all([
      api.get('/admin/specialties'),
      api.get('/admin/difficulties'),
      api.get('/admin/categories'),
      caseId ? api.get(`/admin/cases/${caseId}`) : Promise.resolve(null),
    ])
      .then(([specRes, diffRes, catRes, caseRes]) => {
        setSpecialties(specRes.data.specialties ?? []);
        setDifficulties(diffRes.data.difficulties ?? []);
        setCategories((catRes.data.categories ?? []).map((c: { id: string; nameEn: string }) => ({ id: c.id, nameEn: c.nameEn })));
        if (caseRes?.data?.case) {
          const c = caseRes.data.case;
          setForm({
            titleEn: c.titleEn ?? '',
            titleAr: c.titleAr ?? '',
            specialtyId: c.specialtyId ?? '',
            difficultyId: c.difficultyId ?? '',
            categoryId: c.categoryId ?? '',
            patientName: c.patientName ?? '',
            patientAge: c.patientAge ?? 30,
            patientGender: c.patientGender ?? 'Male',
            patientNationality: c.patientNationality ?? 'Egyptian',
            patientBirthPlace: c.patientBirthPlace ?? '',
            patientResidence: c.patientResidence ?? '',
            patientOccupation: c.patientOccupation ?? '',
            patientMaritalStatus: c.patientMaritalStatus ?? '',
            patientSmokingStatus: c.patientSmokingStatus ?? '',
            patientAlcoholStatus: c.patientAlcoholStatus ?? '',
            chiefComplaint: c.chiefComplaint ?? '',
            medicalHistory: c.medicalHistory ?? '',
            medicationHistory: c.medicationHistory ?? '',
            surgicalHistory: c.surgicalHistory ?? '',
            familyHistory: c.familyHistory ?? '',
            socialHistory: c.socialHistory ?? '',
            physicalExam: c.physicalExam ?? '{}',
            labResults: c.labResults ?? '{}',
            examImages: c.examImages ?? '[]',
            vitalSigns: c.vitalSigns ?? '{}',
            finalDiagnosis: c.finalDiagnosis ?? '',
            teachingPoints: c.teachingPoints ?? '',
            evaluationRubric: c.evaluationRubric ?? '',
            scenarioPrompt: c.scenarioPrompt ?? '',
            patientPersonality: c.patientPersonality ?? '',
            isPublished: !!c.isPublished,
            isFreeTier: !!c.isFreeTier,
          });
        } else {
          setForm(EMPTY);
        }
      })
      .catch(() => setError(t('adminCaseLoadError')))
      .finally(() => setLoading(false));
  }, [open, caseId, t]);

  const set = (key: keyof CaseFormData, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, categoryId: form.categoryId || null };
      if (caseId) {
        await api.put(`/cases/${caseId}`, payload);
      } else {
        await api.post('/cases', payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || t('adminCaseSaveError'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {caseId ? t('adminEditCase') : t('adminAddCase')}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{t('adminCaseEditorHint')}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">{t('loading')}</p>
          ) : (
            <>
              <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">{t('adminCaseAiControlHint')}</p>

              <div className="grid sm:grid-cols-2 gap-3">
                <input className="input-field" placeholder="Title (EN) *" value={form.titleEn} onChange={(e) => set('titleEn', e.target.value)} />
                <input className="input-field" placeholder="العنوان (AR) *" value={form.titleAr} onChange={(e) => set('titleAr', e.target.value)} />
                <select className="input-field" value={form.specialtyId} onChange={(e) => set('specialtyId', e.target.value)}>
                  <option value="">{t('adminSelectSpecialty')}</option>
                  {specialties.map((s) => <option key={s.id} value={s.id}>{s.nameEn}</option>)}
                </select>
                <select className="input-field" value={form.difficultyId} onChange={(e) => set('difficultyId', e.target.value)}>
                  <option value="">{t('adminSelectDifficulty')}</option>
                  {difficulties.map((d) => <option key={d.id} value={d.id}>{d.nameEn}</option>)}
                </select>
                <select className="input-field sm:col-span-2" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="">{t('adminSelectCategory')} ({t('knowledgeForAI')})</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
                </select>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <input className="input-field" placeholder={t('patientName')} value={form.patientName} onChange={(e) => set('patientName', e.target.value)} />
                <input type="number" className="input-field" placeholder={t('patientAge')} value={form.patientAge} onChange={(e) => set('patientAge', Number(e.target.value) || 0)} />
                <input className="input-field" placeholder={t('patientGender')} value={form.patientGender} onChange={(e) => set('patientGender', e.target.value)} />
                <input className="input-field" placeholder={t('patientNationality')} value={form.patientNationality} onChange={(e) => set('patientNationality', e.target.value)} />

                <input className="input-field" placeholder="Birth place" value={form.patientBirthPlace} onChange={(e) => set('patientBirthPlace', e.target.value)} />
                <input className="input-field" placeholder="Residence" value={form.patientResidence} onChange={(e) => set('patientResidence', e.target.value)} />
                <input className="input-field" placeholder="Occupation" value={form.patientOccupation} onChange={(e) => set('patientOccupation', e.target.value)} />
                <input className="input-field" placeholder="Marital status" value={form.patientMaritalStatus} onChange={(e) => set('patientMaritalStatus', e.target.value)} />
                <input className="input-field" placeholder="Smoking status" value={form.patientSmokingStatus} onChange={(e) => set('patientSmokingStatus', e.target.value)} />
                <input className="input-field" placeholder="Alcohol status" value={form.patientAlcoholStatus} onChange={(e) => set('patientAlcoholStatus', e.target.value)} />
              </div>

              <textarea className="input-field min-h-[60px]" placeholder={t('chiefComplaint')} value={form.chiefComplaint} onChange={(e) => set('chiefComplaint', e.target.value)} />
              <textarea className="input-field min-h-[80px]" placeholder={t('medicalHistory')} value={form.medicalHistory} onChange={(e) => set('medicalHistory', e.target.value)} />
              <textarea className="input-field min-h-[60px]" placeholder={t('medicationHistory')} value={form.medicationHistory} onChange={(e) => set('medicationHistory', e.target.value)} />
              <textarea className="input-field min-h-[50px]" placeholder={t('scenarioPrompt')} value={form.scenarioPrompt} onChange={(e) => set('scenarioPrompt', e.target.value)} />
              <textarea className="input-field min-h-[50px]" placeholder={t('patientPersonality')} value={form.patientPersonality} onChange={(e) => set('patientPersonality', e.target.value)} />
              <input className="input-field" placeholder={t('finalDiagnosis')} value={form.finalDiagnosis} onChange={(e) => set('finalDiagnosis', e.target.value)} />
              <textarea className="input-field min-h-[60px]" placeholder={t('evaluationRubric')} value={form.evaluationRubric} onChange={(e) => set('evaluationRubric', e.target.value)} />
              <textarea className="input-field min-h-[50px] font-mono text-xs" placeholder="vitalSigns (JSON)" value={form.vitalSigns} onChange={(e) => set('vitalSigns', e.target.value)} />
              <textarea className="input-field min-h-[80px] font-mono text-xs" placeholder="physicalExam (JSON)" value={form.physicalExam} onChange={(e) => set('physicalExam', e.target.value)} />
              <textarea className="input-field min-h-[80px] font-mono text-xs" placeholder="labResults (JSON)" value={form.labResults} onChange={(e) => set('labResults', e.target.value)} />
              <textarea className="input-field min-h-[80px] font-mono text-xs" placeholder="examImages (JSON) — /exam/cases/..." value={form.examImages} onChange={(e) => set('examImages', e.target.value)} />

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isPublished} onChange={(e) => set('isPublished', e.target.checked)} />
                  {t('adminCasePublished')}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isFreeTier} onChange={(e) => set('isFreeTier', e.target.checked)} />
                  {t('adminCaseFreeTier')}
                </label>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">{t('cancel')}</button>
          <button type="button" onClick={() => void handleSave()} disabled={loading || saving || !form.titleEn || !form.specialtyId || !form.difficultyId} className="btn-primary flex items-center gap-2">
            <Save size={16} />
            {saving ? t('loading') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
