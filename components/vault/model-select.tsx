import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelDot } from "@/components/vault/model-dot";
import { UNASSIGNED_MODEL_NAME } from "@/lib/search";
import type { ModelSetting } from "@/lib/settings";
import { findModel } from "@/lib/vault-view";

// Select items can't have an empty value.
const NO_MODEL = "__no-model__";

interface ModelSelectProps {
  value: string;
  models: readonly ModelSetting[];
  onChange: (value: string) => void;
}

export function ModelSelect({ value, models, onChange }: ModelSelectProps) {
  // A retired model's id stays in the file until a new model is actually chosen.
  const unknownId = value && !findModel(models, value) ? value : NO_MODEL;

  return (
    <Select
      value={value || NO_MODEL}
      onValueChange={(next) => onChange(next === NO_MODEL ? "" : next)}
    >
      <SelectTrigger aria-label="Model" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            <ModelDot color={model.color} />
            {model.name}
          </SelectItem>
        ))}
        <SelectItem value={unknownId}>
          <ModelDot />
          {UNASSIGNED_MODEL_NAME}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
