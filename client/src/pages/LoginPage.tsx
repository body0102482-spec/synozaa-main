import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Mail, ArrowRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PasswordInput } from '../components/PasswordInput';
import { SynozaLogo } from '../components/SynozaLogo';
import { ThemeToggle } from '../components/ThemeToggle';
import { getAppLang, verifyEmailPath } from '../lib/appLang';
import { homePathForUser, getStoredUser } from '../lib/authStorage';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ((location.state as { passwordReset?: boolean } | null)?.passwordReset) {
      setInfo(t('passwordResetSuccess'));
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(homePathForUser(getStoredUser()));
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'SERVER_OFFLINE') {
        setError(t('serverOffline'));
      } else if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError(t('invalidCredentials'));
      } else if (axios.isAxiosError(err) && err.response?.status === 403) {
        const unverifiedEmail = (err.response.data?.email as string) || email;
        navigate(verifyEmailPath(unverifiedEmail, i18n.language || getAppLang()));
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
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft size={18} />
          {t('portalBackHome')}
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
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('portalLoginTitle')}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t('portalLoginSubtitle')}</p>
            </div>

            <div className="flex justify-end mb-6">
              <Link to="/register" className="text-sm font-medium text-teal-700 hover:underline">
                {t('portalCreateAccount')}
              </Link>
            </div>

            {info && (
              <div className="bg-teal-50 text-teal-800 p-3 rounded-xl mb-4 text-sm border border-teal-100">
                {info}
              </div>
            )}
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm border border-red-100">
                {error}
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
                    className="w-full ps-8 py-2.5 bg-transparent outline-none text-slate-900"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">
                    {t('password')}
                  </label>
                  <Link to="/forgot-password" className="text-xs text-teal-600 hover:underline">
                    {t('forgotPassword')}
                  </Link>
                </div>
                <PasswordInput
                  label=""
                  value={password}
                  onChange={setPassword}
                  required
                  autoComplete="current-password"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600"
                />
                {t('portalRememberSession')}
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-800 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 shadow-lg"
              >
                {loading ? t('loading') : t('portalSignInTerminal')}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          </div>

          <p className="text-center text-[10px] text-slate-400 uppercase tracking-[0.12em] mt-8 leading-relaxed">
            {t('portalLoginFooter1')}
            <br />
            {t('portalLoginFooter2')}
          </p>
        </div>
      </div>
    </div>
  );
}
