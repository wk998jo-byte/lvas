"use client";

import { useTransition } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";

import { endAuthorization } from "@/actions/approvals";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export function EndAuthorizationAction({
  authorizationId,
}: {
  authorizationId: string;
}) {
  const { t, tm } = useI18n();
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
            toast.error(tm(result.error));
            return;
          }
          toast.success(t.approvals.endAuthorization.ended);
        });
      }}
    >
      <Ban className="size-3.5" />
      {pending ? t.approvals.endAuthorization.ending : t.approvals.endAuthorization.label}
    </Button>
  );
}
