"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { signInWithPassword } from "@/actions/auth";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/client";

export function LoginForm() {
  const { t, tm } = useI18n();
  const copy = t.auth.login;
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const sessionError = searchParams.get("error") === "session";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() =>
    sessionError ? copy.sessionError : null,
  );
  const passwordReset = searchParams.get("reset") === "1";
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signInWithPassword({
        email,
        password,
        next: nextPath,
      });

      if (!result.ok) {
        setError(tm(result.error));
        return;
      }

      router.replace(result.data.next);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? tm(err.message)
          : typeof err === "string"
            ? tm(err)
            : copy.failed;
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-panel-strong relative overflow-hidden rounded-3xl p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e30613]/60 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 size-48 -translate-x-1/2 rounded-full bg-[#e30613]/10 blur-3xl"
      />

      <div className="relative space-y-8">
        <div className="space-y-5 text-center">
          <BrandLogo variant="full" tone="light" priority />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {copy.title}
            </h1>
            <p className="text-sm text-slate-500">
              {copy.subtitle}
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700">
              {copy.email}
            </Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="glass-input h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-700">
              {copy.password}
            </Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="glass-input h-11 rounded-xl"
            />
          </div>
          <div className="text-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-[#e30613] underline-offset-4 hover:underline"
            >
              {copy.forgotPassword}
            </Link>
          </div>
          {passwordReset ? (
            <p className="text-sm text-emerald-700" role="status">
              {copy.passwordReset}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            className="h-11 w-full rounded-xl text-base font-semibold"
            type="submit"
            disabled={loading}
          >
            {loading ? copy.submitting : copy.submit}
          </Button>
        </form>
      </div>
    </div>
  );
}
