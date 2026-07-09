"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Opportunities" },
  { href: "/integrations", label: "Integrations" },
];

export function SiteNav({ needsSetup = false }: { needsSetup?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/" || pathname.startsWith("/cases")
            : pathname.startsWith(link.href);
        const showDot = needsSetup && link.href === "/integrations";
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "relative rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {showDot && (
                <TriangleAlert
                  aria-hidden
                  className="size-3.5 animate-pulse text-red-500 motion-reduce:animate-none"
                />
              )}
              {link.label}
            </span>
            {showDot && (
              <span aria-label="Setup required" className="absolute top-0.5 right-0.5 flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
