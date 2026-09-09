import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      className={`p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${className}`}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
