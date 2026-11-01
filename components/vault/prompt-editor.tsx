import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/vault/confirm-dialog";
import { ConflictDialog } from "@/components/vault/conflict-dialog";
import { HistoryPanel } from "@/components/vault/history-panel";
import { ModelSelect } from "@/components/vault/model-select";
import { TagInput } from "@/components/vault/tag-input";
import type { HistoryVersion, PromptDraft, VaultEntry } from "@/lib/fs/vault";
import { sameBody } from "@/lib/prompt-file";
import type { ModelSetting } from "@/lib/settings";
import { useVault } from "@/lib/store";
import { cn } from "@/lib/utils";
import { extractVariables } from "@/lib/variables";

export type EditorTab = "edit" | "history";

export interface EditorSession {
  entry: VaultEntry | null;
  initial: PromptDraft;
  tab: EditorTab;
}

interface PromptEditorProps {
  session: EditorSession;
  models: readonly ModelSetting[];
  knownTags: readonly string[];
  onClose: () => void;
  onSaved: (entry: VaultEntry) => void;
}

export function draftFromEntry({ prompt: { title, model, tags, body } }: VaultEntry): PromptDraft {
  return { title, model, tags, body };
}

function sameDraft(a: PromptDraft, b: PromptDraft): boolean {
  return (
    a.title === b.title &&
    a.model === b.model &&
    a.tags.join("\n") === b.tags.join("\n") &&
    sameBody(a.body, b.body)
  );
}

interface Conflict {
  disk: VaultEntry | null;
  draft: PromptDraft;
}

type PendingDiscard = { kind: "close" } | { kind: "restore"; version: HistoryVersion };

export function PromptEditor({ session, models, knownTags, onClose, onSaved }: PromptEditorProps) {
  const { createPrompt, savePrompt } = useVault();
  const [base, setBase] = useState(session.entry);
  const [original, setOriginal] = useState(session.initial);
  const [draft, setDraft] = useState(session.initial);
  const [tagText, setTagText] = useState("");
  const [tab, setTab] = useState(session.tab);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState<PendingDiscard | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = tagText.trim() !== "" || !sameDraft(draft, original);
  const variables = useMemo(() => extractVariables(draft.body), [draft.body]);
  const change = (changes: Partial<PromptDraft>) => setDraft({ ...draft, ...changes });

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function submit(next: PromptDraft, force = false): Promise<boolean> {
    if (saving) return false;
    setSaving(true);
    try {
      if (!base) {
        const created = await createPrompt(next);
        if (created) onSaved(created);
        return !!created;
      }

      const result = await savePrompt(base, next, force);
      if (result?.status === "saved") onSaved(result.entry);
      if (result?.status === "conflict") setConflict({ disk: result.disk, draft: next });
      return result?.status === "saved";
    } finally {
      setSaving(false);
    }
  }

  const save = () => submit({ ...draft, tags: [...draft.tags, ...tagText.split(",")] });

  async function restore(version: HistoryVersion) {
    if (!base) return;
    const restored = await submit({ ...draftFromEntry(base), body: version.body });
    if (restored) toast(`Restored version ${version.version}`);
  }

  function takeFileVersion() {
    const disk = conflict?.disk;
    if (!disk) return;
    const next = draftFromEntry(disk);
    setBase(disk);
    setOriginal(next);
    setDraft(next);
    setTagText("");
    setConflict(null);
  }

  function requestClose() {
    if (dirty) setPendingDiscard({ kind: "close" });
    else onClose();
  }

  function requestRestore(version: HistoryVersion) {
    if (dirty) setPendingDiscard({ kind: "restore", version });
    else void restore(version);
  }

  function confirmDiscard() {
    const pending = pendingDiscard;
    setPendingDiscard(null);
    if (pending?.kind === "close") onClose();
    if (pending?.kind === "restore") void restore(pending.version);
  }

  function handleKeyDown(event: KeyboardEvent) {
    const isSave = event.key.toLowerCase() === "s" || event.key === "Enter";
    if (isSave && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (tab === "edit") void save();
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          onKeyDown={handleKeyDown}
          className="flex h-[min(85svh,44rem)] max-w-[calc(100%-2rem)] flex-col sm:max-w-3xl"
        >
          <DialogHeader className="pr-8">
            <DialogTitle>{base ? "Edit prompt" : "New prompt"}</DialogTitle>
            <DialogDescription className="sr-only">
              Ctrl+S saves. Esc closes.
            </DialogDescription>
            {base && (
              <div role="tablist" aria-label="Editor views" className="flex gap-1">
                {(["edit", "history"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={tab === value}
                    onClick={() => setTab(value)}
                    className={cn(
                      "rounded-md px-2 py-1 text-[13px] text-muted-foreground capitalize outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      tab === value && "bg-accent text-foreground",
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            )}
          </DialogHeader>

          {tab === "edit" ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <Input
                  aria-label="Title"
                  placeholder="Verb · detail"
                  value={draft.title}
                  onChange={(event) => change({ title: event.target.value })}
                />
                <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <ModelSelect
                    value={draft.model}
                    models={models}
                    onChange={(model) => change({ model })}
                  />
                  <TagInput
                    tags={draft.tags}
                    text={tagText}
                    suggestions={knownTags}
                    onTagsChange={(tags) => change({ tags })}
                    onTextChange={setTagText}
                  />
                </div>
                <Textarea
                  aria-label="Body"
                  placeholder="Write the prompt. Use {{name}} or {{name|default}} for parts you fill in each time."
                  value={draft.body}
                  onChange={(event) => change({ body: event.target.value })}
                  spellCheck={false}
                  className="min-h-0 flex-1 resize-none font-mono text-[13px]/6 [field-sizing:fixed]"
                />
                <p aria-live="polite" className="min-h-4 truncate text-xs text-muted-foreground">
                  {variables.length > 0 &&
                    `Variables: ${variables
                      .map((v) => (v.defaultValue === undefined ? v.name : `${v.name} = ${v.defaultValue}`))
                      .join(", ")}`}
                </p>
              </div>
              <DialogFooter>
                <span className="mr-auto hidden self-center text-xs text-muted-foreground sm:block">
                  Ctrl+S to save
                </span>
                <Button variant="ghost" onClick={requestClose}>
                  Cancel
                </Button>
                <Button onClick={() => void save()} disabled={saving}>
                  Save
                </Button>
              </DialogFooter>
            </>
          ) : (
            base && (
              <div className="flex min-h-0 flex-1 flex-col">
                <HistoryPanel entry={base} onRestore={requestRestore} />
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      <ConflictDialog
        open={!!conflict}
        fileIsReadable={!!conflict?.disk}
        onCancel={() => setConflict(null)}
        onUseFile={takeFileVersion}
        onKeepMine={() => {
          const next = conflict?.draft;
          setConflict(null);
          if (next) void submit(next, true);
        }}
      />

      <ConfirmDialog
        open={!!pendingDiscard}
        title="Discard your changes?"
        description={
          pendingDiscard?.kind === "restore"
            ? "Restoring replaces the edits you haven't saved."
            : "Your edits to this prompt haven't been saved."
        }
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={confirmDiscard}
        onCancel={() => setPendingDiscard(null)}
      />
    </>
  );
}
