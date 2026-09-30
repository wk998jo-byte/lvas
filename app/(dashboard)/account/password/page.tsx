import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Change password",
};

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Change password
        </h1>
        <p className="max-w-xl text-sm text-slate-600">
          Enter your current password, then choose a new one. This replaces the
          shared temporary password for your account only.
        </p>
      </header>
      <ChangePasswordForm />
    </div>
  );
}
