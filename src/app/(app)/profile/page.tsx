import type { Metadata } from "next";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/workspace/profile-form";
import { ENTER, enterDelay } from "@/lib/motion";
import { getCurrentUser } from "@/services/workspace";

export const metadata: Metadata = {
  title: "Profile — Re:lay",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();

  const stats = [
    { label: "Plays approved", value: user.stats.playsApproved },
    { label: "Emails sent", value: user.stats.emailsSent },
    { label: "Replies", value: user.stats.replies },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className={`mb-8 flex items-center gap-4 ${ENTER}`}>
        <Avatar name={user.name} className="size-14 text-lg" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
          <p className="text-muted-foreground text-sm">
            {user.title} ·{" "}
            <Badge variant="secondary" className="align-middle capitalize">
              {user.role}
            </Badge>
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <Card className={ENTER} style={enterDelay(1)}>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>How you appear to your team and in CRM notes.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm user={user} />
          </CardContent>
        </Card>

        <Card className={ENTER} style={enterDelay(2)}>
          <CardHeader>
            <CardTitle className="text-base">This month</CardTitle>
            <CardDescription>Your re-engagement activity through Re:lay.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`rounded-lg border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${ENTER}`}
                  style={enterDelay(index + 3)}
                >
                  <p className="text-2xl font-semibold">{stat.value}</p>
                  <p className="text-muted-foreground text-xs">{stat.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
