import { useEffect, useState } from 'react';

interface TypewriterTextProps {
  phrases: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseMs?: number;
  className?: string;
  cursorClassName?: string;
  dir?: 'ltr' | 'rtl';
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

export function TypewriterText({
  phrases,
  typingSpeed = 70,
  deletingSpeed = 35,
  pauseMs = 2200,
  className = '',
  cursorClassName = 'text-blue-600 dark:text-blue-400',
  dir = 'ltr',
}: TypewriterTextProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [text, setText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (phrases.length === 0) return;
    if (reducedMotion) {
      setText(phrases[0]);
      return;
    }

    const current = phrases[phraseIndex % phrases.length];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && text === current) {
      timeout = setTimeout(() => setIsDeleting(true), pauseMs);
    } else if (isDeleting && text === '') {
      setIsDeleting(false);
      setPhraseIndex((i) => (i + 1) % phrases.length);
    } else {
      const speed = isDeleting ? deletingSpeed : typingSpeed;
      timeout = setTimeout(() => {
        const nextLen = text.length + (isDeleting ? -1 : 1);
        setText(current.substring(0, nextLen));
      }, speed);
    }

    return () => clearTimeout(timeout);
  }, [text, isDeleting, phraseIndex, phrases, typingSpeed, deletingSpeed, pauseMs, reducedMotion]);

  if (phrases.length === 0) return null;

  return (
    <span className={`inline ${className}`} dir={dir}>
      <span className={className || 'text-inherit'}>{text}</span>
      {!reducedMotion && (
        <span
          className={`typewriter-cursor font-light ${cursorClassName} ${dir === 'rtl' ? 'mr-0.5' : 'ml-0.5'}`}
          aria-hidden="true"
        >
          |
        </span>
      )}
    </span>
  );
}
