import type { PromptDraft } from "@/lib/fs/vault";

/** One per default model. They're ordinary prompts, labelled in the title and by tag. */
export const EXAMPLE_PROMPTS: readonly PromptDraft[] = [
  {
    title: "Example · Plan a focused day",
    model: "chatgpt",
    tags: ["example", "planning"],
    body: `Here is my task list for today. Pick the three that matter most, say why, and suggest an order that puts the hardest work first. Keep the answer short.\n`,
  },
  {
    title: "Example · Rewrite for tone",
    model: "claude",
    tags: ["example", "writing"],
    body: `Rewrite the message below in a {{tone|warm but direct}} tone for {{audience}}. Keep it under {{length|120}} words and keep every fact.\n\nMessage:\n{{text}}\n`,
  },
  {
    title: "Example · Explain this code",
    model: "gemini",
    tags: ["example", "code"],
    body: `Explain what this {{language|TypeScript}} code does, step by step, for someone new to it. Point out one thing that could go wrong.\n\n{{code}}\n`,
  },
];
