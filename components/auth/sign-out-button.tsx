"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export function SignOutButton() {
  const { t, tm } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await signOut();
            if (!result.ok) {
              toast.error(tm(result.error));
              return;
            }
            router.replace("/login");
            router.refresh();
          } catch (error) {
            toast.error(
              error instanceof Error ? tm(error.message) : t.auth.signOut.failed,
            );
          }
        });
      }}
    >
      {pending ? t.auth.signOut.submitting : t.auth.signOut.submit}
    </Button>
  );
}
