import { cn } from "@/lib/utils";

/** A filled dot for a model; a hollow ring when the prompt has no known model. */
export function ModelDot({ color, className }: { color?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        !color && "ring-1 ring-muted-foreground/70 ring-inset",
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}
