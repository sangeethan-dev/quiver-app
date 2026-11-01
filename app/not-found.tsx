import Link from "next/link";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <OnboardingShell title="This page doesn't exist">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Quiver is a single page, so there&apos;s nothing at this address.
      </p>
      <Button asChild className="self-start">
        <Link href="/">Open Quiver</Link>
      </Button>
    </OnboardingShell>
  );
}
