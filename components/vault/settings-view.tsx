import { ArrowLeftIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/vault/icon-button";
import { ModelsEditor } from "@/components/vault/models-editor";
import { TrashDialog } from "@/components/vault/trash-dialog";
import type { ModelSetting } from "@/lib/settings";
import { useVault } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { VaultCounts } from "@/lib/vault-view";

const THEMES = [
  { id: "system", label: "System" },
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface-1 p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

interface SettingsViewProps {
  folderName: string;
  models: readonly ModelSetting[];
  counts: VaultCounts;
  onBack: () => void;
}

export function SettingsView({ folderName, models, counts, onBack }: SettingsViewProps) {
  const { chooseFolder, refresh } = useVault();
  const { theme, setTheme } = useTheme();
  const [trashOpen, setTrashOpen] = useState(false);

  return (
    <main className="h-svh overflow-y-auto">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <header className="flex items-center gap-2">
          <IconButton label="Back to prompts" className="-ml-1.5" onClick={onBack}>
            <ArrowLeftIcon />
          </IconButton>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        </header>

        <Section title="Vault folder">
          <p className="text-sm">
            Prompts are stored in <span className="font-mono">{folderName}</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void chooseFolder()}>
              Change folder
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void refresh()}>
              <RefreshCwIcon />
              Refresh
            </Button>
          </div>
        </Section>

        <Section title="Models">
          <ModelsEditor models={models} counts={counts} />
        </Section>

        <Section title="Theme">
          <div role="radiogroup" aria-label="Theme" className="flex w-fit gap-1 rounded-lg bg-surface-2 p-1">
            {THEMES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={theme === id}
                onClick={() => setTheme(id)}
                className={cn(
                  "rounded-md px-3 py-1 text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  theme === id && "bg-surface-0 text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Trash">
          <p className="text-sm text-muted-foreground">
            Deleted prompts can be restored until the trash is emptied.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setTrashOpen(true)}
          >
            <Trash2Icon />
            Open trash
          </Button>
        </Section>

        <Section title="About">
          <p className="text-sm text-muted-foreground">
            Quiver {process.env.NEXT_PUBLIC_APP_VERSION}. A private prompt library. Your prompts
            stay in your folder and are never sent anywhere.
          </p>
        </Section>
      </div>

      {trashOpen && <TrashDialog onClose={() => setTrashOpen(false)} />}
    </main>
  );
}
