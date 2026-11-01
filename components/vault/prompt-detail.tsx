import {
  ArrowLeftIcon,
  CopyIcon,
  HistoryIcon,
  PencilIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/vault/icon-button";
import { ModelDot } from "@/components/vault/model-dot";
import { PromptBody } from "@/components/vault/prompt-body";
import type { VaultEntry } from "@/lib/fs/vault";
import { UNASSIGNED_MODEL_NAME } from "@/lib/search";
import type { ModelSetting } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

interface PromptDetailProps {
  entry: VaultEntry;
  model?: ModelSetting;
  onBack: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

function usageLine(useCount: number, lastUsed: string | undefined): string {
  if (useCount === 0) return "Not used yet";
  const times = useCount === 1 ? "Used once" : `Used ${useCount} times`;
  const date = formatDate(lastUsed);
  return date ? `${times}, last on ${date}` : times;
}

export function PromptDetail({
  entry,
  model,
  onBack,
  onCopy,
  onEdit,
  onHistory,
  onToggleFavorite,
  onDelete,
}: PromptDetailProps) {
  const { prompt } = entry;
  const updated = formatDate(prompt.updated);

  return (
    <article className="flex min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1 px-4">
        <IconButton label="Back to list" className="-ml-1.5 lg:hidden" onClick={onBack}>
          <ArrowLeftIcon />
        </IconButton>
        <Button size="sm" onClick={onCopy}>
          <CopyIcon />
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <PencilIcon />
          Edit
        </Button>
        <span className="ml-auto" />
        <IconButton
          label={prompt.favorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={prompt.favorite}
          onClick={onToggleFavorite}
          className={cn(prompt.favorite && "text-primary hover:text-primary")}
        >
          <StarIcon className={cn(prompt.favorite && "fill-current")} />
        </IconButton>
        <IconButton label="History" onClick={onHistory}>
          <HistoryIcon />
        </IconButton>
        <IconButton label="Delete" onClick={onDelete}>
          <Trash2Icon />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="text-lg/snug font-semibold tracking-tight wrap-anywhere">
              {prompt.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ModelDot color={model?.color} />
                {model?.name ?? UNASSIGNED_MODEL_NAME}
              </span>
              {prompt.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>

          {prompt.body ? (
            <PromptBody body={prompt.body} />
          ) : (
            <p className="text-sm text-muted-foreground">This prompt is empty.</p>
          )}

          <footer className="flex flex-col gap-0.5 border-t pt-3 text-xs text-muted-foreground">
            <span>
              Version {prompt.version}
              {updated && `, updated ${updated}`}
            </span>
            <span>{usageLine(prompt.useCount, prompt.lastUsed)}</span>
          </footer>
        </div>
      </div>
    </article>
  );
}
