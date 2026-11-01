import { PlusIcon, XIcon } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
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
import { IconButton } from "@/components/vault/icon-button";
import { ModelSelect } from "@/components/vault/model-select";
import { createModel, type ModelSetting } from "@/lib/settings";
import { useVault } from "@/lib/store";
import type { VaultCounts } from "@/lib/vault-view";

const PLACEHOLDER_ID = /^new-model(-\d+)?$/;

interface ModelRowProps {
  model: ModelSetting;
  onChange: (changes: Partial<ModelSetting>) => void;
  onRemove: () => void;
}

function ModelRow({ model, onChange, onRemove }: ModelRowProps) {
  const [name, setName] = useState(model.name);
  const [color, setColor] = useState(model.color);

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed) setName(model.name);
    else if (trimmed !== model.name) onChange({ name: trimmed });
  }

  function commitColor() {
    if (color !== model.color) onChange({ color });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
  }

  return (
    <li className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`Color for ${model.name}`}
        value={color}
        onChange={(event) => setColor(event.target.value)}
        onBlur={commitColor}
        className="size-7 shrink-0 cursor-pointer rounded-md bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-1"
      />
      <Input
        aria-label={`Name for ${model.name}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={commitName}
        onKeyDown={handleKeyDown}
      />
      <IconButton label={`Remove ${model.name}`} onClick={onRemove}>
        <XIcon />
      </IconButton>
    </li>
  );
}

interface ModelsEditorProps {
  models: readonly ModelSetting[];
  counts: VaultCounts;
}

export function ModelsEditor({ models, counts }: ModelsEditorProps) {
  const { saveSettings, reassignModel } = useVault();
  const [removing, setRemoving] = useState<ModelSetting | null>(null);
  const [target, setTarget] = useState("");

  const save = (next: ModelSetting[]) => void saveSettings({ models: next });

  function update(id: string, changes: Partial<ModelSetting>) {
    save(
      models.map((model) => {
        if (model.id !== id) return model;

        // The id goes into prompt files, so swap the placeholder for the real name
        // while nothing depends on it yet.
        const others = models.filter((other) => other.id !== id);
        const replaceId = PLACEHOLDER_ID.test(id) && changes.name && !counts.byModel.get(id);
        return {
          ...model,
          ...changes,
          id: replaceId ? createModel(changes.name ?? "", others).id : id,
        };
      }),
    );
  }

  function requestRemove(model: ModelSetting) {
    if (counts.byModel.get(model.id)) {
      setTarget("");
      setRemoving(model);
    } else {
      save(models.filter(({ id }) => id !== model.id));
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemoving(null);
    if (target) await reassignModel(removing.id, target);
    save(models.filter(({ id }) => id !== removing.id));
  }

  const remaining = models.filter((model) => model.id !== removing?.id);
  const inUse = removing ? (counts.byModel.get(removing.id) ?? 0) : 0;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {models.map((model) => (
          <ModelRow
            key={model.id}
            model={model}
            onChange={(changes) => update(model.id, changes)}
            onRemove={() => requestRemove(model)}
          />
        ))}
      </ul>
      {models.length === 0 && (
        <p className="text-sm text-muted-foreground">No models. Prompts show as Unassigned.</p>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => save([...models, createModel("New model", models)])}
      >
        <PlusIcon />
        Add model
      </Button>

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription>
              {inUse} {inUse === 1 ? "prompt uses" : "prompts use"} this model. Choose where{" "}
              {inUse === 1 ? "it goes" : "they go"}. Leaving them Unassigned keeps the old model in
              the files, so adding it back later restores them.
            </DialogDescription>
          </DialogHeader>
          <ModelSelect value={target} models={remaining} onChange={setTarget} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmRemove()}>
              Remove model
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
