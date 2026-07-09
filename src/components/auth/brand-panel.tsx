"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const SignalScene = dynamic(() => import("./signal-scene").then((m) => m.SignalScene), {
  ssr: false,
});

/**
 * Left half of the auth screens: dark brand panel with the 3D signal sphere
 * and a value line fading in over it. Entrances are CSS-driven so they never
 * freeze under frame throttling.
 */
export function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#0a0a18] lg:block">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.22),transparent_65%)]"
      />
      <div aria-hidden className="absolute inset-0">
        <SignalScene />
      </div>

      <div className="relative flex h-full flex-col justify-between p-12">
        <div className="animate-in fade-in slide-in-from-top-2 fill-mode-both duration-700 motion-reduce:animate-none">
          <Link href="/login" className="text-xl font-semibold tracking-tight text-white">
            Re<span className="text-indigo-400">:</span>lay
          </Link>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both max-w-md space-y-4 delay-300 duration-700 motion-reduce:animate-none">
          <p className="text-3xl leading-snug font-semibold text-white">
            Your lost deals aren&apos;t dead.
            <br />
            <span className="text-indigo-300">They&apos;re waiting for a signal.</span>
          </p>
          <p className="text-sm leading-relaxed text-white/60">
            Re:lay watches your closed-lost pipeline, matches it with live buying signals, and hands
            your reps a ready-to-send play — autopsy, angle, and email included.
          </p>
        </div>
      </div>
    </div>
  );
}
