import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { BadgeStatusForm } from "@/components/public/badge-status-form";

export const metadata: Metadata = {
  title: "Track my requests",
  description: "Look up vehicle authorization requests by badge number.",
};

export const dynamic = "force-dynamic";

export default function BadgeStatusPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[#e30613] uppercase">
          <ClipboardList className="size-3.5" />
          Request status
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Track requests by badge
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Enter your badge number to see every authorization linked to you,
          including pending, approved, rejected, and expired requests.
        </p>
        <p className="text-sm text-slate-500">
          Need a new one?{" "}
          <Link
            href="/request"
            className="font-semibold text-[#e30613] underline-offset-4 hover:underline"
          >
            Submit a request
          </Link>
        </p>
      </header>
      <BadgeStatusForm />
    </div>
  );
}
