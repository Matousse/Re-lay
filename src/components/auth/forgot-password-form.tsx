"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Collapse } from "@/components/collapse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ENTER, enterDelay } from "@/lib/motion";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div>
      <Collapse open={!sent}>
        <form
          className="space-y-6 pb-px"
          onSubmit={(event) => {
            event.preventDefault();
            setSent(true);
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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="h-11 px-3.5 text-[0.95rem]"
            />
          </div>
          <div className={ENTER} style={enterDelay(4)}>
            <Button type="submit" className="h-11 w-full text-[0.95rem]">
              Send reset link
            </Button>
          </div>
        </form>
      </Collapse>

      <Collapse open={sent}>
        <div className="space-y-6 pb-px text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
            <MailCheck aria-hidden className="size-6" />
          </span>
          <div className="space-y-1.5">
            <p className="text-base font-medium">Check your inbox</p>
            <p className="text-muted-foreground text-sm">
              We sent a reset link to{" "}
              <span className="text-foreground">{email || "your email"}</span>.
            </p>
          </div>
          <Button
            variant="outline"
            className="h-11 w-full text-[0.95rem]"
            onClick={() => setSent(false)}
          >
            Use a different email
          </Button>
        </div>
      </Collapse>
    </div>
  );
}
