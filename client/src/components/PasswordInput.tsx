import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}

export function PasswordInput({
  id,
  value,
  onChange,
  label,
  required,
  minLength,
  autoComplete = 'current-password',
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          className="input-field pe-11"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
