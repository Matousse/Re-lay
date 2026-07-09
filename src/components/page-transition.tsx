/**
 * Wraps a route group's pages so every navigation eases in instead of
 * snapping. Mounted from `template.tsx`, which remounts per navigation.
 * CSS-driven (tw-animate-css) rather than rAF-driven so it never freezes
 * when the browser throttles frames (occluded window, battery saver).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 blur-in-[2px] fill-mode-both duration-[350ms] ease-out motion-reduce:animate-none">
      {children}
    </div>
  );
}
