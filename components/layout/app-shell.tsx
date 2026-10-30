"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileUp,
  LogOut,
  Menu,
  PlusCircle,
  ReceiptText,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { RoleBadge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import type { SessionUser } from "@/lib/db/types";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ("admin" | "agent")[];
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Transaksi",
    href: "/transactions",
    icon: ReceiptText,
    roles: ["admin", "agent"],
  },
  {
    label: "Input Manual",
    href: "/transactions/new",
    icon: PlusCircle,
    roles: ["admin"],
  },
  {
    label: "Impor Excel",
    href: "/import",
    icon: FileUp,
    roles: ["admin"],
  },
  {
    label: "Pengguna",
    href: "/admin/users",
    icon: Users,
    roles: ["admin"],
  },
  {
    label: "Agen",
    href: "/admin/agents",
    icon: Building2,
    roles: ["admin"],
  },
  {
    label: "Pengaturan",
    href: "/settings",
    icon: Settings,
    roles: ["admin"],
  },
  {
    label: "Log Audit",
    href: "/admin/audit-logs",
    icon: ClipboardList,
    roles: ["admin"],
  },
  {
    label: "Akun Saya",
    href: "/account",
    icon: UserCog,
    roles: ["admin", "agent"],
  },
];

function isNavItemActive(pathname: string, itemHref: string): boolean {
  if (itemHref === "/transactions") {
    return (
      pathname === "/transactions" ||
      (pathname.startsWith("/transactions/") &&
        !pathname.startsWith("/transactions/new"))
    );
  }
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

export interface AppShellProps {
  session: SessionUser;
  pageTitle: string;
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({
  session,
  pageTitle,
  breadcrumb,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const visibleNav = NAV_ITEMS.filter((item) =>
    item.roles.includes(session.role)
  );

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan. Silakan coba lagi.");
      setIsLoggingOut(false);
    }
  }

  function renderNavList(isCollapsedView: boolean, onNavigate?: () => void) {
    return (
      <nav aria-label="Menu utama" className="space-y-1 px-3 py-4">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={isCollapsedView ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                isCollapsedView && "justify-center px-2",
                isActive
                  ? "bg-primary-50 text-primary-700 font-semibold"
                  : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
              )}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-accent-lime-500"
                />
              )}
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {!isCollapsedView && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-surface-app">
      {/* Sidebar Desktop (240px -> 72px collapsible) */}
      <aside
        className={cn(
          "no-print hidden md:sticky md:top-0 md:flex md:h-screen md:shrink-0 md:flex-col md:border-r md:border-surface-border md:bg-surface-sidebar transition-[width] duration-200",
          collapsed ? "md:w-[72px]" : "md:w-[240px]"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-surface-border px-4",
            collapsed ? "justify-center px-2" : "justify-between"
          )}
        >
          <Link
            href="/transactions"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <BrandLogo variant={collapsed ? "icon" : "horizontal"} />
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Ciutkan sidebar"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center border-b border-surface-border py-2">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Bentangkan sidebar"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">{renderNavList(collapsed)}</div>

        {/* Menu Akun di Bawah (nama + kode agen + Keluar) */}
        <div className="border-t border-surface-border p-3 space-y-1.5">
          <Link
            href="/account"
            title={collapsed ? `Profil ${session.name}` : "Buka profil akun"}
            className={cn(
              "flex items-center gap-2.5 rounded-md bg-neutral-25 px-2.5 py-2 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              collapsed && "justify-center px-1"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-800 uppercase">
              {session.name.slice(0, 2)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-neutral-900">
                  {session.name}
                </p>
                <p className="truncate text-[11px] text-neutral-500">
                  {session.agentCode
                    ? `Agen ${session.agentCode}`
                    : "Administrator"}
                </p>
              </div>
            )}
          </Link>

          <button
            type="button"
            disabled={isLoggingOut}
            onClick={handleLogout}
            title={collapsed ? "Keluar" : undefined}
            aria-label="Keluar"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-debit-bg/50 hover:text-debit-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 cursor-pointer",
              collapsed && "justify-center px-2"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && (
              <span>{isLoggingOut ? "Keluar..." : "Keluar"}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Drawer Navigasi Mobile */}
      <Drawer
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        title="Navigasi"
        side="left"
        className="max-w-[280px]"
      >
        <div className="-mx-5 -mt-5">
          <div className="border-b border-surface-border px-5 py-4">
            <BrandLogo variant="horizontal" />
          </div>
          {renderNavList(false, () => setMobileNavOpen(false))}
          <div className="mt-4 space-y-3 border-t border-surface-border px-5 pt-4">
            <div>
              <p className="text-xs font-semibold text-neutral-900">
                {session.name}
              </p>
              <p className="text-xs text-neutral-500">
                {session.agentCode
                  ? `Kode Agen: ${session.agentCode}`
                  : "Administrator"}
              </p>
            </div>
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleLogout}
              className="flex h-10 w-full items-center gap-2.5 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{isLoggingOut ? "Keluar..." : "Keluar"}</span>
            </button>
          </div>
        </div>
      </Drawer>

      {/* Area Utama */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar (64px) */}
        <header className="no-print sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-surface-border bg-surface-card px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Buka menu navigasi"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 md:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="md:hidden">
              <BrandLogo variant="icon" />
            </div>
            <div className="min-w-0">
              {breadcrumb && <div className="mb-0.5">{breadcrumb}</div>}
              <h1 className="truncate text-lg font-bold leading-7 text-neutral-900 sm:text-2xl sm:leading-8">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {session.agentCode && (
              <span className="hidden text-xs font-mono font-medium text-neutral-500 sm:inline">
                {session.agentCode}
              </span>
            )}
            <RoleBadge role={session.role} />
          </div>
        </header>

        {/* Konten Halaman (max-width 1440px, padding responsif 16/24/32px) */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
