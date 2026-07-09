"use client";

import { useState } from "react";
import { UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteForm() {
  const [email, setEmail] = useState("");

  return (
    <form
      className="flex w-full max-w-sm items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!email.trim()) return;
        toast.success(`Invitation sent to ${email.trim()}.`);
        setEmail("");
      }}
    >
      <Input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="teammate@company.com"
        aria-label="Teammate email"
        required
      />
      <Button type="submit">
        <UserRoundPlus aria-hidden />
        Invite
      </Button>
    </form>
  );
}
