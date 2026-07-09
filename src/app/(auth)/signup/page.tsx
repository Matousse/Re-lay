import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account — Re:lay",
};

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your workspace"
      description="Plug Re:lay into your CRM and start reviving lost deals."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="text-foreground font-medium hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
