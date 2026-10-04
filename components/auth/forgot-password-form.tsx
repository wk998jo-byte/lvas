"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";

import { requestPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<"email" | "pending-setup" | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset({ email });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(result.data.emailed ? "email" : "pending-setup");
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
            Forgot password
          </h1>
          <p className="text-sm text-slate-500">
            Enter the email for your LVAS account. If it can sign in, we will
            send a link to choose a new password.
          </p>
        </div>
        {sent === "email" ? (
          <p className="text-sm text-emerald-700" role="status">
            If this email can sign in, a reset link is on its way. The link
            expires in 30 minutes.
          </p>
        ) : sent === "pending-setup" ? (
          <p className="text-sm text-slate-600" role="status">
            Password reset email is not configured on this server yet. Contact
            the fleet administrator.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                disabled={pending}
                className="glass-input h-11 rounded-xl"
                onChange={(event) => setEmail(event.target.value)}
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
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-slate-500">
          <Link
            href="/login"
            className="font-medium text-[#e30613] underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
