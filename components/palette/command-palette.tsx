import { StarIcon } from "lucide-react";
import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ModelDot } from "@/components/vault/model-dot";
import type { Prompt } from "@/lib/prompt-file";
import { UNASSIGNED_MODEL_NAME, type PromptSearch } from "@/lib/search";
import type { ModelSetting } from "@/lib/settings";
import { paletteActionFor } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { findModel } from "@/lib/vault-view";

// Anything past this is better found by typing another letter, and rendering a
// short list is what keeps the palette instant on a large vault.
const MAX_RESULTS = 30;

function Key({ children }: { children: ReactNode }) {
  return <kbd className="font-mono text-[10px] text-foreground">{children}</kbd>;
}

interface PaletteActions {
  onCopy: (id: string) => void;
  /** Absent while the editor is open, since a second one would replace it. */
  onEdit?: (id: string) => void;
  onToggleFavorite: (prompt: Prompt) => void;
}

interface PaletteBodyProps extends PaletteActions {
  /** Sorted by the caller once per vault change, so opening doesn't pay for it. */
  recentPrompts: readonly Prompt[];
  models: readonly ModelSetting[];
  search: PromptSearch;
}

// Lives inside the dialog so its state resets each time the palette closes.
function PaletteBody({
  recentPrompts,
  models,
  search,
  onCopy,
  onEdit,
  onToggleFavorite,
}: PaletteBodyProps) {
  const [query, setQuery] = useState("");
  const [modelId, setModelId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState("");

  const results = useMemo(() => {
    const ordered = query.trim() ? search(query) : recentPrompts;
    const filtered = modelId ? ordered.filter((prompt) => prompt.model === modelId) : ordered;
    return filtered.slice(0, MAX_RESULTS);
  }, [modelId, query, recentPrompts, search]);

  const active = results.find((prompt) => prompt.id === activeId) ?? results[0];

  function changeQuery(value: string) {
    setQuery(value);
    setActiveId(""); // The best match should be first, not the previous row.
  }

  function changeModel(id: string | null) {
    setModelId(id);
    setActiveId("");
  }

  function handleKeyDown(event: KeyboardEvent) {
    const action = paletteActionFor({ ...event, code: event.code, target: event.target });
    if (!action) return;
    event.preventDefault();

    if (action.kind === "filter") {
      const model = models[action.index];
      if (model) changeModel(modelId === model.id ? null : model.id);
    } else if (active) {
      if (action.kind === "favorite") onToggleFavorite(active);
      else onEdit?.(active.id);
    }
  }

  return (
    <Command
      shouldFilter={false}
      loop
      value={active?.id ?? ""}
      onValueChange={setActiveId}
      onKeyDown={handleKeyDown}
      className="p-0"
    >
      <div className="p-1.5 pb-0">
        <CommandInput
          placeholder="Search prompts"
          value={query}
          onValueChange={changeQuery}
          aria-label="Search prompts"
        />
      </div>

      {models.length > 0 && (
        <div role="group" aria-label="Filter by model" className="flex flex-wrap gap-1 px-2.5 pt-2">
          {[null, ...models].map((model) => {
            const selected = (model?.id ?? null) === modelId;
            return (
              <button
                key={model?.id ?? "all"}
                type="button"
                tabIndex={-1}
                aria-pressed={selected}
                onClick={() => changeModel(model?.id ?? null)}
                className={cn(
                  "flex h-6 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground outline-none hover:text-foreground",
                  selected && "bg-accent text-foreground",
                )}
              >
                {model && <ModelDot color={model.color} className="size-1.5" />}
                {model?.name ?? "All"}
              </button>
            );
          })}
        </div>
      )}

      <CommandList className="max-h-[min(50svh,22rem)] p-1.5">
        <CommandEmpty className="text-muted-foreground">
          {recentPrompts.length === 0 ? "No prompts yet." : "No prompts match."}
        </CommandEmpty>
        {results.map((prompt) => {
          const model = findModel(models, prompt.model);
          return (
            <CommandItem
              key={prompt.id}
              value={prompt.id}
              onSelect={() => onCopy(prompt.id)}
              // The trailing check icon in the shared item is for selectable lists.
              className="[&>svg:last-child]:hidden"
            >
              <ModelDot color={model?.color} />
              <span className="min-w-0 flex-1 truncate">{prompt.title}</span>
              {prompt.favorite && (
                <StarIcon aria-label="Favorite" className="size-3 fill-current text-primary" />
              )}
              <span className="shrink-0 text-xs text-muted-foreground">
                {model?.name ?? UNASSIGNED_MODEL_NAME}
              </span>
            </CommandItem>
          );
        })}
      </CommandList>

      <footer className="hidden flex-wrap gap-x-3 gap-y-0.5 border-t px-3 py-1.5 text-[11px] text-muted-foreground sm:flex">
        <span>
          <Key>↑↓</Key> navigate
        </span>
        <span>
          <Key>Enter</Key> copy
        </span>
        <span>
          <Key>Alt+F</Key> favorite
        </span>
        {onEdit && (
          <span>
            <Key>Alt+E</Key> edit
          </span>
        )}
        <span>
          <Key>Alt+1–9</Key> filter
        </span>
        <span>
          <Key>Esc</Key> close
        </span>
      </footer>
    </Command>
  );
}

interface CommandPaletteProps extends PaletteBodyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange, ...body }: CommandPaletteProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Find a prompt"
      description="Search your prompts, then press Enter to copy."
      className="top-[12%] sm:max-w-xl"
    >
      <PaletteBody {...body} />
    </CommandDialog>
  );
}
