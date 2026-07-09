"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Plug, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { closeMockSession } from "@/lib/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProfileMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();

  function signOut() {
    closeMockSession();
    toast("Signed out — see you soon.");
    router.push("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Open profile menu"
            className="focus-visible:ring-ring/50 hover:ring-primary/30 data-popup-open:ring-primary/40 rounded-full ring-2 ring-transparent transition-all duration-200 hover:scale-105 focus-visible:ring-[3px] focus-visible:outline-none"
          />
        }
      >
        <Avatar name={name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2.5">
            <Avatar name={name} className="size-9" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="text-muted-foreground block truncate text-xs font-normal">
                {email}
              </span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/profile" />}>
            <UserRound aria-hidden />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/team" />}>
            <Users aria-hidden />
            Team
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/integrations" />}>
            <Plug aria-hidden />
            Integrations
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
