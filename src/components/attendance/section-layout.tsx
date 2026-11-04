"use client";

import type { ComponentType, ReactNode } from "react";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SectionDef = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Small count shown next to the label */
  count?: number | string;
  group?: string;
  hidden?: boolean;
};

/** Left section menu (a dropdown on small screens) + the selected section. */
export function SectionLayout({ sections, active, onChange, children }: { sections: SectionDef[]; active: string; onChange: (key: string) => void; children: ReactNode }) {
  const visible = sections.filter((s) => !s.hidden);
  const groups = [...new Set(visible.map((s) => s.group ?? ""))];
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="lg:hidden">
        <Select value={active} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visible.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.group ? `${s.group} · ` : ""}
                {s.label}
                {s.count ? ` (${s.count})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <nav className="hidden space-y-4 self-start rounded-lg border bg-card p-2 lg:sticky lg:top-4 lg:block">
        {groups.map((group) => (
          <div key={group} className="space-y-1">
            {group && <div className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>}
            {visible
              .filter((s) => (s.group ?? "") === group)
              .map((s) => {
                const Icon = s.icon;
                const on = s.key === active;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => onChange(s.key)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                      on ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{s.label}</span>
                    {s.count !== undefined && s.count !== 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-primary-foreground">{s.count}</span>
                    )}
                  </button>
                );
              })}
          </div>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Page title of the selected section, with its main actions on the right. */
export function SectionHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Title, description, counts and the toolbar above a list. */
export function ListHeader({
  title,
  description,
  summary,
  search,
  onSearch,
  showInactive,
  onShowInactive,
  toggleLabel = "Show inactive",
  addLabel,
  onAdd,
  extra,
}: {
  title: string;
  description?: ReactNode;
  summary?: string;
  search?: string;
  onSearch?: (v: string) => void;
  showInactive?: boolean;
  onShowInactive?: (v: boolean) => void;
  toggleLabel?: string;
  addLabel?: string;
  onAdd?: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
          {summary && <p className="mt-1 text-xs text-muted-foreground">{summary}</p>}
        </div>
        {onAdd && (
          <Button onClick={onAdd}>
            <Plus className="mr-1 h-4 w-4" /> {addLabel ?? "Add"}
          </Button>
        )}
      </div>
      {(onSearch || onShowInactive || extra) && (
        <div className="flex flex-wrap items-center gap-3">
          {onSearch && (
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search…" className="pl-8" />
            </div>
          )}
          {onShowInactive && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={!!showInactive} onCheckedChange={onShowInactive} /> {toggleLabel}
            </label>
          )}
          {extra}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Inactive
    </Badge>
  );
}

export type RowAction = { label: string; onSelect: () => void; danger?: boolean; hidden?: boolean; separatorBefore?: boolean };

/** "⋯" menu at the end of a row. Renders nothing when no action is allowed. */
export function RowActions({ actions }: { actions: RowAction[] }) {
  const shown = actions.filter((a) => !a.hidden);
  if (!shown.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {shown.map((a) => (
          <div key={a.label}>
            {a.separatorBefore && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={a.onSelect} className={a.danger ? "text-destructive focus:text-destructive" : undefined}>
              {a.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

export function matches(search: string, ...values: (string | number | null | undefined)[]) {
  const q = search.trim().toLowerCase();
  return !q || values.some((v) => String(v ?? "").toLowerCase().includes(q));
}
