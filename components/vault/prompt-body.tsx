import { useMemo } from "react";
import { parseTemplate } from "@/lib/variables";

/** The prompt as written, with variables marked. Rendered as text, never as HTML. */
export function PromptBody({ body }: { body: string }) {
  const segments = useMemo(() => parseTemplate(body), [body]);

  return (
    <pre className="font-mono text-[13px]/6 wrap-anywhere whitespace-pre-wrap">
      {segments.map((segment, index) =>
        segment.kind === "variable" ? (
          <span key={index} className="rounded-sm bg-primary/12 text-primary">
            {segment.raw}
          </span>
        ) : (
          segment.raw
        ),
      )}
    </pre>
  );
}
