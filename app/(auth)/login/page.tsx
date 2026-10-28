import Link from "next/link";
import { redirect } from "next/navigation";

import { AmbientBackdrop } from "@/components/brand/ambient-backdrop";
import { LoginForm } from "@/components/auth/login-form";
import { DASHBOARD_ROLES, hasRole } from "@/lib/auth/roles";
import { getCurrentProfile } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const profile = await getCurrentProfile();
  if (profile?.is_active && hasRole(profile.role, DASHBOARD_ROLES)) {
    redirect("/");
  }
  const { t } = await getI18n();
  const copy = t.auth.loginPage;

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden p-6">
      <AmbientBackdrop intensity="login" />
      <div className="relative z-10 w-full max-w-md animate-rise space-y-4">
        <LoginForm />
        <p className="text-center text-sm text-slate-500">
          {copy.intro}{" "}
          <Link
            href="/request"
            className="font-semibold text-[#e30613] underline-offset-4 hover:underline"
          >
            {copy.submitRequest}
          </Link>{" "}
          {copy.or}{" "}
          <Link
            href="/status"
            className="font-semibold text-[#e30613] underline-offset-4 hover:underline"
          >
            {copy.trackByBadge}
          </Link>{" "}
          {copy.withoutAccount}
        </p>
      </div>
    </main>
  );
}
