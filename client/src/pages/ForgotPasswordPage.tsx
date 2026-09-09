import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Mail, ChevronLeft } from 'lucide-react';
import { SynozaLogo } from '../components/SynozaLogo';
import { ThemeToggle } from '../components/ThemeToggle';
import api from '../lib/api';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setDevResetUrl('');
    if (!email.trim()) {
      setError(t('emailRequired'));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      setInfo(t('resetLinkSent'));
      if (data.resetToken) {
        setDevResetUrl(`/reset-password?token=${encodeURIComponent(data.resetToken)}`);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError(t('forgotPasswordEmailNotFound'));
      } else if (axios.isAxiosError(err) && err.response?.status === 503) {
        setError(t('otpSendFailed'));
      } else {
        setError(t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#060b14] flex flex-col">
      <header className="px-5 sm:px-8 py-5 flex items-center justify-between gap-3">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft size={18} />
          {t('backToLogin')}
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <SynozaLogo height={48} to="/" />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)] dark:shadow-black/30 border border-transparent dark:border-slate-800 p-8 sm:p-10">
            <div className="text-center mb-8">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('forgotPassword')}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t('forgotPasswordHint')}</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm border border-red-100">
                {error}
              </div>
            )}
            {info && (
              <div className="bg-teal-50 text-teal-800 p-3 rounded-xl mb-4 text-sm border border-teal-100">
                {info}
                {devResetUrl && (
                  <p className="mt-2 text-xs break-all">
                    Dev reset link:{' '}
                    <Link to={devResetUrl} className="underline font-medium">
                      {devResetUrl}
                    </Link>
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase mb-2">
                  {t('email')}
                </label>
                <div className="relative border-b-2 border-slate-200 focus-within:border-teal-600 transition-colors">
                  <Mail size={18} className="absolute start-0 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    className="w-full ps-8 py-2.5 bg-transparent outline-none text-slate-900 dark:text-white"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-800 text-white font-semibold hover:opacity-95 disabled:opacity-60 shadow-lg"
              >
                {loading ? t('loading') : t('sendResetLink')}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-6">
              <Link to="/login" className="text-teal-700 font-medium hover:underline">
                {t('backToLogin')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
