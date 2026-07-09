import Link from "next/link";
import { BrandPanel } from "@/components/auth/brand-panel";
import { BypassButton } from "@/components/auth/bypass-button";
import { ENTER } from "@/lib/motion";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel />

      <div className="relative flex min-h-screen flex-col">
        <div
          aria-hidden
          className="bg-primary/5 pointer-events-none absolute -top-24 right-0 size-[380px] rounded-full blur-3xl"
        />

        <header className="relative px-8 py-6 lg:invisible">
          <Link href="/login" className={`text-lg font-semibold tracking-tight ${ENTER}`}>
            Re<span className="text-primary">:</span>lay
          </Link>
        </header>

        <main className="relative flex flex-1 items-center justify-center px-6 pb-28 sm:px-12">
          {children}
        </main>
      </div>

      <BypassButton />
    </div>
  );
}
