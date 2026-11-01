import { OnboardingShell } from "@/components/onboarding/onboarding-shell";

export function UnsupportedBrowser() {
  return (
    <OnboardingShell title="Quiver needs Edge or Chrome on desktop">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Your prompts live in a folder on your PC, and only Edge and Chrome on desktop let a web app
        work with a folder. Open this page in one of those to continue.
      </p>
    </OnboardingShell>
  );
}
