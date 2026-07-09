import { fetchCurrentUser, fetchTeam } from "@/integrations/workspace";
import type { CurrentUser, TeamMember } from "@/types/workspace";

export async function getCurrentUser(): Promise<CurrentUser> {
  return fetchCurrentUser();
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const members = await fetchTeam();
  return members.toSorted((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
}
