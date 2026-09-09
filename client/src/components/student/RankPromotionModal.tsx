import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RankSnapshot } from './XpBreakdownSection';
import { rankLabel } from '../../lib/clinicalRanks';

interface RankPromotionModalProps {
  rankProgress: RankSnapshot | null;
  isAr: boolean;
  onClose: () => void;
}

function ConfettiPiece({ delay, left, size }: { delay: number; left: string; size: number }) {
  const colors = ['#14b8a6', '#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6', '#fbbf24'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return (
    <span
      className="absolute top-0 rounded-sm animate-promotion-confetti opacity-90"
      style={{
        left,
        width: size,
        height: size * 1.4,
        backgroundColor: color,
        animationDelay: `${delay}ms`,
      }}
    />
  );
}

export function RankPromotionModal({ rankProgress, isAr, onClose }: RankPromotionModalProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [emojiPop, setEmojiPop] = useState(false);

  useEffect(() => {
    if (!rankProgress?.promoted || !rankProgress.promotedRank) return;
    const frame = requestAnimationFrame(() => setVisible(true));
    const popTimer = window.setTimeout(() => setEmojiPop(true), 350);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(popTimer);
    };
  }, [rankProgress]);

  if (!rankProgress?.promoted || !rankProgress.promotedRank) return null;

  const promoted = rankProgress.promotedRank;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotion-title"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity duration-500 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label={t('xpPromotionClose')}
        onClick={onClose}
      />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 40 }, (_, i) => (
          <ConfettiPiece
            key={i}
            delay={i * 60}
            left={`${(i / 40) * 100}%`}
            size={6 + (i % 4) * 2}
          />
        ))}
      </div>

      <div
        className={`relative w-full max-w-md transition-all duration-700 ease-out ${
          visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-8'
        }`}
      >
        <div className="absolute inset-0 -m-8 rounded-full bg-teal-400/20 animate-promotion-pulse pointer-events-none" />
        <div className="absolute inset-0 -m-4 rounded-full bg-violet-500/10 animate-promotion-pulse-slow pointer-events-none" />

        <div className="relative rounded-3xl border border-teal-200/40 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-8 sm:p-10 text-center shadow-2xl overflow-hidden">
          <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.4),transparent_60%)] pointer-events-none" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-teal-400/20 rounded-full blur-3xl pointer-events-none animate-promotion-glow" />

          <p
            className={`text-teal-300 text-xs font-bold uppercase tracking-[0.25em] mb-4 relative transition-all duration-500 delay-100 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
          >
            {t('xpPromotionBadge')}
          </p>

          <div className="relative mx-auto w-fit mb-5">
            <div
              className={`absolute inset-0 -m-6 rounded-full border-2 border-teal-400/40 transition-all duration-1000 ${
                emojiPop ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
              }`}
            />
            <div
              className={`text-7xl sm:text-8xl transition-all duration-700 ease-out ${
                emojiPop ? 'scale-110 rotate-0' : 'scale-50 rotate-[-20deg]'
              }`}
              style={{ filter: emojiPop ? 'drop-shadow(0 0 24px rgba(45,212,191,0.6))' : undefined }}
            >
              {promoted.emoji}
            </div>
          </div>

          <h2
            id="promotion-title"
            className={`relative text-2xl sm:text-3xl font-black text-white mb-2 transition-all duration-500 delay-200 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
            {t('xpPromotionTitle')}
          </h2>

          <p
            className={`relative text-xl text-teal-100 font-bold mb-2 transition-all duration-500 delay-300 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
            {rankLabel(promoted, isAr)}
          </p>

          <p
            className={`relative text-sm text-slate-300 mb-6 transition-all duration-500 delay-[400ms] ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {t('xpPromotionDesc')}
          </p>

          <button
            type="button"
            onClick={onClose}
            className={`relative w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-400 to-emerald-500 text-white font-bold text-sm uppercase tracking-wide hover:opacity-95 transition-all duration-500 delay-500 shadow-lg shadow-teal-500/30 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {t('xpPromotionContinue')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes promotion-confetti {
          0% { transform: translateY(-20px) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg) scale(0.6); opacity: 0; }
        }
        @keyframes promotion-pulse {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.08); opacity: 0.15; }
        }
        @keyframes promotion-pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.15); opacity: 0.08; }
        }
        @keyframes promotion-glow {
          0%, 100% { opacity: 0.5; transform: translateX(-50%) scale(1); }
          50% { opacity: 0.9; transform: translateX(-50%) scale(1.1); }
        }
        .animate-promotion-confetti { animation: promotion-confetti 3.2s ease-in forwards; }
        .animate-promotion-pulse { animation: promotion-pulse 2s ease-in-out infinite; }
        .animate-promotion-pulse-slow { animation: promotion-pulse-slow 2.8s ease-in-out infinite; }
        .animate-promotion-glow { animation: promotion-glow 2.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
