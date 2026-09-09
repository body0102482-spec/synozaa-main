import { QBANK } from '../../lib/qbankTheme';

/** Decorative book + stethoscope illustration matching QBank mockup */
export function QbankHeroIllustration() {
  return (
    <div className="relative w-44 h-44 sm:w-52 sm:h-52 shrink-0 select-none pointer-events-none" aria-hidden>
      <div className="absolute inset-4 rounded-[2rem]" style={{ backgroundColor: QBANK.light }} />
      <svg viewBox="0 0 200 200" className="relative w-full h-full drop-shadow-sm">
        <ellipse cx="100" cy="168" rx="52" ry="10" fill={QBANK.primary} opacity="0.14" />
        <path
          d="M58 52c0-8 6-14 14-14h56c8 0 14 6 14 14v96c0 8-6 14-14 14H72c-8 0-14-6-14-14V52z"
          fill="#fff"
          stroke={QBANK.primary}
          strokeWidth="2.5"
        />
        <path d="M86 38v124" stroke={QBANK.borderHover} strokeWidth="2" />
        <path
          d="M58 68h28M58 88h28M58 108h20"
          stroke={QBANK.border}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect x="100" y="44" width="36" height="8" rx="4" fill={QBANK.primary} opacity="0.9" />
        <path
          d="M148 72c12 0 22 10 22 22s-10 22-22 22"
          fill="none"
          stroke={QBANK.primary}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.4"
        />
        <circle cx="148" cy="94" r="6" fill={QBANK.primary} opacity="0.25" />
        <path
          d="M132 130c8-14 24-22 40-18"
          fill="none"
          stroke={QBANK.primary}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.3"
        />
      </svg>
    </div>
  );
}
