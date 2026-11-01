import { PlusIcon, RefreshCwIcon, SettingsIcon } from "lucide-react";
import { QuiverMark } from "@/components/quiver-mark";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/vault/icon-button";

interface EmptyVaultProps {
  folderName: string;
  onNewPrompt: () => void;
  onAddExamples: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export function EmptyVault({
  folderName,
  onNewPrompt,
  onAddExamples,
  onRefresh,
  onOpenSettings,
}: EmptyVaultProps) {
  return (
    <main className="relative flex h-svh items-center justify-center px-4">
      <div className="absolute top-2 right-2 flex gap-1">
        <IconButton label="Refresh" onClick={onRefresh}>
          <RefreshCwIcon />
        </IconButton>
        <IconButton label="Settings" onClick={onOpenSettings}>
          <SettingsIcon />
        </IconButton>
      </div>

      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <QuiverMark className="size-8 text-primary" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-semibold tracking-tight">Your quiver is empty</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Save the prompts that work for you. Each one becomes a Markdown file in{" "}
            <span className="font-mono text-foreground">{folderName}</span>.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onNewPrompt}>
            <PlusIcon />
            New prompt
          </Button>
          <Button variant="secondary" onClick={onAddExamples}>
            Add 3 example prompts
          </Button>
        </div>
      </div>
    </main>
  );
}
