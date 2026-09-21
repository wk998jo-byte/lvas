"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
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
              toast.error(result.error);
              return;
            }
            router.replace("/login");
            router.refresh();
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Sign out failed",
            );
          }
        });
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
