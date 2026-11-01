import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Button } from "@/components/ui/button";

export function ChooseFolder({ onChoose }: { onChoose: () => void }) {
  return (
    <OnboardingShell title="Choose a folder for your prompts">
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          Quiver keeps each prompt as a Markdown file in a folder on your PC. Nothing is uploaded
          anywhere, and you can open the files in Notepad.
        </p>
        <p>
          Create a new, empty folder for this, such as{" "}
          <span className="font-mono text-foreground">Documents\Quiver</span>.
        </p>
        <p>
          Don&apos;t choose Documents, Desktop or a whole drive. Quiver gets read and write access
          to everything inside the folder you pick.
        </p>
      </div>
      <Button onClick={onChoose} className="self-start">
        Choose folder
      </Button>
    </OnboardingShell>
  );
}
