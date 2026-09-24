"use client";

import { useTransition } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";

import { endAuthorization } from "@/actions/approvals";
import { Button } from "@/components/ui/button";

export function EndAuthorizationAction({
  authorizationId,
}: {
  authorizationId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="rounded-full border-slate-300 text-slate-700 hover:bg-slate-50"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await endAuthorization({ id: authorizationId });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Authorization ended");
        });
      }}
    >
      <Ban className="size-3.5" />
      {pending ? "Ending…" : "End Authorization"}
    </Button>
  );
}
