"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { resetPasswordWithToken } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/client";

export function ResetPasswordForm({ token }: { token: string }) {
  const { t, tm } = useI18n();
  const copy = t.auth.reset;
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resetPasswordWithToken({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      if (!result.ok) {
        setError(tm(result.error));
        return;
      }
      router.replace("/login?reset=1");
    });
  }

  return (
    <div className="glass-panel-strong relative overflow-hidden rounded-3xl p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e30613]/60 to-transparent"
      />
      <div className="relative space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {copy.title}
          </h1>
          <p className="text-sm text-slate-500">
            {copy.description}
          </p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="new_password">{copy.newPassword}</Label>
            <Input
              id="new_password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              disabled={pending}
              className="glass-input h-11 rounded-xl"
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">{copy.confirmPassword}</Label>
            <Input
              id="confirm_password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              disabled={pending}
              className="glass-input h-11 rounded-xl"
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="h-11 w-full rounded-xl"
            disabled={pending}
          >
            {pending ? copy.submitting : copy.submit}
          </Button>
        </form>
        <p className="text-center text-sm text-slate-500">
          <Link
            href="/login"
            className="font-medium text-[#e30613] underline-offset-4 hover:underline"
          >
            {copy.backToSignIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
