import type { LucideIcon } from 'lucide-react';

type IconBoxVariant = 'brand' | 'soft' | 'teal' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';

const variantStyles: Record<IconBoxVariant, string> = {
  brand: 'bg-gradient-to-br from-teal-500 to-indigo-600 text-white shadow-lg shadow-teal-500/25',
  soft: 'bg-teal-50 text-teal-700 border border-teal-100 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

interface IconBoxProps {
  icon: LucideIcon;
  variant?: IconBoxVariant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  strokeWidth?: number;
}

const sizeStyles = {
  sm: { box: 'w-8 h-8 rounded-lg', icon: 16 },
  md: { box: 'w-10 h-10 rounded-xl', icon: 20 },
  lg: { box: 'w-12 h-12 rounded-xl', icon: 22 },
  xl: { box: 'w-14 h-14 rounded-2xl', icon: 28 },
};

export function IconBox({
  icon: Icon,
  variant = 'brand',
  size = 'md',
  className = '',
  strokeWidth = 2,
}: IconBoxProps) {
  const s = sizeStyles[size];
  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 ${s.box} ${variantStyles[variant]} ${className}`}
    >
      <Icon size={s.icon} strokeWidth={strokeWidth} />
    </div>
  );
}
