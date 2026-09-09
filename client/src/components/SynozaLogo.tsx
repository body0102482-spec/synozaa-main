import { Link } from 'react-router-dom';

interface SynozaLogoProps {
  className?: string;
  /** Visible logo height in pixels */
  height?: number;
  to?: string;
  onClick?: () => void;
  /** @deprecated Wordmark is used by default. Set variant="icon" for square app icon only. */
  showLabel?: boolean;
  /** `wordmark` (default) = full logo; `icon` = square app icon */
  variant?: 'icon' | 'wordmark';
}

const LOGO_IMG_CLASS =
  'block shrink-0 select-none pointer-events-none object-contain object-start -translate-y-1 dark:brightness-0 dark:invert';

export function SynozaLogo({
  className = '',
  height = 40,
  to = '/',
  onClick,
  showLabel = false,
  variant = 'wordmark',
}: SynozaLogoProps) {
  const useWordmark = variant !== 'icon';

  const wordmark = (
    <img
      src="/synoza-wordmark.png"
      alt="Synoza"
      draggable={false}
      style={{ height, width: 'auto' }}
      className={`${LOGO_IMG_CLASS} max-w-[min(280px,60vw)] ${className}`}
    />
  );

  const icon = (
    <img
      src="/synoza-icon.png"
      alt="Synoza"
      draggable={false}
      style={{ height, width: height }}
      className={`${LOGO_IMG_CLASS} ${className}`}
    />
  );

  const content = useWordmark ? (
    wordmark
  ) : (
    <>
      {icon}
      {showLabel && (
        <span className="font-bold text-slate-900 dark:text-white tracking-tight text-lg sm:text-xl lowercase">
          synoza
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        onClick={onClick}
        className={`inline-flex shrink-0 items-center self-center leading-none ${useWordmark ? '' : 'gap-2.5'}`}
      >
        {content}
      </Link>
    );
  }

  return <span className="inline-flex items-center gap-2.5 self-center leading-none">{content}</span>;
}
