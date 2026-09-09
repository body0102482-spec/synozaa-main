import { ReactNode, useEffect, useRef, useState } from 'react';

interface AnimateOnScrollProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  animation?: 'fade-up' | 'fade-in' | 'scale-in';
}

export function AnimateOnScroll({
  children,
  className = '',
  delay = 0,
  animation = 'fade-up',
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const animClass =
    animation === 'fade-in' ? 'animate-fade-in' : animation === 'scale-in' ? 'animate-scale-in' : 'animate-fade-up';

  return (
    <div
      ref={ref}
      className={`${className} ${visible ? animClass : 'opacity-0 translate-y-4'}`}
      style={{ animationDelay: visible ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}
