import type { Metadata } from "next";
import Link from "next/link";

import { AmbientBackdrop } from "@/components/brand/ambient-backdrop";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = token.trim().length >= 20;

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden p-6">
      <AmbientBackdrop intensity="login" />
      <div className="relative z-10 w-full max-w-md animate-rise">
        {valid ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="glass-panel-strong rounded-3xl p-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              This reset link is invalid
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Request a new link from the sign-in page.
            </p>
            <Link
              href="/forgot-password"
              className="mt-4 inline-block text-sm font-medium text-[#e30613] underline-offset-4 hover:underline"
            >
              Forgot password
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
