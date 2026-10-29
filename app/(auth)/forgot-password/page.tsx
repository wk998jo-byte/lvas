import type { Metadata } from "next";

import { AmbientBackdrop } from "@/components/brand/ambient-backdrop";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.metadata.forgotPassword };
}

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden p-6">
      <AmbientBackdrop intensity="login" />
      <div className="relative z-10 w-full max-w-md animate-rise">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
