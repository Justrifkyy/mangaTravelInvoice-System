import * as React from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Skeleton } from "@/components/ui/skeleton";

export function AppShellSkeleton({
  pageTitle,
  children,
}: {
  pageTitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-surface-app">
      <aside className="hidden md:flex md:w-[240px] md:shrink-0 md:flex-col md:border-r md:border-surface-border md:bg-surface-sidebar">
        <div className="flex h-16 items-center border-b border-surface-border px-4">
          <BrandLogo variant="horizontal" />
        </div>
        <div className="flex-1 space-y-2 px-3 py-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-full opacity-50" />
          <Skeleton className="h-9 w-full opacity-50" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-surface-border bg-surface-card px-4 sm:px-6 lg:px-8">
          <h1 className="text-lg font-bold text-neutral-900 sm:text-2xl">
            {pageTitle}
          </h1>
          <Skeleton className="h-8 w-44" />
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

