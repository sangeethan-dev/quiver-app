export interface TemplateVariable {
  name: string;
  defaultValue?: string;
}

export type TemplateSegment =
  | { kind: "text"; text: string; raw: string }
  | { kind: "variable"; name: string; defaultValue?: string; raw: string };

export interface FilledSegment {
  text: string;
  /** Set when this text came from a variable, so a preview can highlight it. */
  variable?: string;
}

export type VariableValues = Readonly<Record<string, string>>;

const NAME_PATTERN = /^[\p{L}\p{M}\p{N}_ -]+$/u;
const MULTILINE_NAMES = new Set(["text", "content", "input", "context", "code"]);

function parseToken(inner: string): TemplateVariable | null {
  const pipe = inner.indexOf("|");
  const rawName = pipe === -1 ? inner : inner.slice(0, pipe);
  if (!NAME_PATTERN.test(rawName)) return null;

  const name = rawName.trim();
  if (!name) return null;
  return pipe === -1 ? { name } : { name, defaultValue: inner.slice(pipe + 1) };
}

/**
 * Splits a prompt body into text and variables. Joining every segment's `raw`
 * gives back the body exactly; `text` is the output, with `\{{` unescaped.
 *
 * A variable closes at the first `}}` and cannot contain another `{{`. Anything
 * that isn't a valid variable stays as literal text, so JSON and code are safe.
 */
export function parseTemplate(body: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];

  const pushText = (text: string, raw: string) => {
    if (!raw) return;
    const last = segments.at(-1);
    if (last?.kind === "text") {
      last.text += text;
      last.raw += raw;
    } else {
      segments.push({ kind: "text", text, raw });
    }
  };

  let position = 0;
  let searchFrom = 0;

  for (;;) {
    const open = body.indexOf("{{", searchFrom);
    if (open === -1) break;

    if (open > position && body[open - 1] === "\\") {
      const before = body.slice(position, open - 1);
      pushText(`${before}{{`, `${before}\\{{`);
      position = searchFrom = open + 2;
      continue;
    }

    const close = body.indexOf("}}", open + 2);
    const nextOpen = body.indexOf("{{", open + 1);
    const closesFirst = close !== -1 && (nextOpen === -1 || nextOpen > close);
    const token = closesFirst ? parseToken(body.slice(open + 2, close)) : null;

    if (!token) {
      // One step, not two: in `{{{a}}` the variable starts at the second brace.
      searchFrom = open + 1;
      continue;
    }

    const before = body.slice(position, open);
    pushText(before, before);
    segments.push({ kind: "variable", ...token, raw: body.slice(open, close + 2) });
    position = searchFrom = close + 2;
  }

  const rest = body.slice(position);
  pushText(rest, rest);
  return segments;
}

/**
 * One entry per name, in order of first appearance. If a name appears with
 * different defaults, the first default given applies to the whole field.
 */
export function extractVariables(body: string): TemplateVariable[] {
  const variables = new Map<string, TemplateVariable>();

  for (const segment of parseTemplate(body)) {
    if (segment.kind !== "variable") continue;
    const existing = variables.get(segment.name);
    if (!existing) {
      variables.set(segment.name, { name: segment.name, defaultValue: segment.defaultValue });
    } else if (existing.defaultValue === undefined) {
      existing.defaultValue = segment.defaultValue;
    }
  }

  return [...variables.values()];
}

export function hasVariables(body: string): boolean {
  return parseTemplate(body).some((segment) => segment.kind === "variable");
}

// Names come from the prompt, so `{{constructor}}` must not find Object.prototype.constructor.
function ownValue(values: VariableValues, name: string): string | undefined {
  return Object.hasOwn(values, name) ? values[name] : undefined;
}

/**
 * Filling is a single pass, so a value containing `{{x}}` stays as typed. A value
 * that was cleared stays empty; only a variable with no value uses its default.
 */
export function fillSegments(body: string, values: VariableValues): FilledSegment[] {
  const defaults = new Map(extractVariables(body).map((v) => [v.name, v.defaultValue]));

  return parseTemplate(body).map((segment) =>
    segment.kind === "text"
      ? { text: segment.text }
      : {
          text: ownValue(values, segment.name) ?? defaults.get(segment.name) ?? "",
          variable: segment.name,
        },
  );
}

export function fillTemplate(body: string, values: VariableValues): string {
  return fillSegments(body, values)
    .map((segment) => segment.text)
    .join("");
}

/** Prefill for the form: the last value used for this prompt, otherwise the default. */
export function initialValues(
  variables: readonly TemplateVariable[],
  lastValues: VariableValues,
): Record<string, string> {
  return Object.fromEntries(
    variables.map((v) => [v.name, ownValue(lastValues, v.name) || (v.defaultValue ?? "")]),
  );
}

/** Variables to mark with the "empty" warning: blank, and no default to explain why. */
export function emptyVariables(
  variables: readonly TemplateVariable[],
  values: VariableValues,
): string[] {
  return variables
    .filter((v) => v.defaultValue === undefined && !ownValue(values, v.name)?.trim())
    .map((v) => v.name);
}

export function usesMultilineInput(variable: TemplateVariable): boolean {
  return (
    MULTILINE_NAMES.has(variable.name.toLowerCase()) ||
    (variable.defaultValue?.includes("\n") ?? false)
  );
}
