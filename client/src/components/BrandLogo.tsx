import { SynozaLogo } from './SynozaLogo';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  subtitle?: string;
  onClick?: () => void;
}

const heights = { sm: 44, md: 52, lg: 60 } as const;
const subtitles = {
  sm: 'hidden sm:block text-[10px]',
  md: 'text-[11px]',
  lg: 'text-[10px] font-semibold uppercase tracking-widest',
} as const;

export function BrandLogo({ size = 'md', showSubtitle = true, subtitle, onClick }: BrandLogoProps) {
  return (
    <div className="flex flex-col items-start min-w-0">
      <SynozaLogo height={heights[size]} to="/" onClick={onClick} />
      {showSubtitle && subtitle && (
        <span className={`${subtitles[size]} text-slate-500 dark:text-slate-400 truncate max-w-full mt-0.5 leading-tight`}>
          {subtitle}
        </span>
      )}
    </div>
  );
}
