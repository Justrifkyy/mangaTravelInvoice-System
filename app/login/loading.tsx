import { LoginCardSkeleton } from "@/components/ui/skeleton";

export default function LoginLoading() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-surface-app px-4 py-12">
      <LoginCardSkeleton />
    </main>
  );
}

