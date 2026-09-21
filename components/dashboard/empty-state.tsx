import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  action?: ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
  action,
}: EmptyStateProps) {
  return (
    <Card className="border-dashed border-slate-200/80 bg-white/50">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-14 items-center justify-center rounded-2xl border border-red-100 bg-red-50">
          <Icon className="size-7 text-[#e30613]" />
        </div>
        <CardTitle className="text-slate-900">{title}</CardTitle>
        <CardDescription className="max-w-md text-slate-500">
          {description}
        </CardDescription>
      </CardHeader>
      {(action || (actionHref && actionLabel)) && (
        <CardContent className="flex justify-center pb-6">
          {action ?? (
            <Button render={<Link href={actionHref!} />}>{actionLabel}</Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
