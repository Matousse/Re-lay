/**
 * Shared entrance animation: fade + rise, staggered by `enterDelay(order)`.
 * Pair with `style={enterDelay(n)}` on the same element.
 */
export const ENTER =
  "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 motion-reduce:animate-none";

export function enterDelay(order: number): React.CSSProperties {
  return { animationDelay: `${order * 90}ms` };
}
