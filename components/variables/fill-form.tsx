import { useMemo, useRef, useState, type KeyboardEvent } from "react";
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
import type { VaultEntry } from "@/lib/fs/vault";
import { loadLastValues, saveLastValues } from "@/lib/last-values";
import { useVault } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  emptyVariables,
  extractVariables,
  fillSegments,
  fillTemplate,
  initialValues,
  usesMultilineInput,
} from "@/lib/variables";

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

interface FillFormProps {
  entry: VaultEntry;
  onClose: () => void;
}

export function FillForm({ entry, onClose }: FillFormProps) {
  const { copyText } = useVault();
  const { id, title, body } = entry.prompt;

  const variables = useMemo(() => extractVariables(body), [body]);
  const [values, setValues] = useState(() => initialValues(variables, loadLastValues(id)));
  const fields = useRef<(FieldElement | null)[]>([]);

  const empty = useMemo(() => new Set(emptyVariables(variables, values)), [variables, values]);
  const preview = useMemo(() => fillSegments(body, values), [body, values]);

  async function copy() {
    saveLastValues(id, values);
    if (await copyText(fillTemplate(body, values), id)) onClose();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void copy();
    }
  }

  function handleSingleLineKeyDown(event: KeyboardEvent, index: number) {
    if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
    event.preventDefault();

    const next = fields.current[index + 1];
    if (next) next.focus();
    else void copy();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onKeyDown={handleKeyDown}
        className="flex max-h-[min(85svh,44rem)] flex-col sm:max-w-xl"
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Fill in the variables. Ctrl+Enter copies. Esc closes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {variables.map((variable, index) => {
            const isEmpty = empty.has(variable.name);
            const inputId = `fill-${index}`;
            const shared = {
              id: inputId,
              value: values[variable.name] ?? "",
              "aria-describedby": isEmpty ? `${inputId}-empty` : undefined,
              onChange: (event: { target: { value: string } }) =>
                setValues({ ...values, [variable.name]: event.target.value }),
              ref: (element: FieldElement | null) => {
                fields.current[index] = element;
              },
            };

            return (
              <div key={variable.name} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <label htmlFor={inputId} className="font-mono text-xs">
                    {variable.name}
                  </label>
                  {isEmpty && (
                    <span id={`${inputId}-empty`} className="text-[11px] text-muted-foreground">
                      Empty
                    </span>
                  )}
                </div>
                {usesMultilineInput(variable) ? (
                  <Textarea
                    {...shared}
                    className={cn("max-h-48 min-h-16", isEmpty && "border-primary/50")}
                  />
                ) : (
                  <Input
                    {...shared}
                    onFocus={(event) => event.target.select()}
                    onKeyDown={(event) => handleSingleLineKeyDown(event, index)}
                    className={cn(isEmpty && "border-primary/50")}
                  />
                )}
              </div>
            );
          })}

          <section aria-label="Preview" className="rounded-lg bg-surface-2 p-3">
            <pre className="max-h-48 overflow-y-auto font-mono text-xs/5 wrap-anywhere whitespace-pre-wrap">
              {preview.map((segment, index) =>
                segment.variable ? (
                  <span key={index} className="rounded-sm bg-primary/12 text-primary">
                    {segment.text}
                  </span>
                ) : (
                  segment.text
                ),
              )}
            </pre>
          </section>
        </div>

        <DialogFooter>
          <span className="mr-auto hidden self-center text-xs text-muted-foreground sm:block">
            Ctrl+Enter to copy
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void copy()}>Copy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
