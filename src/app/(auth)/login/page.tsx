import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — Re:lay",
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to pick up where your agent left off."
      footer={
        <p>
          New to Re:lay?{" "}
          <Link href="/signup" className="text-foreground font-medium hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
