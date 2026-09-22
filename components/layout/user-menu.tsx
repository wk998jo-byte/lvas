"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { signOut } from "@/actions/auth";
import { roleLabel } from "@/lib/auth/roles";
import type { Profile } from "@/types/database";

function initials(profile: Profile): string {
  const source = profile.full_name?.trim() || profile.email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-1.5 pr-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-white"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-[#e30613] text-[11px] font-semibold text-white">
          {initials(profile)}
        </span>
        <span className="hidden max-w-28 truncate sm:inline">
          {profile.full_name || profile.email}
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="menu"
          aria-label="Account menu"
          className="absolute top-full right-0 z-50 mt-2 min-w-56 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <div className="space-y-0.5 px-1.5 py-1">
            <p className="truncate text-sm font-medium text-foreground">
              {profile.full_name || "User"}
            </p>
            <p className="truncate text-xs font-normal text-muted-foreground">
              {profile.email}
            </p>
            <p className="text-xs font-normal text-muted-foreground">
              {roleLabel(profile.role)}
            </p>
          </div>
          <div className="-mx-1 my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            className="flex w-full cursor-default items-center gap-2 rounded-md px-1.5 py-1 text-sm text-destructive outline-hidden select-none hover:bg-destructive/10 focus:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              startTransition(async () => {
                const result = await signOut();
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setOpen(false);
                router.replace("/login");
                router.refresh();
              });
            }}
          >
            <LogOut className="size-4" />
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
