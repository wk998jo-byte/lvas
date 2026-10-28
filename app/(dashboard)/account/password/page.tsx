import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { requireUser } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.metadata.changePassword };
}

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  await requireUser();
  const { t } = await getI18n();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t.auth.change.title}
        </h1>
        <p className="max-w-xl text-sm text-slate-600">
          {t.auth.change.description}
        </p>
      </header>
      <ChangePasswordForm />
    </div>
  );
}
