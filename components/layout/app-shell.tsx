"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutDashboard,
  PanelLeft,
  UsersRound,
} from "lucide-react";

import { AmbientBackdrop } from "@/components/brand/ambient-backdrop";
import { BrandLogo } from "@/components/brand/logo";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Profile, UserRole } from "@/types/database";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Car;
  roles: UserRole[];
  badge?: number;
};

type AppShellProps = {
  profile: Profile;
  /** Requests waiting for a decision, shown as a badge on the dashboard link. */
  pendingCount: number;
  children: ReactNode;
};

const STORAGE_KEY = "lvas-sidebar-collapsed";

function pageMeta(pathname: string): {
  title: string;
  crumbs: { label: string; href?: string }[];
} {
  if (pathname.startsWith("/history/") && pathname !== "/history") {
    return {
      title: "Authorization details",
      crumbs: [
        { label: "Home", href: "/" },
        { label: "Requests history", href: "/history" },
        { label: "Details" },
      ],
    };
  }
  if (pathname.startsWith("/history")) {
    return {
      title: "Requests history",
      crumbs: [{ label: "Home", href: "/" }, { label: "Requests history" }],
    };
  }
  if (pathname.startsWith("/vehicles/") && pathname !== "/vehicles") {
    return {
      title: "Vehicle details",
      crumbs: [
        { label: "Home", href: "/" },
        { label: "Vehicles", href: "/vehicles" },
        { label: "Details" },
      ],
    };
  }
  if (pathname.startsWith("/vehicles")) {
    return {
      title: "Vehicles",
      crumbs: [{ label: "Home", href: "/" }, { label: "Vehicles" }],
    };
  }
  if (pathname.startsWith("/admin/employees")) {
    return {
      title: "Employees",
      crumbs: [
        { label: "Home", href: "/" },
        { label: "Admin" },
        { label: "Employees" },
      ],
    };
  }
  return { title: "Dashboard", crumbs: [{ label: "Home" }] };
}

export function AppShell({ profile, pendingCount, children }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const links: NavItem[] = (
    [
      {
        href: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: ["admin"] as UserRole[],
        badge: pendingCount,
      },
      {
        href: "/history",
        label: "Requests history",
        icon: History,
        roles: ["admin"] as UserRole[],
      },
      {
        href: "/vehicles",
        label: "Vehicles",
        icon: Car,
        roles: ["admin"] as UserRole[],
      },
      {
        href: "/admin/employees",
        label: "Employees",
        icon: UsersRound,
        roles: ["admin"] as UserRole[],
      },
    ] satisfies NavItem[]
  ).filter((link) => link.roles.includes(profile.role));

  const { title, crumbs } = pageMeta(pathname);

  const sidebar = (
    <aside
      className={cn(
        "glass-panel relative flex h-full flex-col overflow-hidden border-y-0 border-l-0 text-slate-800 transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e30613]/50 to-transparent"
      />
      <div
        className={cn(
          "flex h-16 items-center border-b border-slate-200/60 px-3",
          collapsed && "justify-center",
        )}
      >
        {collapsed ? (
          <BrandLogo variant="mark" />
        ) : (
          <BrandLogo variant="compact" tone="light" />
        )}
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {links.map((link) => {
          const Icon = link.icon;
          const active =
            pathname === link.href ||
            (link.href !== "/" && pathname.startsWith(link.href));

          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-all",
                active
                  ? "border border-[#e30613]/20 bg-[#e30613]/8 text-[#991b1b] shadow-sm"
                  : "border border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-white/70 hover:text-slate-900",
                collapsed && "justify-center px-0",
              )}
            >
              {active ? (
                <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#e30613]" />
              ) : null}
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-[#e30613]" : "text-slate-400",
                )}
              />
              {!collapsed ? (
                <>
                  <span className="flex-1 truncate font-medium">{link.label}</span>
                  {link.badge && link.badge > 0 ? (
                    <Badge className="border-0 bg-[#e30613] text-white hover:bg-[#e30613]">
                      {link.badge > 99 ? "99+" : link.badge}
                    </Badge>
                  ) : null}
                </>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200/60 p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-center text-slate-500 hover:bg-white/80 hover:text-slate-800"
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <>
              <ChevronLeft className="size-4" />
              Collapse
            </>
          )}
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="relative flex min-h-svh overflow-hidden">
      <AmbientBackdrop intensity="app" />

      <div className="relative z-10 hidden md:block md:py-3 md:pl-3">
        {sidebar}
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 p-3 shadow-xl">
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col md:py-3 md:pr-3">
        <header className="glass-panel sticky top-0 z-40 mx-3 mt-3 rounded-2xl md:mx-0 md:mt-0">
          <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-slate-600 hover:bg-white/80 hover:text-slate-900 md:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <PanelLeft className="size-4" />
              </Button>
              <nav
                aria-label="Breadcrumb"
                className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500"
              >
                {crumbs.map((crumb, index) => {
                  const isLast = index === crumbs.length - 1;
                  return (
                    <span
                      key={`${crumb.label}-${index}`}
                      className="flex min-w-0 items-center gap-1.5"
                    >
                      {index > 0 ? (
                        <span className="text-slate-300">/</span>
                      ) : null}
                      {crumb.href && !isLast ? (
                        <Link
                          href={crumb.href}
                          className="truncate hover:text-slate-800"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            "truncate",
                            isLast
                              ? "font-medium text-slate-900"
                              : "text-slate-500",
                          )}
                        >
                          {isLast ? title : crumb.label}
                        </span>
                      )}
                    </span>
                  );
                })}
              </nav>
            </div>
            <UserMenu profile={profile} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 animate-rise px-4 py-6 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
