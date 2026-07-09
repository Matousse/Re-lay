import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CONNECTOR_LOGOS } from "@/lib/logos";
import { ENTER, enterDelay } from "@/lib/motion";
import type { ConnectorId } from "@/types/connectors";

/**
 * Blocking setup indicator shown while part of the stack is disconnected —
 * the pipeline can't produce anything until it's resolved.
 */
export function SetupBanner({ missing }: { missing: { id: ConnectorId; name: string }[] }) {
  const list = missing.map((connector) => connector.name).join(" and ");
  const first = missing[0];

  return (
    <Card
      className={`border-amber-600/40 bg-amber-600/5 py-4 dark:border-amber-400/30 dark:bg-amber-400/5 ${ENTER}`}
      style={enterDelay(1)}
    >
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full border bg-white shadow-sm">
            <Image src={CONNECTOR_LOGOS[first.id]} alt="" width={22} height={22} />
            <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
          </span>
          <div>
            <p className="text-sm font-medium">Connect {list} to bring Re:lay online.</p>
            <p className="text-muted-foreground text-sm">
              Signals can&apos;t reach your pipeline until your stack is fully connected.
            </p>
          </div>
        </div>
        <Link
          href="/integrations"
          className={`${buttonVariants()} transition-all duration-300 hover:scale-[1.03] active:scale-100`}
        >
          Connect {first.name}
          <ArrowRight aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}
