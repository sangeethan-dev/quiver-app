"use client";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <OnboardingShell title="Something went wrong">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Quiver hit a problem and couldn&apos;t continue. Your prompts are files in your folder, so
        they aren&apos;t stored in this page. Any edit you hadn&apos;t saved may be lost.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Reload Quiver
        </Button>
      </div>
    </OnboardingShell>
  );
}
