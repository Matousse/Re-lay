import { z } from "zod";

export const TeamRoleSchema = z.enum(["admin", "member"]);
export const TeamMemberStatusSchema = z.enum(["active", "invited"]);

export const TeamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: TeamRoleSchema,
  status: TeamMemberStatusSchema,
  title: z.string(),
});

export const CurrentUserSchema = TeamMemberSchema.extend({
  stats: z.object({
    playsApproved: z.number(),
    emailsSent: z.number(),
    replies: z.number(),
  }),
});

export type TeamRole = z.infer<typeof TeamRoleSchema>;
export type TeamMemberStatus = z.infer<typeof TeamMemberStatusSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type CurrentUser = z.infer<typeof CurrentUserSchema>;

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
