import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AssistantBubble } from "@/components/assistant/assistant-bubble";
import { ProfileMenu } from "@/components/profile-menu";
import { SiteNav } from "@/components/site-nav";
import { SESSION_COOKIE } from "@/lib/session";
import { allConnected } from "@/services/connectors";
import { getCurrentUser } from "@/services/workspace";

// Every page under (app) reflects mutable demo state (connectors, decisions,
// simulated signals) — never let Next serve a static snapshot of it.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Mock session: the demo always starts on the login screen.
  const cookieStore = await cookies();
  if (!cookieStore.get(SESSION_COOKIE)) redirect("/login");

  const [user, connected] = await Promise.all([getCurrentUser(), allConnected()]);

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Re<span className="text-primary">:</span>lay
            </Link>
            <SiteNav needsSetup={!connected} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground hidden text-sm lg:block">
              the action layer on top of your signals
            </span>
            <ProfileMenu name={user.name} email={user.email} />
          </div>
        </div>
      </header>
      {children}
      <AssistantBubble />
    </>
  );
}
