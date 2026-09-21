import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "full" | "compact" | "mark";
  /** Use `light` on white/print surfaces */
  tone?: "dark" | "light";
  className?: string;
  priority?: boolean;
};

function Wordmark({
  stacked = false,
  onDark = true,
}: {
  stacked?: boolean;
  onDark?: boolean;
}) {
  return (
    <div className={cn("min-w-0 leading-tight", stacked && "text-center")}>
      <p
        className={cn(
          "truncate text-[15px] font-semibold tracking-wide",
          onDark ? "text-white" : "text-zinc-900",
        )}
        dir="rtl"
      >
        بن قريعة
      </p>
      <p
        className={cn(
          "truncate text-[11px] font-semibold tracking-[0.22em] uppercase",
          onDark ? "text-zinc-300" : "text-zinc-600",
        )}
      >
        Bin Quraya
      </p>
    </div>
  );
}

function LogoMark({
  size = 40,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-[0_8px_24px_-12px_rgba(227,6,19,0.22)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo-mark.png"
        alt=""
        width={size - 8}
        height={size - 8}
        priority={priority}
        className="size-full object-contain"
      />
    </div>
  );
}

export function BrandLogo({
  variant = "full",
  tone = "light",
  className,
  priority = false,
}: BrandLogoProps) {
  const onDark = tone === "dark";

  if (variant === "mark") {
    return <LogoMark size={40} priority={priority} className={className} />;
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex min-w-0 items-center gap-3", className)}>
        <LogoMark size={44} priority={priority} />
        <Wordmark onDark={onDark} />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <LogoMark size={72} priority={priority} className="rounded-2xl p-1.5" />
      <Wordmark stacked onDark={onDark} />
      <p className="text-[11px] font-semibold tracking-[0.28em] text-[#e30613] uppercase">
        LVAS
      </p>
    </div>
  );
}
