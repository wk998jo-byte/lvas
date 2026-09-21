"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { signOut } from "@/actions/auth";
import { roleLabel } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-2 rounded-full border border-slate-200/80 bg-white/80 px-1.5 pr-2.5 shadow-sm hover:bg-white"
          />
        }
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-[#e30613] text-[11px] font-semibold text-white">
          {initials(profile)}
        </span>
        <span className="hidden max-w-28 truncate text-sm font-medium text-slate-700 sm:inline">
          {profile.full_name || profile.email}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate text-sm font-medium text-foreground">
            {profile.full_name || "User"}
          </p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {profile.email}
          </p>
          <p className="text-xs font-normal text-muted-foreground">
            {roleLabel(profile.role)}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          className="gap-2"
          onClick={() => {
            startTransition(async () => {
              const result = await signOut();
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              router.replace("/login");
              router.refresh();
            });
          }}
        >
          <LogOut className="size-4" />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
