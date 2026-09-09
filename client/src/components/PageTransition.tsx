import { ReactNode } from 'react';

/** Wraps the router without remounting it on every navigation (that caused UI freezes). */
export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="min-h-[inherit]">{children}</div>;
}
