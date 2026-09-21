"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import {
  approveAuthorization,
  rejectAuthorization,
} from "@/actions/approvals";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ApprovalActionsProps = {
  authorizationId: string;
};

export function ApprovalActions({ authorizationId }: ApprovalActionsProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveAuthorization({ id: authorizationId });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Request approved");
    });
  }

  function onReject() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Rejection reason is required");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await rejectAuthorization({
        id: authorizationId,
        rejection_reason: trimmed,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Request rejected");
      setRejectOpen(false);
      setReason("");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-full bg-emerald-600 shadow-[0_10px_24px_-12px_rgba(5,150,105,0.8)] hover:bg-emerald-700"
          disabled={pending}
          onClick={onApprove}
        >
          <Check className="size-3.5" />
          {pending ? "Working…" : "Approve"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          disabled={pending}
          onClick={() => {
            setError(null);
            setRejectOpen(true);
          }}
        >
          <X className="size-3.5" />
          Reject
        </Button>
      </div>

      {error && !rejectOpen ? (
        <p
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) {
            setError(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject authorization</DialogTitle>
            <DialogDescription>
              A rejection reason is required and will be shared with the
              requester.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection_reason">Reason</Label>
            <Textarea
              id="rejection_reason"
              value={reason}
              disabled={pending}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this request is rejected"
              className="min-h-28 rounded-xl"
              required
            />
            {error ? (
              <p className="text-sm text-rose-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={pending}
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
              disabled={pending}
              onClick={onReject}
            >
              {pending ? "Rejecting…" : "Confirm rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
