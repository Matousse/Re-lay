import { ENTER, enterDelay } from "@/lib/motion";

/**
 * Shared shell for the auth screens: big type, generous spacing, no card
 * chrome — the title and description land first, the form staggers in after.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md">
      <h1 className={`text-3xl font-semibold tracking-tight ${ENTER}`} style={enterDelay(1)}>
        {title}
      </h1>
      <p className={`text-muted-foreground mt-3 text-base ${ENTER}`} style={enterDelay(2)}>
        {description}
      </p>
      <div className="mt-10">{children}</div>
      {footer && (
        <div className={`text-muted-foreground mt-10 text-sm ${ENTER}`} style={enterDelay(6)}>
          {footer}
        </div>
      )}
    </div>
  );
}
