import { LayersIcon, ListFilterIcon, RefreshCwIcon, SettingsIcon, StarIcon } from "lucide-react";
import type { ReactNode } from "react";
import { QuiverMark } from "@/components/quiver-mark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/vault/icon-button";
import { ModelDot } from "@/components/vault/model-dot";
import type { ModelSetting } from "@/lib/settings";
import { UNASSIGNED_MODEL_NAME } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { TagCount, VaultCounts, VaultFilter, VaultScope } from "@/lib/vault-view";

interface FilterProps {
  filter: VaultFilter;
  models: readonly ModelSetting[];
  counts: VaultCounts;
  tags: readonly TagCount[];
  onFilterChange: (filter: VaultFilter) => void;
}

interface SidebarProps extends FilterProps {
  folderName: string;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

function sameScope(a: VaultScope, b: VaultScope): boolean {
  return a.kind === b.kind && (a.kind !== "model" || (b.kind === "model" && a.id === b.id));
}

function SidebarItem({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent font-medium text-foreground",
      )}
    >
      {children}
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-2 pt-4 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

export function Sidebar({
  filter,
  models,
  counts,
  tags,
  folderName,
  onFilterChange,
  onRefresh,
  onOpenSettings,
}: SidebarProps) {
  const selectScope = (scope: VaultScope) => onFilterChange({ ...filter, scope });
  const scopeItem = (scope: VaultScope, count: number, children: ReactNode, key?: string) => (
    <li key={key}>
      <SidebarItem
        active={sameScope(filter.scope, scope)}
        count={count}
        onClick={() => selectScope(scope)}
      >
        {children}
      </SidebarItem>
    </li>
  );

  return (
    <nav aria-label="Filters" className="flex min-h-0 flex-col bg-surface-1">
      <div className="flex h-12 shrink-0 items-center gap-2 px-4">
        <QuiverMark className="size-[18px] text-primary" />
        <span className="text-sm font-semibold tracking-tight">Quiver</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <ul>
          {scopeItem(
            { kind: "all" },
            counts.all,
            <>
              <LayersIcon className="size-3.5" />
              All
            </>,
          )}
          {scopeItem(
            { kind: "favorites" },
            counts.favorites,
            <>
              <StarIcon className="size-3.5" />
              Favorites
            </>,
          )}
        </ul>

        <SectionLabel>Models</SectionLabel>
        <ul>
          {models.map((model) =>
            scopeItem(
              { kind: "model", id: model.id },
              counts.byModel.get(model.id) ?? 0,
              <>
                <ModelDot color={model.color} className="mx-[3px]" />
                <span className="truncate">{model.name}</span>
              </>,
              model.id,
            ),
          )}
          {counts.unassigned > 0 &&
            scopeItem(
              { kind: "unassigned" },
              counts.unassigned,
              <>
                <ModelDot className="mx-[3px]" />
                {UNASSIGNED_MODEL_NAME}
              </>,
              "unassigned",
            )}
        </ul>

        {tags.length > 0 && (
          <>
            <SectionLabel>Tags</SectionLabel>
            <ul>
              {tags.map(({ tag, count }) => (
                <li key={tag}>
                  <SidebarItem
                    active={filter.tag === tag}
                    count={count}
                    onClick={() =>
                      onFilterChange({ ...filter, tag: filter.tag === tag ? null : tag })
                    }
                  >
                    <span className="truncate">{tag}</span>
                  </SidebarItem>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 border-t px-3 py-2">
        <span
          className="mr-auto truncate font-mono text-[11px] text-muted-foreground"
          title={folderName}
        >
          {folderName}
        </span>
        <IconButton label="Refresh" onClick={onRefresh}>
          <RefreshCwIcon />
        </IconButton>
        <IconButton label="Settings" onClick={onOpenSettings}>
          <SettingsIcon />
        </IconButton>
      </div>
    </nav>
  );
}

/** Stands in for the sidebar on narrow windows. */
export function FilterMenu({ filter, models, counts, tags, onFilterChange }: FilterProps) {
  const selectScope = (scope: VaultScope) => onFilterChange({ ...filter, scope });
  const active = filter.scope.kind !== "all" || filter.tag !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={active ? "secondary" : "ghost"}
          size="icon"
          aria-label="Filter prompts"
          className="lg:hidden"
        >
          <ListFilterIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-52 overflow-y-auto">
        <DropdownMenuItem onSelect={() => onFilterChange({ scope: { kind: "all" }, tag: null })}>
          All <span className="ml-auto text-xs tabular-nums">{counts.all}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => selectScope({ kind: "favorites" })}>
          Favorites <span className="ml-auto text-xs tabular-nums">{counts.favorites}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Models</DropdownMenuLabel>
        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onSelect={() => selectScope({ kind: "model", id: model.id })}
          >
            <ModelDot color={model.color} />
            <span className="truncate">{model.name}</span>
            <span className="ml-auto text-xs tabular-nums">{counts.byModel.get(model.id) ?? 0}</span>
          </DropdownMenuItem>
        ))}
        {counts.unassigned > 0 && (
          <DropdownMenuItem onSelect={() => selectScope({ kind: "unassigned" })}>
            <ModelDot />
            {UNASSIGNED_MODEL_NAME}
            <span className="ml-auto text-xs tabular-nums">{counts.unassigned}</span>
          </DropdownMenuItem>
        )}
        {tags.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Tags</DropdownMenuLabel>
            {tags.map(({ tag, count }) => (
              <DropdownMenuItem
                key={tag}
                onSelect={() => onFilterChange({ ...filter, tag: filter.tag === tag ? null : tag })}
              >
                <span className="truncate">{tag}</span>
                <span className="ml-auto text-xs tabular-nums">{count}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
