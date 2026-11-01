import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Button } from "@/components/ui/button";

interface ReconnectFolderProps {
  folderName: string;
  onReconnect: () => void;
  onChooseAnother: () => void;
}

export function ReconnectFolder({
  folderName,
  onReconnect,
  onChooseAnother,
}: ReconnectFolderProps) {
  return (
    <OnboardingShell title="Reconnect your folder">
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          The browser needs your permission again to open{" "}
          <span className="font-mono text-foreground">{folderName}</span>.
        </p>
        <p>
          When it asks, choose <span className="text-foreground">Allow on every visit</span> and
          this step won&apos;t appear again.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onReconnect}>Reconnect folder</Button>
        <Button variant="ghost" onClick={onChooseAnother}>
          Choose another folder
        </Button>
      </div>
    </OnboardingShell>
  );
}

interface MissingFolderProps {
  folderName: string;
  onChoose: () => void;
}

export function MissingFolder({ folderName, onChoose }: MissingFolderProps) {
  return (
    <OnboardingShell title="Your folder can't be found">
      <p className="text-sm leading-relaxed text-muted-foreground">
        <span className="font-mono text-foreground">{folderName}</span> may have been moved,
        renamed or deleted. Choose it again from its new location. Your prompts are only in that
        folder, so Quiver hasn&apos;t changed anything.
      </p>
      <Button onClick={onChoose} className="self-start">
        Choose folder
      </Button>
    </OnboardingShell>
  );
}
