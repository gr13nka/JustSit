import { ReactNode } from 'react';

/**
 * On a phone the safe area is a fact the OS reports, so there is nothing to do
 * here and this component is not even a wrapper.
 *
 * It exists for its `.web.tsx` twin, which has to invent the numbers because a
 * desktop browser has no notch to report. Metro picks the platform file, so the
 * native bundle never contains a line of that one.
 */
export function WebInsets({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
