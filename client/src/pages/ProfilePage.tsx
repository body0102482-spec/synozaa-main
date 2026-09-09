import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, User } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { fileToAvatarDataUrl } from '../lib/avatarImage';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    university: '',
    avatarUrl: '' as string | null,
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        university: user.university || '',
        avatarUrl: user.avatarUrl || null,
      });
    }
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^01[0125][0-9]{8}$/.test(form.phone)) {
      setError('Enter a valid Egyptian mobile number.');
      return;
    }
    try {
      const res = await api.put('/auth/profile', form);
      updateUser(res.data.user);
      setMessage(t('profileUpdated'));
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || t('error'));
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.put('/auth/change-password', passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      setMessage(t('passwordChanged'));
    } catch {
      setError(t('error'));
    }
  };

  const handlePhotoPick = async (file: File | null) => {
    if (!file) return;
    setError('');
    setPhotoLoading(true);
    try {
      const avatarUrl = await fileToAvatarDataUrl(file);
      setForm((prev) => ({ ...prev, avatarUrl }));
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'FILE_TOO_LARGE') setError(t('photoTooLarge'));
      else if (code === 'INVALID_IMAGE') setError(t('invalidImage'));
      else setError(t('error'));
    } finally {
      setPhotoLoading(false);
    }
  };

  const initials =
    `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'ST';

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">{t('profile')}</h1>
      {message && <div className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 p-3 rounded-lg mb-4 text-sm">{message}</div>}
      {error && <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 p-3 rounded-lg mb-4 text-sm">{error}</div>}

      <form onSubmit={saveProfile} className="card p-6 space-y-4 mb-6">
        <h2 className="font-semibold text-slate-900 dark:text-white">{t('updateProfile')}</h2>

        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {form.avatarUrl ? (
              <img
                src={form.avatarUrl}
                alt=""
                className="w-20 h-20 rounded-full object-cover border-2 border-slate-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-slate-800 text-white flex items-center justify-center text-xl font-bold">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoLoading}
              className="absolute -bottom-1 -end-1 w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-md hover:bg-teal-700 disabled:opacity-60"
              aria-label={t('changePhoto')}
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handlePhotoPick(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('profilePhoto')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('profilePhotoHint')}</p>
            {form.avatarUrl && (
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, avatarUrl: null }))}
                className="text-xs text-red-600 hover:underline mt-2"
              >
                {t('removePhoto')}
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">{t('studentId')}</label>
          <input
            className="input-field bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400"
            value={user?.studentId || '—'}
            readOnly
            disabled
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            className="input-field"
            placeholder={t('firstName')}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
          <input
            className="input-field"
            placeholder={t('lastName')}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
        </div>
        <input
          type="tel"
          inputMode="numeric"
          className="input-field"
          placeholder={t('phone')}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          pattern="01[0125][0-9]{8}"
          required
        />
        <input
          className="input-field"
          placeholder={t('university')}
          value={form.university}
          onChange={(e) => setForm({ ...form, university: e.target.value })}
        />
        <button type="submit" className="btn-primary" disabled={photoLoading}>
          {photoLoading ? t('loading') : t('save')}
        </button>
      </form>

      <form onSubmit={changePassword} className="card p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
          <User size={18} className="text-slate-500 dark:text-slate-400" />
          {t('changePassword')}
        </h2>
        <input
          type="password"
          className="input-field"
          placeholder={t('currentPassword')}
          value={passwords.currentPassword}
          onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
          required
        />
        <input
          type="password"
          className="input-field"
          placeholder={t('newPassword')}
          value={passwords.newPassword}
          onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
          required
          minLength={6}
        />
        <button type="submit" className="btn-primary">
          {t('changePassword')}
        </button>
      </form>
    </div>
  );
}
