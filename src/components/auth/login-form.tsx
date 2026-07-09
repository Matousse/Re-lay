"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useMockSignIn } from "@/hooks/use-mock-sign-in";
import { ENTER, enterDelay } from "@/lib/motion";

function Pending() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function LoginForm() {
  const { pending, signIn } = useMockSignIn();

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        signIn("Welcome back, Darren.");
      }}
    >
      <div className={`space-y-2 ${ENTER}`} style={enterDelay(3)}>
        <label htmlFor="email" className="text-sm font-medium">
          Work email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          className="h-11 px-3.5 text-[0.95rem]"
        />
      </div>

      <div className={`space-y-2 ${ENTER}`} style={enterDelay(4)}>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput id="password" autoComplete="current-password" />
      </div>

      <div className={`space-y-4 pt-2 ${ENTER}`} style={enterDelay(5)}>
        <Button type="submit" className="h-11 w-full text-[0.95rem]" disabled={pending}>
          {pending && <Pending />}
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs tracking-wide uppercase">or</span>
          <Separator className="flex-1" />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full text-[0.95rem]"
          disabled={pending}
          onClick={() => signIn("Signed in with SSO.")}
        >
          <KeyRound aria-hidden />
          Continue with SSO
        </Button>
      </div>
    </form>
  );
}
