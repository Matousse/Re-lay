import type { CurrentUser, TeamMember } from "@/types/workspace";

// Mocked workspace identity — replaced by real auth/org data after the
// hackathon (no DB for this iteration).
const CURRENT_USER: CurrentUser = {
  id: "user-darren",
  name: "Darren Cohen",
  email: "darren@relay.run",
  role: "admin",
  status: "active",
  title: "Founding engineer",
  stats: { playsApproved: 12, emailsSent: 9, replies: 4 },
};

const TEAM: TeamMember[] = [
  { ...CURRENT_USER },
  {
    id: "user-mateo",
    name: "Matéo Le Bras Sancho",
    email: "mateo@relay.run",
    role: "member",
    status: "active",
    title: "Agent pipeline",
  },
  {
    id: "user-damien",
    name: "Damien Mathis",
    email: "damien@relay.run",
    role: "member",
    status: "active",
    title: "Infra & deploys",
  },
  {
    id: "user-mabrouk",
    name: "Mabrouk Chouikri",
    email: "mabrouk@relay.run",
    role: "member",
    status: "active",
    title: "Product & data",
  },
  {
    id: "user-janadan",
    name: "Janadan Ilankumaran",
    email: "janadan@relay.run",
    role: "member",
    status: "invited",
    title: "GTM strategy",
  },
];

export async function fetchCurrentUser(): Promise<CurrentUser> {
  return CURRENT_USER;
}

export async function fetchTeam(): Promise<TeamMember[]> {
  return TEAM;
}
