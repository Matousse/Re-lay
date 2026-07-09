"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CurrentUser } from "@/types/workspace";

export function ProfileForm({ user }: { user: CurrentUser }) {
  const [name, setName] = useState(user.name);
  const [title, setTitle] = useState(user.title);
  const [email, setEmail] = useState(user.email);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        toast.success("Profile saved.");
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="profile-name" className="text-sm font-medium">
            Full name
          </label>
          <Input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="profile-title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="profile-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="profile-email" className="text-sm font-medium">
          Work email
        </label>
        <Input
          id="profile-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
      </div>
      <Button type="submit">
        <Check aria-hidden />
        Save changes
      </Button>
    </form>
  );
}
