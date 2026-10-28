"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { changePassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/client";

export function ChangePasswordForm() {
  const { t, tm } = useI18n();
  const copy = t.auth.change;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      if (!result.ok) {
        setError(tm(result.error));
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(copy.success);
    });
  }

  return (
    <form
      className="max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={onSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="current_password">{copy.currentPassword}</Label>
        <Input
          id="current_password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          required
          value={currentPassword}
          disabled={pending}
          className="h-11 rounded-xl"
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </div>
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
          className="h-11 rounded-xl"
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
          className="h-11 rounded-xl"
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>
      <p className="text-xs text-slate-500">{copy.hint}</p>
      {error ? (
        <p
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 rounded-full" disabled={pending}>
        {pending ? copy.submitting : copy.submit}
      </Button>
    </form>
  );
}
