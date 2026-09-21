import { cn } from "@/lib/utils";

type AmbientBackdropProps = {
  className?: string;
  intensity?: "login" | "app";
};

export function AmbientBackdrop({
  className,
  intensity = "app",
}: AmbientBackdropProps) {
  const strong = intensity === "login";

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#fafbfd] via-[#f4f6fb] to-[#fef2f2]" />
      <div
        className={cn(
          "absolute -top-32 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(227,6,19,0.12),transparent_62%)] blur-3xl",
          strong && "animate-ambient",
        )}
      />
      <div
        className={cn(
          "absolute -bottom-24 -left-20 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(227,6,19,0.08),transparent_65%)] blur-3xl",
          strong && "animate-ambient-delayed",
        )}
      />
      <div className="absolute top-1/4 -right-20 h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.14),transparent_70%)] blur-3xl" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at center, black 15%, transparent 72%)",
        }}
      />
    </div>
  );
}
