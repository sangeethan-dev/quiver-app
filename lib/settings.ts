import { slugify } from "@/lib/slug";

export interface ModelSetting {
  id: string;
  name: string;
  color: string;
}

export interface Settings {
  models: ModelSetting[];
}

export type SettingsParseResult =
  | { ok: true; settings: Settings; extra: Record<string, unknown> }
  | { ok: false; error: string };

// Deepened from the brand colors so each dot reaches 3:1 on every surface in both themes.
export const DEFAULT_SETTINGS: Settings = {
  models: [
    { id: "chatgpt", name: "ChatGPT", color: "#0d9471" },
    { id: "claude", name: "Claude", color: "#cb6545" },
    { id: "gemini", name: "Gemini", color: "#3f7ff0" },
  ],
};

export const FALLBACK_MODEL_COLOR = "#7d8794";

/** Offered to new models in turn. Each reaches 3:1 on every surface in both themes. */
const NEW_MODEL_COLORS = ["#8a63d2", "#ab7612", "#cc4f86", "#0f8ea3", "#6f8a1f"];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function createModel(name: string, existing: readonly ModelSetting[]): ModelSetting {
  const base = slugify(name);
  const ids = new Set(existing.map((model) => model.id));

  let id = base;
  for (let copy = 2; ids.has(id); copy++) id = `${base}-${copy}`;

  const color = NEW_MODEL_COLORS[existing.length % NEW_MODEL_COLORS.length];
  return { id, name, color };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Fields other than `models` go in `extra`, so saving settings keeps them. */
export function parseSettings(text: string): SettingsParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return { ok: false, error: "The file isn't valid JSON" };
  }

  if (!isRecord(data) || !Array.isArray(data.models)) {
    return { ok: false, error: 'The file needs a "models" list' };
  }

  const { models: rawModels, ...extra } = data;
  const models: ModelSetting[] = [];
  const ids = new Set<string>();

  for (const [index, model] of rawModels.entries()) {
    if (!isRecord(model) || typeof model.id !== "string" || typeof model.name !== "string") {
      return { ok: false, error: `Model ${index + 1} needs an id and a name` };
    }
    if (!model.id || ids.has(model.id)) {
      return { ok: false, error: `Model ${index + 1} needs a unique id` };
    }
    ids.add(model.id);

    const color =
      typeof model.color === "string" && HEX_COLOR.test(model.color)
        ? model.color
        : FALLBACK_MODEL_COLOR;
    models.push({ id: model.id, name: model.name, color });
  }

  return { ok: true, settings: { models }, extra };
}

export function serializeSettings(
  settings: Settings,
  extra: Readonly<Record<string, unknown>> = {},
): string {
  return `${JSON.stringify({ ...extra, ...settings }, null, 2)}\n`;
}
