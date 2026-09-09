import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Stethoscope } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { PasswordInput } from '../components/PasswordInput';
import { IconBox } from '../components/IconBox';
import api from '../lib/api';
import { getAppLang, verifyEmailPath } from '../lib/appLang';
import { FALLBACK_UNIVERSITIES } from '../lib/universitiesFallback';

interface UniversityOption {
  id: string;
  nameEn: string;
  nameAr: string;
}

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    universityId: '',
    university: '',
    studentId: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get('/site/public')
      .then((r) => {
        const list = r.data.universities ?? [];
        setUniversities(list.length > 0 ? list : [...FALLBACK_UNIVERSITIES]);
      })
      .catch(() => setUniversities([...FALLBACK_UNIVERSITIES]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^01[0125][0-9]{8}$/.test(form.phone)) {
      setError('Enter a valid Egyptian mobile number.');
      return;
    }
    if (form.universityId === '__other__' && !form.university.trim()) {
      setError('Enter your university name.');
      return;
    }
    setLoading(true);
    try {
      const lang = i18n.language || getAppLang();
      const payload = {
        ...form,
        university: form.universityId === '__other__' ? form.university.trim() : '',
        universityId: form.universityId === '__other__' ? '' : form.universityId,
        lang,
      };
      const { email } = await register(payload);
      navigate(verifyEmailPath(email, lang));
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const msg = err.response.data?.error as string | undefined;
        setError(msg === 'Student ID already registered' ? t('studentIdAlreadyRegistered') : t('emailAlreadyRegistered'));
      } else if (axios.isAxiosError(err) && err.response?.status === 400) {
        setError(err.response.data?.error || 'Enter a valid Egyptian mobile number.');
      } else if (axios.isAxiosError(err) && err.response?.status === 503) {
        const failedEmail = err.response.data?.email as string | undefined;
        if (failedEmail) {
          navigate(verifyEmailPath(failedEmail, i18n.language || getAppLang()));
          return;
        }
        setError(t('otpSendFailed'));
      } else {
        setError(t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen auth-bg flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md animate-scale-in">
          <div className="text-center mb-6">
            <IconBox icon={Stethoscope} variant="brand" size="xl" className="mx-auto mb-4" />
            <h1 className="text-heading text-2xl sm:text-3xl">{t('register')}</h1>
          </div>

          <div className="card p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 p-3 rounded-xl mb-4 text-sm border border-red-100 animate-slide-down">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t('firstName')}</label>
                  <input className="input-field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t('lastName')}</label>
                  <input className="input-field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('studentId')}</label>
                <input
                  className="input-field"
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value.trim() })}
                  placeholder={t('studentIdPlaceholder')}
                  required
                  minLength={3}
                  maxLength={32}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('email')}</label>
                <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <PasswordInput
                label={t('password')}
                value={form.password}
                onChange={(password) => setForm({ ...form, password })}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('phone')}</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  className="input-field"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.slice(0, 11) })}
                  placeholder="01024828652"
                  required
                  minLength={11}
                  maxLength={11}
                  pattern="01[0125][0-9]{8}"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('university')}</label>
                <select
                  className="input-field"
                  value={form.universityId}
                  onChange={(e) => setForm({ ...form, universityId: e.target.value, university: e.target.value === '__other__' ? form.university : '' })}
                  required
                >
                  <option value="">{t('selectUniversity')}</option>
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nameEn}
                    </option>
                  ))}
                  <option value="__other__">Other</option>
                </select>
              </div>
              {form.universityId === '__other__' && (
                <div>
                  <label htmlFor="custom-university" className="block text-sm font-medium mb-1.5">University name</label>
                  <input
                    id="custom-university"
                    className="input-field"
                    value={form.university}
                    onChange={(e) => setForm({ ...form, university: e.target.value })}
                    required
                    maxLength={160}
                  />
                </div>
              )}
              <button type="submit" className="btn-primary w-full py-3 mt-2" disabled={loading}>
                {loading ? t('loading') : t('register')}
              </button>
            </form>
            <p className="text-center text-sm text-slate-500 mt-6">
              {t('haveAccount')}{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">{t('login')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
