import { describe, expect, it } from "vitest";
import {
  emptyVariables,
  extractVariables,
  fillSegments,
  fillTemplate,
  hasVariables,
  initialValues,
  parseTemplate,
  usesMultilineInput,
} from "@/lib/variables";

const names = (body: string) => extractVariables(body).map((v) => v.name);

describe("extractVariables", () => {
  it("reads the example from the brief, in order of first appearance", () => {
    const body =
      "Rewrite the text below in a {{tone|friendly}} tone for {{audience}}.\n" +
      "Keep it under {{length|150}} words.\n\nText:\n{{text}}\n";

    expect(extractVariables(body)).toEqual([
      { name: "tone", defaultValue: "friendly" },
      { name: "audience" },
      { name: "length", defaultValue: "150" },
      { name: "text" },
    ]);
  });

  it("returns nothing for plain text", () => {
    expect(extractVariables("")).toEqual([]);
    expect(extractVariables("No variables here.")).toEqual([]);
  });

  it("accepts letters, numbers, underscores, hyphens and inner spaces", () => {
    expect(names("{{a1}} {{snake_case}} {{kebab-case}} {{first name}} {{2nd}}")).toEqual([
      "a1",
      "snake_case",
      "kebab-case",
      "first name",
      "2nd",
    ]);
  });

  it("accepts names in other scripts, including vowel signs", () => {
    expect(names("{{பெயர்}} {{名前}} {{Größe}}")).toEqual(["பெயர்", "名前", "Größe"]);
  });

  it("trims spaces around the name", () => {
    expect(names("{{ tone }}")).toEqual(["tone"]);
    expect(extractVariables("{{  tone  |x}}")).toEqual([{ name: "tone", defaultValue: "x" }]);
  });

  it("treats the same name as one field, however it is spaced", () => {
    expect(names("{{a}} {{ a }} {{b}} {{a}}")).toEqual(["a", "b"]);
  });

  it("is case sensitive", () => {
    expect(names("{{Tone}} {{tone}}")).toEqual(["Tone", "tone"]);
  });

  it("keeps the first default a duplicated name was given", () => {
    expect(extractVariables("{{a|one}} {{a|two}}")).toEqual([{ name: "a", defaultValue: "one" }]);
    expect(extractVariables("{{a}} {{a|two}}")).toEqual([{ name: "a", defaultValue: "two" }]);
  });

  it("keeps defaults exactly as written", () => {
    expect(extractVariables("{{a|b|c}}")).toEqual([{ name: "a", defaultValue: "b|c" }]);
    expect(extractVariables("{{a| spaced }}")).toEqual([{ name: "a", defaultValue: " spaced " }]);
    expect(extractVariables("{{a|line one\nline two}}")).toEqual([
      { name: "a", defaultValue: "line one\nline two" },
    ]);
  });

  it("separates an empty default from no default", () => {
    expect(extractVariables("{{a|}}")).toEqual([{ name: "a", defaultValue: "" }]);
    expect(extractVariables("{{a}}")[0].defaultValue).toBeUndefined();
  });

  it("closes at the first }}, so JSON-looking defaults keep working once filled", () => {
    expect(extractVariables('{{a|{"x":1}}}')).toEqual([{ name: "a", defaultValue: '{"x":1' }]);
    expect(fillTemplate('{{a|{"x":1}}}', {})).toBe('{"x":1}');
  });
});

describe("malformed braces stay untouched", () => {
  it.each([
    ["empty", "{{}}"],
    ["only spaces", "{{   }}"],
    ["no name before the pipe", "{{|default}}"],
    ["unclosed", "{{name"],
    ["unclosed with default", "{{name|default"],
    ["single braces", "{name}"],
    ["one closing brace", "{{name}"],
    ["dot in name", "{{user.name}}"],
    ["punctuation in name", "{{name!}}"],
    ["newline in name", "{{first\nsecond}}"],
    ["tab in name", "{{first\tsecond}}"],
    ["JSON object", '{"a": {"b": 1}}'],
    ["JSON with a colon in double braces", '{{"a": 1}}'],
    ["Handlebars block", "{{#if user}}hello{{/if}}"],
  ])("%s", (_label, body) => {
    expect(extractVariables(body)).toEqual([]);
    expect(fillTemplate(body, { name: "x", first: "x", user: "x" })).toBe(body);
  });

  it("finds the real variable inside extra braces", () => {
    expect(names("{{{a}}}")).toEqual(["a"]);
    expect(fillTemplate("{{{a}}}", { a: "x" })).toBe("{x}");
  });

  it("handles a variable nested in JSON", () => {
    expect(fillTemplate('{"name":{{a}}}', { a: "1" })).toBe('{"name":1}');
    expect(fillTemplate('{"o":{"name":{{a}}}}', { a: "1" })).toBe('{"o":{"name":1}}');
  });

  it("does not let a default swallow a later variable", () => {
    expect(names("{{a|{{b}}")).toEqual(["b"]);
    expect(fillTemplate("{{a|{{b}}", { a: "x", b: "y" })).toBe("{{a|y");
  });

  it("keeps a broken variable from hiding a valid one after it", () => {
    expect(names("{{bad!}} then {{good}}")).toEqual(["good"]);
  });

  it("stops at an unclosed variable without losing the text around it", () => {
    expect(fillTemplate("{{a}} and {{b", { a: "x" })).toBe("x and {{b");
  });
});

describe("escapes", () => {
  it("outputs \\{{ as {{ without the backslash", () => {
    expect(fillTemplate("\\{{name}}", { name: "x" })).toBe("{{name}}");
    expect(extractVariables("\\{{name}}")).toEqual([]);
  });

  it("leaves variables around an escape working", () => {
    expect(fillTemplate("{{a}} \\{{b}} {{c}}", { a: "1", b: "2", c: "3" })).toBe("1 {{b}} 3");
  });

  it("handles adjacent escapes and a variable straight after an escape", () => {
    expect(fillTemplate("\\{{\\{{", {})).toBe("{{{{");
    expect(fillTemplate("{{a}}\\{{b}}", { a: "1" })).toBe("1{{b}}");
  });

  it("consumes only two braces", () => {
    expect(fillTemplate("\\{{{a}}", { a: "x" })).toBe("{{{a}}");
  });

  it("only treats a backslash directly before {{ as an escape", () => {
    expect(fillTemplate("\\ {{a}}", { a: "x" })).toBe("\\ x");
    expect(fillTemplate("\\{a}", {})).toBe("\\{a}");
    expect(fillTemplate("C:\\temp", {})).toBe("C:\\temp");
  });

  it("uses the last backslash when there are several", () => {
    expect(fillTemplate("\\\\{{a}}", { a: "x" })).toBe("\\{{a}}");
  });
});

describe("parseTemplate", () => {
  const samples = [
    "",
    "plain",
    "{{a}}",
    "{{a}}{{b}}",
    "x{{a|b}}y\\{{c}}z",
    "{{{a}}}",
    "{{bad!}} {{ok}} {{",
    "\\{{\\{{",
    "line\r\nline {{a}}\r\n",
  ];

  it.each(samples)("joins back to the original body: %j", (body) => {
    expect(
      parseTemplate(body)
        .map((segment) => segment.raw)
        .join(""),
    ).toBe(body);
  });

  it("merges neighbouring text", () => {
    expect(parseTemplate("a \\{{ b {{bad!}} c")).toEqual([
      { kind: "text", text: "a {{ b {{bad!}} c", raw: "a \\{{ b {{bad!}} c" },
    ]);
  });

  it("marks where variables are, for highlighting", () => {
    expect(parseTemplate("Hi {{ name |you}}!")).toEqual([
      { kind: "text", text: "Hi ", raw: "Hi " },
      { kind: "variable", name: "name", defaultValue: "you", raw: "{{ name |you}}" },
      { kind: "text", text: "!", raw: "!" },
    ]);
  });
});

describe("hasVariables", () => {
  it("decides between copying at once and opening the form", () => {
    expect(hasVariables("Hello {{name}}")).toBe(true);
    expect(hasVariables("Hello")).toBe(false);
    expect(hasVariables("\\{{name}}")).toBe(false);
    expect(hasVariables("{{bad!}}")).toBe(false);
  });
});

describe("fillTemplate", () => {
  it("fills the example from the brief", () => {
    const body = "A {{tone|friendly}} note for {{audience}}, under {{length|150}} words.";
    expect(fillTemplate(body, { audience: "the team", length: "100" })).toBe(
      "A friendly note for the team, under 100 words.",
    );
  });

  it("uses one value for every appearance of a name", () => {
    expect(fillTemplate("{{a}} {{ a }} {{a|x}}", { a: "v" })).toBe("v v v");
    expect(fillTemplate("{{a}} {{a|x}}", {})).toBe("x x");
  });

  it("outputs nothing for a variable with no value or default", () => {
    expect(fillTemplate("[{{a}}]", {})).toBe("[]");
  });

  it("keeps a value the user cleared instead of restoring the default", () => {
    expect(fillTemplate("[{{a|x}}]", { a: "" })).toBe("[]");
  });

  it("does not expand variables inside a value", () => {
    expect(fillTemplate("{{a}}", { a: "{{b}} \\{{c}}", b: "no" })).toBe("{{b}} \\{{c}}");
  });

  it("treats special replacement characters in a value literally", () => {
    expect(fillTemplate("{{a}}", { a: "$& $1 $$" })).toBe("$& $1 $$");
  });

  it("preserves whitespace and line endings around variables", () => {
    expect(fillTemplate("  {{a}}\r\n\t{{b}}  \n", { a: "1", b: "2" })).toBe("  1\r\n\t2  \n");
  });

  it("ignores values for names not in the prompt", () => {
    expect(fillTemplate("{{a}}", { a: "1", z: "2" })).toBe("1");
  });

  it("is not fooled by names that exist on Object.prototype", () => {
    expect(fillTemplate("[{{constructor}}] [{{toString}}]", {})).toBe("[] []");
    expect(fillTemplate("[{{__proto__}}]", {})).toBe("[]");
  });
});

describe("fillSegments", () => {
  it("marks filled text for the preview", () => {
    expect(fillSegments("Hi {{name}}!", { name: "Sam" })).toEqual([
      { text: "Hi " },
      { text: "Sam", variable: "name" },
      { text: "!" },
    ]);
  });
});

describe("initialValues", () => {
  const variables = [{ name: "a", defaultValue: "default" }, { name: "b" }];

  it("uses defaults when nothing was remembered", () => {
    expect(initialValues(variables, {})).toEqual({ a: "default", b: "" });
  });

  it("prefers the last value used", () => {
    expect(initialValues(variables, { a: "last", b: "last" })).toEqual({ a: "last", b: "last" });
  });

  it("falls back to the default when the remembered value is blank", () => {
    expect(initialValues(variables, { a: "" }).a).toBe("default");
  });

  it("keeps names that exist on Object.prototype as ordinary fields", () => {
    const values = initialValues([{ name: "__proto__", defaultValue: "x" }], {});
    expect(Object.keys(values)).toEqual(["__proto__"]);
    expect(fillTemplate("{{__proto__}}", values)).toBe("x");
  });
});

describe("emptyVariables", () => {
  const variables = [{ name: "a" }, { name: "b", defaultValue: "x" }, { name: "c" }];

  it("flags blank fields that have no default", () => {
    expect(emptyVariables(variables, { a: "", b: "", c: "   " })).toEqual(["a", "c"]);
    expect(emptyVariables(variables, {})).toEqual(["a", "c"]);
  });

  it("clears once a value is typed", () => {
    expect(emptyVariables(variables, { a: "1", c: "2" })).toEqual([]);
  });
});

describe("usesMultilineInput", () => {
  it.each(["text", "content", "input", "context", "code", "Text", "CODE"])("is true for %s", (n) => {
    expect(usesMultilineInput({ name: n })).toBe(true);
  });

  it("is true when the default has a line break", () => {
    expect(usesMultilineInput({ name: "a", defaultValue: "one\ntwo" })).toBe(true);
    expect(usesMultilineInput({ name: "a", defaultValue: "one\r\ntwo" })).toBe(true);
  });

  it("is false otherwise", () => {
    expect(usesMultilineInput({ name: "tone" })).toBe(false);
    expect(usesMultilineInput({ name: "subtext", defaultValue: "one line" })).toBe(false);
  });
});
