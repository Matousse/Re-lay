"use client";

import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMockSignIn } from "@/hooks/use-mock-sign-in";
import { ENTER, enterDelay } from "@/lib/motion";

export function SignupForm() {
  const { pending, signIn } = useMockSignIn();

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        signIn("Account created — welcome to Re:lay.");
      }}
    >
      <div className={`space-y-2 ${ENTER}`} style={enterDelay(3)}>
        <label htmlFor="name" className="text-sm font-medium">
          Full name
        </label>
        <Input
          id="name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          required
          className="h-11 px-3.5 text-[0.95rem]"
        />
      </div>

      <div className={`space-y-2 ${ENTER}`} style={enterDelay(4)}>
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

      <div className={`space-y-2 ${ENTER}`} style={enterDelay(5)}>
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <PasswordInput id="password" autoComplete="new-password" />
        <p className="text-muted-foreground text-sm">At least 8 characters.</p>
      </div>

      <div className={`pt-2 ${ENTER}`} style={enterDelay(6)}>
        <Button type="submit" className="h-11 w-full text-[0.95rem]" disabled={pending}>
          {pending && (
            <span
              aria-hidden
              className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          )}
          {pending ? "Creating your workspace…" : "Create account"}
        </Button>
      </div>
    </form>
  );
}
