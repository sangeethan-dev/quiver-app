import { CopyIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PromptBody } from "@/components/vault/prompt-body";
import type { HistoryVersion, VaultEntry } from "@/lib/fs/vault";
import { useVault } from "@/lib/store";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

interface HistoryPanelProps {
  entry: VaultEntry;
  onRestore: (version: HistoryVersion) => void;
}

export function HistoryPanel({ entry, onRestore }: HistoryPanelProps) {
  const { listHistory, copyText } = useVault();
  const { id, version: currentVersion } = entry.prompt;
  const [versions, setVersions] = useState<HistoryVersion[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void listHistory(id).then((loaded) => {
      if (active) setVersions(loaded);
    });
    return () => {
      active = false;
    };
    // Reload when a version was added, not when `listHistory` changes identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentVersion]);

  if (versions === null) return null;

  if (versions.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No earlier versions yet. One is kept each time the body changes.
      </p>
    );
  }

  const shown = versions.find((version) => version.version === selected) ?? versions[0];

  return (
    <div className="grid min-h-0 grid-cols-[11rem_minmax(0,1fr)] gap-3">
      <ul aria-label="Versions" className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {versions.map((version) => (
          <li key={version.version}>
            <button
              type="button"
              aria-current={version === shown || undefined}
              onClick={() => setSelected(version.version)}
              className={cn(
                "flex w-full flex-col rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                version === shown && "bg-accent",
              )}
            >
              <span className="text-[13px] font-medium">Version {version.version}</span>
              <span className="text-xs text-muted-foreground">{formatDate(version.savedAt)}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => void copyText(shown.body)}>
            <CopyIcon />
            Copy
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onRestore(shown)}>
            <RotateCcwIcon />
            Restore
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-surface-2 p-3">
          <PromptBody body={shown.body} />
        </div>
      </div>
    </div>
  );
}
