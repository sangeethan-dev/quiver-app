import type { ReactNode } from "react";
import { QuiverMark } from "@/components/quiver-mark";

interface OnboardingShellProps {
  title: string;
  children: ReactNode;
}

export function OnboardingShell({ title, children }: OnboardingShellProps) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col gap-5 rounded-xl bg-surface-1 p-8">
        <QuiverMark className="size-11 text-primary" />
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </main>
  );
}
