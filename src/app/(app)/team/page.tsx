import type { Metadata } from "next";
import { Check, Clock } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InviteForm } from "@/components/workspace/invite-form";
import { ENTER, enterDelay } from "@/lib/motion";
import { listTeamMembers } from "@/services/workspace";

export const metadata: Metadata = {
  title: "Team — Re:lay",
};

export default async function TeamPage() {
  const members = await listTeamMembers();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className={`mb-8 flex flex-wrap items-end justify-between gap-4 ${ENTER}`}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Everyone who can review and approve plays in this workspace.
          </p>
        </div>
        <InviteForm />
      </div>

      <Card className={`py-0 ${ENTER}`} style={enterDelay(1)}>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member, index) => (
                <TableRow key={member.id} className={ENTER} style={enterDelay(index + 2)}>
                  <TableCell className="pl-6">
                    <span className="flex items-center gap-3">
                      <Avatar name={member.name} />
                      <span>
                        <span className="block font-medium">{member.name}</span>
                        <span className="text-muted-foreground block text-xs">{member.title}</span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={member.role === "admin" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6">
                    {member.status === "active" ? (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400"
                      >
                        <Check aria-hidden />
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-amber-600/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400"
                      >
                        <Clock aria-hidden />
                        Invited
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
