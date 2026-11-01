import { XIcon } from "lucide-react";
import { useId, type KeyboardEvent } from "react";

interface TagInputProps {
  tags: readonly string[];
  /** Typed text not yet turned into a tag. The parent holds it so saving can include it. */
  text: string;
  suggestions: readonly string[];
  onTagsChange: (tags: string[]) => void;
  onTextChange: (text: string) => void;
}

export function TagInput({ tags, text, suggestions, onTagsChange, onTextChange }: TagInputProps) {
  const listId = useId();
  const taken = new Set(tags.map((tag) => tag.toLowerCase()));

  function add(values: string[], remainder = "") {
    const added = values
      .map((value) => value.trim())
      .filter((value, index, all) => {
        const key = value.toLowerCase();
        return value && !taken.has(key) && all.findIndex((v) => v.toLowerCase() === key) === index;
      });
    if (added.length > 0) onTagsChange([...tags, ...added]);
    onTextChange(remainder);
  }

  // Commas are read from the value, not from key presses, so paste, IME
  // composition and on-screen keyboards all behave the same way.
  function handleChange(value: string) {
    const parts = value.split(",");
    const last = parts.pop() ?? "";
    if (parts.length > 0) add(parts, last);
    else onTextChange(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      add([text]);
    } else if (event.key === "Backspace" && text === "" && tags.length > 0) {
      onTagsChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-2 py-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-0.5 rounded-sm bg-accent py-0.5 pr-0.5 pl-1.5 text-xs"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onTagsChange(tags.filter((value) => value !== tag))}
            className="rounded-sm p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        aria-label="Tags"
        list={listId}
        value={text}
        placeholder={tags.length === 0 ? "Add tags" : ""}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => add([text])}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <datalist id={listId}>
        {suggestions
          .filter((tag) => !taken.has(tag.toLowerCase()))
          .map((tag) => (
            <option key={tag} value={tag} />
          ))}
      </datalist>
    </div>
  );
}
