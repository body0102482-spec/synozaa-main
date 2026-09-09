import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { ChevronLeft } from 'lucide-react';
import { PasswordInput } from '../components/PasswordInput';
import { SynozaLogo } from '../components/SynozaLogo';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { homePathForUser } from '../lib/authStorage';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError(t('resetTokenInvalid'));
      return;
    }
    if (password.length < 6) {
      setError(t('error'));
      return;
    }
    if (password !== confirm) {
      setError(t('passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      const user = await resetPassword(token, password);
      navigate(homePathForUser(user), { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'PASSWORD_RESET_LOGIN_UNAVAILABLE') {
        navigate('/login', { state: { passwordReset: true } });
        return;
      }
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        setError(t('resetTokenInvalid'));
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
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t('resetPassword')}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t('resetPasswordDesc')}</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm border border-red-100">
                {error}
              </div>
            )}

            {!token ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-slate-600">{t('resetTokenInvalid')}</p>
                <Link to="/forgot-password" className="text-teal-700 font-medium hover:underline text-sm">
                  {t('forgotPassword')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <PasswordInput
                  label={t('newPassword')}
                  value={password}
                  onChange={setPassword}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <PasswordInput
                  label={t('confirmPassword')}
                  value={confirm}
                  onChange={setConfirm}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-800 text-white font-semibold hover:opacity-95 disabled:opacity-60 shadow-lg"
                >
                  {loading ? t('loading') : t('savePassword')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
