import type { Metadata } from "next";

import { AmbientBackdrop } from "@/components/brand/ambient-backdrop";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
};

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
