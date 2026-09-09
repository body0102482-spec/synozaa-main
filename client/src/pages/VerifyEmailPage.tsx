import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { IconBox } from '../components/IconBox';
import api from '../lib/api';
import { getAppLang } from '../lib/appLang';

export default function VerifyEmailPage() {
  const { t, i18n } = useTranslation();
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const emailLang = searchParams.get('lang') || i18n.language || getAppLang();

  useEffect(() => {
    const paramEmail = searchParams.get('email');
    if (paramEmail) setEmail(paramEmail);
  }, [searchParams]);

  const normalizeOtp = (value: string) => value.replace(/\D/g, '').slice(0, 6);

  const handleCodeChange = (value: string) => {
    setCode(normalizeOtp(value));
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    setCode(normalizeOtp(pasted));
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await verifyOtp(email.trim(), code.trim());
      const saved = JSON.parse(localStorage.getItem('synoza_user') || '{}');
      navigate(saved.role === 'ADMIN' ? '/admin' : '/student');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        const msg = err.response.data?.error;
        if (msg?.includes('expired')) setError(t('otpExpired'));
        else setError(t('otpInvalid'));
      } else {
        setError(t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setError(t('emailRequired'));
      return;
    }
    setError('');
    setInfo('');
    setResending(true);
    try {
      await api.post('/auth/resend-otp', { email: email.trim(), lang: emailLang });
      setInfo(t('otpResent'));
    } catch {
      setError(t('otpSendFailed'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen auth-bg flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md animate-scale-in">
          <div className="text-center mb-6">
            <IconBox icon={MailCheck} variant="brand" size="xl" className="mx-auto mb-4" />
            <h1 className="text-heading text-2xl sm:text-3xl">{t('verifyEmail')}</h1>
            <p className="text-body text-sm mt-2">{t('verifyEmailDesc')}</p>
          </div>

          <div className="card p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-black/20">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 p-3 rounded-xl mb-4 text-sm border border-red-100 animate-slide-down">
                {error}
              </div>
            )}
            {info && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 p-3 rounded-xl mb-4 text-sm border border-emerald-100 animate-slide-down">
                {info}
              </div>
            )}
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('email')}</label>
                <input
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('otpCode')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="input-field text-center text-2xl tracking-[0.25em] font-bold tabular-nums"
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  onPaste={handleCodePaste}
                  placeholder="000000"
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full py-3" disabled={loading || code.length !== 6}>
                {loading ? t('loading') : t('verifyAndContinue')}
              </button>
            </form>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full mt-3 text-sm text-primary font-medium hover:underline disabled:opacity-50"
            >
              {resending ? t('loading') : t('resendOtp')}
            </button>
            <p className="text-center text-sm text-slate-500 mt-6">
              <Link to="/login" className="text-primary font-medium hover:underline">{t('backToLogin')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
