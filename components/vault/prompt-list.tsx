import { ArrowDownUpIcon, PlusIcon, SearchIcon, SettingsIcon, StarIcon } from "lucide-react";
import {
  memo,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/vault/icon-button";
import { ModelDot } from "@/components/vault/model-dot";
import type { UnreadableFile } from "@/lib/fs/vault";
import type { Prompt } from "@/lib/prompt-file";
import type { ModelSetting } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { findModel, firstLine, isSortMode, SORT_OPTIONS, type SortMode } from "@/lib/vault-view";

const ROW_BATCH = 60;

interface PromptRowProps {
  prompt: Prompt;
  color?: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
}

const PromptRow = memo(function PromptRow({
  prompt,
  color,
  selected,
  onSelect,
  onToggleFavorite,
}: PromptRowProps) {
  return (
    <li className="group relative">
      <button
        type="button"
        data-prompt-row
        aria-current={selected || undefined}
        onClick={() => onSelect(prompt.id)}
        className={cn(
          "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          selected && "bg-surface-2 hover:bg-surface-2",
        )}
      >
        <span className="flex items-center gap-2 pr-6">
          <ModelDot color={color} />
          <span className="truncate text-[13px] font-medium">{prompt.title}</span>
        </span>
        <span className="truncate pl-4 text-xs text-muted-foreground">
          {firstLine(prompt.body) || "Empty prompt"}
        </span>
        {prompt.tags.length > 0 && (
          <span className="truncate pl-4 text-[11px] text-muted-foreground">
            {prompt.tags.join(" · ")}
          </span>
        )}
      </button>
      <button
        type="button"
        aria-label={prompt.favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={prompt.favorite}
        onClick={() => onToggleFavorite(prompt.id, !prompt.favorite)}
        className={cn(
          "absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-md text-muted-foreground transition-opacity outline-none hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
          prompt.favorite ? "text-primary hover:text-primary" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <StarIcon className={cn("size-3.5", prompt.favorite && "fill-current")} />
      </button>
    </li>
  );
});

interface PromptRowsProps {
  prompts: readonly Prompt[];
  models: readonly ModelSetting[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
}

/**
 * Rows are added in batches as they scroll into reach. Rendering all of a large
 * vault took most of a second on every keystroke, while search itself takes
 * milliseconds. Give this a `key` that changes with the search or filter, so a
 * new result list starts from the first batch.
 */
function PromptRows({ prompts, models, selectedId, onSelect, onToggleFavorite }: PromptRowsProps) {
  const [limit, setLimit] = useState(ROW_BATCH);
  const sentinel = useRef<HTMLLIElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const selectedIndex = prompts.findIndex((prompt) => prompt.id === selectedId);
  const shown = Math.max(limit, selectedIndex + 1);
  const hasMore = shown < prompts.length;

  useEffect(() => {
    const element = sentinel.current;
    if (!hasMore || !element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setLimit(shown + ROW_BATCH);
      },
      { rootMargin: "400px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, shown]);

  // Keep the selection in view as it moves, and take focus with it if a row had it.
  useEffect(() => {
    const row = list.current?.querySelector<HTMLElement>("[data-prompt-row][aria-current]");
    row?.scrollIntoView({ block: "nearest" });
    if (document.activeElement?.hasAttribute("data-prompt-row")) row?.focus();
  }, [selectedId]);

  return (
    <ul ref={list}>
      {prompts.slice(0, shown).map((prompt) => (
        <PromptRow
          key={prompt.id}
          prompt={prompt}
          color={findModel(models, prompt.model)?.color}
          selected={prompt.id === selectedId}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
      {hasMore && <li ref={sentinel} aria-hidden="true" className="h-px" />}
    </ul>
  );
}

interface PromptListProps {
  listKey: string;
  prompts: readonly Prompt[];
  models: readonly ModelSetting[];
  selectedId: string | null;
  query: string;
  sort: SortMode;
  unreadable: readonly UnreadableFile[];
  settingsProblem?: string;
  filterMenu: ReactNode;
  searchRef: RefObject<HTMLInputElement | null>;
  onMoveSelection: (step: number) => void;
  onCopySelected: () => void;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: SortMode) => void;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
  onNewPrompt: () => void;
  onOpenSettings: () => void;
  onClearFilters: () => void;
}

export function PromptList({
  listKey,
  prompts,
  models,
  selectedId,
  query,
  sort,
  unreadable,
  settingsProblem,
  filterMenu,
  searchRef,
  onMoveSelection,
  onCopySelected,
  onQueryChange,
  onSortChange,
  onSelect,
  onToggleFavorite,
  onNewPrompt,
  onOpenSettings,
  onClearFilters,
}: PromptListProps) {
  const searching = query.trim() !== "";
  const sortLabel = SORT_OPTIONS.find((option) => option.id === sort)?.label;

  // The search box drives the list, so "type two letters, Enter" works here too.
  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") onMoveSelection(1);
    else if (event.key === "ArrowUp") onMoveSelection(-1);
    else if (event.key === "Enter") onCopySelected();
    else if (event.key === "Escape") {
      if (query) onQueryChange("");
      else event.currentTarget.blur();
    } else return;

    event.preventDefault();
  }

  return (
    <section aria-label="Prompts" className="flex min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1.5 px-3">
        {filterMenu}
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="search"
            aria-label="Search prompts"
            placeholder="Search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="h-8 pl-7"
          />
        </div>
        <IconButton label="New prompt" variant="default" size="icon" onClick={onNewPrompt}>
          <PlusIcon />
        </IconButton>
        <IconButton label="Settings" size="icon" className="lg:hidden" onClick={onOpenSettings}>
          <SettingsIcon />
        </IconButton>
      </div>

      <div className="flex h-7 shrink-0 items-center justify-between px-4 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {prompts.length} {prompts.length === 1 ? "prompt" : "prompts"}
        </span>
        {searching ? (
          <span>Best match</span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" className="text-muted-foreground">
                <ArrowDownUpIcon />
                {sortLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => isSortMode(value) && onSortChange(value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.id} value={option.id}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {settingsProblem && (
          <p role="alert" className="mb-2 rounded-md bg-surface-2 px-3 py-2 text-xs">
            Couldn&apos;t use <span className="font-mono">_settings.json</span>: {settingsProblem}.
            Using the default models until it&apos;s fixed.
          </p>
        )}

        {prompts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
            <p>No prompts match.</p>
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              Clear search and filters
            </Button>
          </div>
        ) : (
          <PromptRows
            key={listKey}
            prompts={prompts}
            models={models}
            selectedId={selectedId}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
          />
        )}

        {unreadable.length > 0 && (
          <details className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-xs">
            <summary className="cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Couldn&apos;t read {unreadable.length} {unreadable.length === 1 ? "file" : "files"}
            </summary>
            <ul className="mt-2 flex flex-col gap-1.5 text-muted-foreground">
              {unreadable.map((file) => (
                <li key={file.fileName} className="wrap-anywhere">
                  <span className="font-mono text-foreground">{file.fileName}</span>
                  <br />
                  {file.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
