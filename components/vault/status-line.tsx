import { useEffect, useState } from "react";
import { formatRelative } from "@/lib/time";

const REFRESH_MS = 30_000;

interface StatusLineProps {
  promptCount: number;
  lastCopied: { title: string; at: number } | null;
  onShowHelp: () => void;
}

export function StatusLine({ promptCount, lastCopied, onShowHelp }: StatusLineProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t px-3 text-[11px] text-muted-foreground">
      <span className="shrink-0 tabular-nums">
        {promptCount} {promptCount === 1 ? "prompt" : "prompts"}
      </span>
      {lastCopied && (
        <span className="min-w-0 truncate" title={lastCopied.title}>
          Last copied: {lastCopied.title} · {formatRelative(lastCopied.at, Math.max(now, lastCopied.at))}
        </span>
      )}
      <button
        type="button"
        onClick={onShowHelp}
        className="ml-auto shrink-0 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        Shortcuts <kbd className="font-mono">?</kbd>
      </button>
    </footer>
  );
}
