import Link from "next/link";
import { redirect } from "next/navigation";

import { AmbientBackdrop } from "@/components/brand/ambient-backdrop";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const profile = await getCurrentProfile();
  if (profile?.role === "admin" && profile.is_active) {
    redirect("/");
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden p-6">
      <AmbientBackdrop intensity="login" />
      <div className="relative z-10 w-full max-w-md animate-rise space-y-4">
        <LoginForm />
        <p className="text-center text-sm text-slate-500">
          Sign-in is for administrators. Employees can{" "}
          <Link
            href="/request"
            className="font-semibold text-[#e30613] underline-offset-4 hover:underline"
          >
            submit a request without an account
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
