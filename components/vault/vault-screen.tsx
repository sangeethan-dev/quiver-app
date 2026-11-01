"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { CommandPalette } from "@/components/palette/command-palette";
import { QuiverMark } from "@/components/quiver-mark";
import { FillForm } from "@/components/variables/fill-form";
import { EmptyVault } from "@/components/vault/empty-vault";
import { PromptDetail } from "@/components/vault/prompt-detail";
import {
  draftFromEntry,
  PromptEditor,
  type EditorSession,
  type EditorTab,
} from "@/components/vault/prompt-editor";
import { PromptList } from "@/components/vault/prompt-list";
import { SettingsView } from "@/components/vault/settings-view";
import { ShortcutsHelp } from "@/components/vault/shortcuts-help";
import { FilterMenu, Sidebar } from "@/components/vault/sidebar";
import { StatusLine } from "@/components/vault/status-line";
import { EXAMPLE_PROMPTS } from "@/lib/examples";
import type { VaultEntry, VaultSnapshot } from "@/lib/fs/vault";
import { createPromptSearch } from "@/lib/search";
import { shortcutFor } from "@/lib/shortcuts";
import { useVault } from "@/lib/store";
import { cn } from "@/lib/utils";
import { fillTemplate, hasVariables } from "@/lib/variables";
import {
  ALL_PROMPTS,
  countPrompts,
  countTags,
  filterPrompts,
  findModel,
  isSortMode,
  latestUse,
  promptsInScope,
  sortPrompts,
  type SortMode,
  type VaultFilter,
} from "@/lib/vault-view";

const SORT_KEY = "quiver.sort";

function readStoredSort(): SortMode {
  try {
    const stored = localStorage.getItem(SORT_KEY);
    return isSortMode(stored) ? stored : "recently-used";
  } catch {
    return "recently-used";
  }
}

function storeSort(sort: SortMode): void {
  try {
    localStorage.setItem(SORT_KEY, sort);
  } catch {
    // The sort order is a convenience; it just won't be remembered.
  }
}

interface VaultScreenProps {
  folderName: string;
  snapshot: VaultSnapshot;
}

export function VaultScreen({ folderName, snapshot }: VaultScreenProps) {
  const vault = useVault();
  const { setFavorite, deletePrompt, copyText, lastCopy } = vault;
  const { entries, unreadable, settings, settingsProblem } = snapshot;
  const { models } = settings;

  const [filter, setFilter] = useState<VaultFilter>(ALL_PROMPTS);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>(readStoredSort);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [session, setSession] = useState<EditorSession | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [fillEntry, setFillEntry] = useState<VaultEntry | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // These all depend on `entries`, which keeps its identity until a file changes,
  // so a rescan on window focus doesn't redo any of this work.
  const prompts = useMemo(() => entries.map((entry) => entry.prompt), [entries]);
  const entriesById = useMemo(
    () => new Map(entries.map((entry) => [entry.prompt.id, entry])),
    [entries],
  );
  const search = useMemo(() => createPromptSearch(prompts, models), [prompts, models]);
  const recentPrompts = useMemo(() => sortPrompts(prompts, "recently-used"), [prompts]);
  const counts = useMemo(() => countPrompts(prompts, models), [prompts, models]);
  const knownTags = useMemo(() => countTags(prompts).map(({ tag }) => tag), [prompts]);
  const tags = useMemo(
    () => countTags(promptsInScope(prompts, filter.scope, models)),
    [prompts, filter.scope, models],
  );

  // The input stays instant; the results follow as soon as React has a moment.
  const deferredQuery = useDeferredValue(query);

  const visible = useMemo(() => {
    const ordered = deferredQuery.trim() ? search(deferredQuery) : sortPrompts(prompts, sort);
    return filterPrompts(ordered, filter, models);
  }, [deferredQuery, filter, models, prompts, search, sort]);

  const selected = visible.find(({ id }) => id === selectedId) ?? visible[0] ?? null;
  const selectedEntry = selected ? (entriesById.get(selected.id) ?? null) : null;

  // The last copy made here wins; otherwise the files say what was used last.
  const lastCopied = useMemo(() => {
    const copied = lastCopy && entriesById.get(lastCopy.promptId);
    if (copied && lastCopy) return { title: copied.prompt.title, at: lastCopy.at };

    const latest = latestUse(prompts);
    return latest && { title: latest.prompt.title, at: latest.at };
  }, [entriesById, lastCopy, prompts]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setShowDetail(true);
  }, []);

  const toggleFavorite = useCallback(
    (id: string, favorite: boolean) => void setFavorite(id, favorite),
    [setFavorite],
  );

  /** Every way of copying comes through here, so they all behave alike. */
  function startCopy(entry: VaultEntry) {
    const { id, body } = entry.prompt;
    if (hasVariables(body)) setFillEntry(entry);
    else void copyText(fillTemplate(body, {}), id);
  }

  function copyFromPalette(id: string) {
    const entry = entriesById.get(id);
    setPaletteOpen(false);
    setSelectedId(id);
    if (entry) startCopy(entry);
  }

  function editFromPalette(id: string) {
    const entry = entriesById.get(id);
    setPaletteOpen(false);
    setSettingsOpen(false);
    setSelectedId(id);
    if (entry) openExisting(entry, "edit");
  }

  function moveSelection(step: number) {
    const index = visible.findIndex(({ id }) => id === selected?.id);
    const next = visible[Math.min(Math.max(index + step, 0), visible.length - 1)];
    if (next) setSelectedId(next.id);
  }

  function changeSort(next: SortMode) {
    setSort(next);
    storeSort(next);
  }

  function clearFilters() {
    setFilter(ALL_PROMPTS);
    setQuery("");
  }

  function openNew() {
    const model = filter.scope.kind === "model" ? filter.scope.id : (models[0]?.id ?? "");
    const initial = { title: "", model, tags: filter.tag ? [filter.tag] : [], body: "" };
    setSession({ entry: null, initial, tab: "edit" });
  }

  function openExisting(entry: VaultEntry, tab: EditorTab) {
    setSession({ entry, initial: draftFromEntry(entry), tab });
  }

  function handleDelete(id: string) {
    // Move to the neighbouring row so Delete can be pressed through a list.
    const index = visible.findIndex((prompt) => prompt.id === id);
    setSelectedId(visible[index + 1]?.id ?? visible[index - 1]?.id ?? null);
    void deletePrompt(id);
  }

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const action = shortcutFor(event);
    if (!action) return;

    if (action === "palette") {
      event.preventDefault();
      setPaletteOpen((open) => !open);
      return;
    }

    if (settingsOpen || session || fillEntry || paletteOpen || helpOpen) return;
    event.preventDefault();

    switch (action) {
      case "new-prompt":
        openNew();
        break;
      case "search":
        // On a narrow window the box may be hidden, and a hidden input can't take focus.
        flushSync(() => setShowDetail(false));
        searchRef.current?.focus();
        break;
      case "next":
        moveSelection(1);
        break;
      case "previous":
        moveSelection(-1);
        break;
      case "help":
        setHelpOpen(true);
        break;
      case "copy":
        if (selectedEntry) startCopy(selectedEntry);
        break;
      case "favorite":
        if (selected) toggleFavorite(selected.id, !selected.favorite);
        break;
      case "edit":
        if (selectedEntry) openExisting(selectedEntry, "edit");
        break;
      case "delete":
        if (selected) handleDelete(selected.id);
        break;
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const overlays = (
    <>
      {session && (
        <PromptEditor
          session={session}
          models={models}
          knownTags={knownTags}
          onClose={() => setSession(null)}
          onSaved={(entry) => {
            setSession(null);
            setSelectedId(entry.prompt.id);
          }}
        />
      )}
      {fillEntry && (
        <FillForm
          key={fillEntry.prompt.id}
          entry={fillEntry}
          onClose={() => setFillEntry(null)}
        />
      )}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        recentPrompts={recentPrompts}
        models={models}
        search={search}
        onCopy={copyFromPalette}
        onEdit={session ? undefined : editFromPalette}
        onToggleFavorite={(prompt) => toggleFavorite(prompt.id, !prompt.favorite)}
      />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );

  if (settingsOpen) {
    return (
      <>
        <SettingsView
          folderName={folderName}
          models={models}
          counts={counts}
          onBack={() => setSettingsOpen(false)}
        />
        {overlays}
      </>
    );
  }

  if (entries.length === 0 && unreadable.length === 0) {
    return (
      <>
        <EmptyVault
          folderName={folderName}
          onNewPrompt={openNew}
          onAddExamples={() => void vault.createPrompts(EXAMPLE_PROMPTS)}
          onRefresh={() => void vault.refresh()}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {overlays}
      </>
    );
  }

  return (
    <main className="flex h-svh flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 lg:grid-cols-[13.5rem_minmax(18rem,23rem)_minmax(0,1fr)]">
        <div className="hidden min-h-0 lg:contents">
          <Sidebar
            filter={filter}
            models={models}
            counts={counts}
            tags={tags}
            folderName={folderName}
            onFilterChange={setFilter}
            onRefresh={() => void vault.refresh()}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>

        <div className={cn("flex min-h-0 flex-col lg:flex", showDetail && "hidden")}>
          <PromptList
            listKey={JSON.stringify([deferredQuery, filter, sort])}
            prompts={visible}
            models={models}
            selectedId={selected?.id ?? null}
            query={query}
            sort={sort}
            unreadable={unreadable}
            settingsProblem={settingsProblem}
            filterMenu={
              <FilterMenu
                filter={filter}
                models={models}
                counts={counts}
                tags={tags}
                onFilterChange={setFilter}
              />
            }
            searchRef={searchRef}
            onMoveSelection={moveSelection}
            onCopySelected={() => selectedEntry && startCopy(selectedEntry)}
            onQueryChange={setQuery}
            onSortChange={changeSort}
            onSelect={select}
            onToggleFavorite={toggleFavorite}
            onNewPrompt={openNew}
            onOpenSettings={() => setSettingsOpen(true)}
            onClearFilters={clearFilters}
          />
        </div>

        <div
          className={cn(
            "min-h-0 flex-col bg-surface-1 lg:flex",
            showDetail && selectedEntry ? "flex" : "hidden",
          )}
        >
          {selectedEntry ? (
            <PromptDetail
              entry={selectedEntry}
              model={findModel(models, selectedEntry.prompt.model)}
              onBack={() => setShowDetail(false)}
              onCopy={() => startCopy(selectedEntry)}
              onEdit={() => openExisting(selectedEntry, "edit")}
              onHistory={() => openExisting(selectedEntry, "history")}
              onToggleFavorite={() =>
                toggleFavorite(selectedEntry.prompt.id, !selectedEntry.prompt.favorite)
              }
              onDelete={() => handleDelete(selectedEntry.prompt.id)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <QuiverMark className="size-8 opacity-30" />
            </div>
          )}
        </div>
      </div>

      <StatusLine
        promptCount={prompts.length}
        lastCopied={lastCopied}
        onShowHelp={() => setHelpOpen(true)}
      />
      {overlays}
    </main>
  );
}
