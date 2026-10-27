"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  Download,
  History,
  LayoutGrid,
  Loader2,
  Package,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useCan } from "@/hooks/use-can";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardHeader } from "@/components/dashboard-header";
import type { Branch } from "@/lib/types";
import { analyzeWarehouse, compareSummaries } from "@/lib/warehouse/analyze";
import { exportWarehouseWorkbook } from "@/lib/warehouse/export";
import { capacityOf, createLayout } from "@/lib/warehouse/layout";
import {
  buildLayoutWithRackBuilder,
  createRackBuilderConfig,
} from "@/lib/warehouse/rack-builder";
import { computeScenePlan } from "@/lib/warehouse/geometry";
import { withTimeout } from "@/lib/warehouse/timeout";
import {
  EMPTY_COLOR,
  MIXED_COLOR,
  OCCUPIED_COLOR,
  UNPLANNED_COLOR,
  areaColor,
  buildBrandColorMap,
  formatNumber,
  formatPct,
} from "@/lib/warehouse/palette";
import {
  createSnapshotId,
  deleteBranchData,
  deleteSnapshot,
  getLayoutForBranch,
  listSnapshots,
  loadSnapshotRecords,
  markCloudUnavailable,
  saveLayout,
  saveSnapshot,
} from "@/lib/warehouse/store";
import type {
  ColorMode,
  ResolvedLocation,
  SnapshotMeta,
  WarehouseFilters,
  WarehouseLayout,
  WarehouseRecord,
  WarehouseReport,
} from "@/lib/warehouse/types";
import { WarehouseAnalytics, WarehouseLocationsTable } from "./analytics";
import {
  WarehouseImportDialog,
  type ImportConfirmPayload,
} from "./import-dialog";
import { WarehouseLayoutEditor } from "./layout-editor";
import {
  WarehouseViewport,
  type WarehouseViewportHandle,
} from "./warehouse-viewport";
import type { DrawLocation } from "./warehouse-3d-scene";

const ALL = "ALL";
const BRANCH_KEY = "wareops.warehouse.branch.v1";

const DEFAULT_FILTERS: WarehouseFilters = {
  brand: ALL,
  sub: ALL,
  aisle: ALL,
  level: ALL,
  search: "",
  showEmpty: true,
};

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-4">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-semibold leading-tight tabular-nums">
            {value}
          </div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="h-3 w-3 shrink-0 rounded-sm border border-black/10"
        style={{ background: color }}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value && (
        <span className="tabular-nums text-muted-foreground">{value}</span>
      )}
    </div>
  );
}

export function WarehouseClientPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const can = useCan();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [manualBranch, setManualBranch] = useState("");
  const [restoredBranch, setRestoredBranch] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [branchRestored, setBranchRestored] = useState(false);

  const [layout, setLayout] = useState<WarehouseLayout | null>(null);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [savedLayoutExists, setSavedLayoutExists] = useState(false);
  const [records, setRecords] = useState<WarehouseRecord[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [activeSnapshotId, setActiveSnapshotId] = useState("");
  const [storageMode, setStorageMode] = useState<"cloud" | "local" | "unknown">(
    "unknown",
  );

  const [loading, setLoading] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [savingImport, setSavingImport] = useState(false);
  const [deletingBranch, setDeletingBranch] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>("brand");
  const [filters, setFilters] = useState<WarehouseFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const viewportRef = useRef<WarehouseViewportHandle>(null);
  const loadToken = useRef(0);

  const branch =
    branches.find((entry) => entry.id === selectedBranchId) ??
    (manualBranch
      ? { id: `local-${slug(manualBranch)}`, name: manualBranch, code: "" }
      : null);
  const branchId = branch?.id ?? "";
  const branchName = branch?.name ?? "";

  // Load branches once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await withTimeout(
          fetch("/api/branches", {
            cache: "no-store",
            credentials: "same-origin",
          }),
          15000,
          "Loading branches",
        );
        if (!response.ok) throw new Error(`Branches API ${response.status}`);
        const data = (await response.json()) as { items?: Branch[] };
        if (!cancelled) setBranches(data.items ?? []);
      } catch (error) {
        console.warn("Could not load branches", error);
        markCloudUnavailable();
      } finally {
        if (!cancelled) setBranchesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Remember the last branch so a reload (or local-only mode) keeps context.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BRANCH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string; name?: string };
        if (parsed?.id && parsed?.name)
          setRestoredBranch({ id: parsed.id, name: parsed.name });
      }
    } catch {
      // Ignore corrupted local state.
    } finally {
      setBranchRestored(true);
    }
  }, []);

  // Pick a sensible default branch (last used, the user's own branch, then the first).
  useEffect(() => {
    if (selectedBranchId || !branchRestored) return;
    if (branches.length) {
      const saved = restoredBranch
        ? branches.find((entry) => entry.id === restoredBranch.id)
        : undefined;
      const manualMatch = manualBranch
        ? branches.find(
            (entry) =>
              entry.name.toLowerCase() === manualBranch.toLowerCase() ||
              entry.code?.toLowerCase() === manualBranch.toLowerCase(),
          )
        : undefined;
      if (manualBranch && !manualMatch) return;
      const preferred = user?.branch
        ? branches.find(
            (entry) =>
              entry.name.toLowerCase() === user.branch?.toLowerCase() ||
              entry.code?.toLowerCase() === user.branch?.toLowerCase(),
          )
        : undefined;
      const target = saved ?? manualMatch ?? preferred ?? branches[0];
      if (target) setSelectedBranchId(target.id);
      return;
    }
    if (restoredBranch?.name && !manualBranch) {
      setManualInput(restoredBranch.name);
      setManualBranch(restoredBranch.name);
    }
  }, [
    branches,
    selectedBranchId,
    manualBranch,
    user?.branch,
    restoredBranch,
    branchRestored,
  ]);

  useEffect(() => {
    if (!branch) return;
    try {
      window.localStorage.setItem(
        BRANCH_KEY,
        JSON.stringify({ id: branch.id, name: branch.name }),
      );
    } catch {
      // Storage may be unavailable (private mode); selection still works for this session.
    }
  }, [branch?.id, branch?.name]);

  const openSnapshot = useCallback(
    async (meta: SnapshotMeta) => {
      setSnapshotLoading(true);
      try {
        const loaded = await loadSnapshotRecords(meta);
        setRecords(loaded);
        setActiveSnapshotId(meta.id);
        if (meta.layout) setLayout(meta.layout);
        setLayoutDirty(false);
        setSelected(null);
        setFilters(DEFAULT_FILTERS);
      } catch (error) {
        console.error("Failed to load snapshot", error);
        toast({ variant: "destructive", title: "Could not load snapshot" });
      } finally {
        setSnapshotLoading(false);
      }
    },
    [toast],
  );

  // Load branch layout and snapshots (after the branch list settles, so a
  // failed Firestore connection falls back to local data immediately).
  useEffect(() => {
    if (!branchesLoaded) return;
    if (!branchId) {
      setLayout(null);
      setRecords([]);
      setSnapshots([]);
      setActiveSnapshotId("");
      setSavedLayoutExists(false);
      return;
    }
    const token = ++loadToken.current;
    setLoading(true);
    (async () => {
      try {
        const [branchLayout, snapshotResult] = await Promise.all([
          getLayoutForBranch(branchId),
          listSnapshots(branchId),
        ]);
        if (token !== loadToken.current) return;
        setSavedLayoutExists(Boolean(branchLayout));
        setSnapshots(snapshotResult.snapshots);
        setStorageMode(snapshotResult.storage);
        const latest = snapshotResult.snapshots[0];
        if (latest) {
          const loaded = await loadSnapshotRecords(latest);
          if (token !== loadToken.current) return;
          setRecords(loaded);
          setActiveSnapshotId(latest.id);
          setLayout(latest.layout ?? branchLayout ?? null);
          setLayoutDirty(false);
        } else {
          setLayout(branchLayout ?? null);
          setRecords([]);
          setActiveSnapshotId("");
        }
      } catch (error) {
        console.error("Failed to load warehouse data", error);
        if (token === loadToken.current) {
          setLayout(null);
          setRecords([]);
          setSnapshots([]);
        }
      } finally {
        if (token === loadToken.current) setLoading(false);
      }
    })();
  }, [branchId, branchesLoaded]);

  const report = useMemo<WarehouseReport | null>(
    () => (layout ? analyzeWarehouse(records, layout) : null),
    [layout, records],
  );

  const activeSnapshot = useMemo(
    () => snapshots.find((entry) => entry.id === activeSnapshotId) ?? null,
    [snapshots, activeSnapshotId],
  );

  const previousSnapshot = useMemo(() => {
    const index = snapshots.findIndex((entry) => entry.id === activeSnapshotId);
    return index >= 0 ? (snapshots[index + 1] ?? null) : null;
  }, [snapshots, activeSnapshotId]);

  const delta = useMemo(
    () =>
      previousSnapshot && report
        ? compareSummaries(previousSnapshot.summary, report.summary)
        : null,
    [previousSnapshot, report],
  );

  const scenePlan = useMemo(() => {
    if (!layout) return null;
    return computeScenePlan(
      layout,
      report?.unplanned.map((entry) => entry.meta) ?? [],
    );
  }, [layout, report]);

  const resolvedByLocator = useMemo(() => {
    const map = new Map<string, ResolvedLocation>();
    report?.locations.forEach((value, key) => map.set(key, value));
    report?.unplanned.forEach((value) => map.set(value.meta.locator, value));
    return map;
  }, [report]);

  const options = useMemo(() => {
    const levels = new Set<string>();
    const aisles = new Set<string>();
    const brands = new Set<string>();
    const areas = new Set<string>();
    report?.locations.forEach((location) => {
      if (location.meta.level) levels.add(location.meta.level);
      if (location.meta.aisle !== null) aisles.add(String(location.meta.aisle));
      location.brands.forEach((brand) => brands.add(brand));
    });
    layout?.subInventories.forEach((sub) => areas.add(sub.code.toUpperCase()));
    return {
      levels: [...levels].sort((a, b) => a.localeCompare(b)),
      aisles: [...aisles].sort((a, b) => Number(a) - Number(b)),
      brands: [...brands].sort((a, b) => a.localeCompare(b)),
      areas: [...areas].sort(),
    };
  }, [report, layout]);

  const drawLocations = useMemo<DrawLocation[]>(() => {
    if (!scenePlan || !report || !layout) return [];
    const colorMap = buildBrandColorMap(
      report.summary.brandRows.map((row) => row.brand),
    );
    const areaIndex = new Map(
      layout.subInventories.map((sub, index) => [
        sub.code.toUpperCase(),
        index,
      ]),
    );
    const query = filters.search.trim().toUpperCase();
    const drawn: DrawLocation[] = [];

    for (const [locator, plan] of scenePlan.locations) {
      const resolved = resolvedByLocator.get(locator);
      const locationRecords = resolved?.records ?? [];
      if (!filters.showEmpty && !resolved?.occupied) continue;
      if (filters.sub !== ALL && plan.sub !== filters.sub) continue;
      if (
        filters.brand !== ALL &&
        !(resolved?.brands ?? []).includes(filters.brand)
      )
        continue;
      if (filters.aisle !== ALL && String(plan.meta.aisle) !== filters.aisle)
        continue;
      if (filters.level !== ALL && plan.meta.level !== filters.level) continue;
      if (query) {
        const locatorMatch = locator.includes(query);
        const recordMatch = locationRecords.some(
          (record) =>
            (record.lpn || "").toUpperCase().includes(query) ||
            (record.brand || "").toUpperCase().includes(query) ||
            (record.item || "").toUpperCase().includes(query) ||
            (record.description || "").toUpperCase().includes(query),
        );
        if (!locatorMatch && !recordMatch) continue;
      }

      let color = EMPTY_COLOR;
      if (resolved?.occupied) {
        if (colorMode === "occupancy")
          color = resolved.mixed ? MIXED_COLOR : OCCUPIED_COLOR;
        else if (colorMode === "area")
          color = areaColor(areaIndex.get(plan.sub) ?? 0);
        else
          color = resolved.mixed
            ? MIXED_COLOR
            : (colorMap.get(resolved.brands[0]) ?? "#94a3b8");
      } else if (colorMode === "area") {
        color = EMPTY_COLOR;
      }
      if (resolved?.meta.unplanned) color = UNPLANNED_COLOR;

      const height = resolved?.occupied ? plan.size[1] : 0.12;
      const baseY = plan.position[1] - plan.size[1] / 2;
      drawn.push({
        locator,
        position: [plan.position[0], baseY + height / 2, plan.position[2]],
        size: [plan.size[0], height, plan.size[2]],
        color,
      });
    }
    return drawn;
  }, [scenePlan, report, layout, resolvedByLocator, filters, colorMode]);

  const selectedLocation = useMemo(
    () => (selected ? (resolvedByLocator.get(selected) ?? null) : null),
    [selected, resolvedByLocator],
  );

  const searchMatches = useMemo(() => {
    const query = filters.search.trim().toUpperCase();
    if (!query || !report) return [];
    const matches: ResolvedLocation[] = [];
    for (const location of report.locations.values()) {
      if (matches.length >= 30) break;
      if (location.meta.locator.includes(query)) {
        matches.push(location);
        continue;
      }
      if (
        location.records.some(
          (record) =>
            (record.lpn || "").toUpperCase().includes(query) ||
            (record.brand || "").toUpperCase().includes(query) ||
            (record.item || "").toUpperCase().includes(query),
        )
      ) {
        matches.push(location);
      }
    }
    return matches;
  }, [filters.search, report]);

  const legend = useMemo(() => {
    if (!report || !layout) return [];
    if (colorMode === "brand") {
      const colorMap = buildBrandColorMap(
        report.summary.brandRows.map((row) => row.brand),
      );
      return [
        ...report.summary.brandRows.map((row) => ({
          color: colorMap.get(row.brand) ?? "#94a3b8",
          label: row.brand,
          value: `${formatNumber(row.locations)} loc`,
        })),
        { color: MIXED_COLOR, label: "Mixed brands", value: "" },
        {
          color: EMPTY_COLOR,
          label: "Empty",
          value: `${formatNumber(report.summary.emptyLocations)} loc`,
        },
      ];
    }
    if (colorMode === "occupancy") {
      return [
        {
          color: OCCUPIED_COLOR,
          label: "Occupied",
          value: `${formatNumber(report.summary.occupiedLocations)} loc`,
        },
        {
          color: MIXED_COLOR,
          label: "Mixed brands",
          value: `${formatNumber(report.summary.mixedLocations)} loc`,
        },
        {
          color: EMPTY_COLOR,
          label: "Empty",
          value: `${formatNumber(report.summary.emptyLocations)} loc`,
        },
      ];
    }
    return layout.subInventories.map((sub, index) => ({
      color: areaColor(index),
      label: `${sub.code.toUpperCase()}${sub.name && sub.name !== sub.code ? ` · ${sub.name}` : ""}`,
      value: `${formatNumber(report.summary.subRows.find((row) => row.sub === sub.code.toUpperCase())?.occupied ?? 0)} loc`,
    }));
  }, [colorMode, layout, report]);

  const handleSelect = useCallback((locator: string | null) => {
    setSelected(locator);
    if (locator) viewportRef.current?.focus(locator);
  }, []);

  const handleSaveLayout = async () => {
    if (!layout || !branchId) return;
    setSavingLayout(true);
    try {
      const result = await saveLayout(layout, user?.fullName);
      setLayout(result.layout);
      setSavedLayoutExists(true);
      setLayoutDirty(false);
      setStorageMode(result.storage);
      toast({
        title:
          result.storage === "cloud"
            ? "Layout saved"
            : "Layout saved in this browser",
        description:
          result.storage === "cloud"
            ? "The branch layout and capacity are now shared with the team."
            : "The warehouse API could not be reached, so the layout was saved in this browser only.",
      });
    } catch (error) {
      console.error("Failed to save layout", error);
      toast({ variant: "destructive", title: "Could not save the layout" });
    } finally {
      setSavingLayout(false);
    }
  };

  const handleImportConfirm = async ({
    parsed,
    detected,
    useDetectedLayout,
  }: ImportConfirmPayload) => {
    if (!branch) return;
    setSavingImport(true);
    try {
      let nextLayout: WarehouseLayout = layout ?? detected;
      if (useDetectedLayout || !layout) {
        const saved = await saveLayout(detected, user?.fullName);
        nextLayout = saved.layout;
        setLayout(saved.layout);
        setSavedLayoutExists(true);
        setLayoutDirty(false);
      }
      const summary = analyzeWarehouse(parsed.records, nextLayout).summary;
      const meta: SnapshotMeta = {
        id: createSnapshotId(),
        branchId: branch.id,
        branchName: branch.name,
        warehouseName: nextLayout.name,
        fileName: parsed.fileName,
        sheetName: parsed.sheetName,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user?.fullName,
        recordCount: parsed.records.length,
        summary,
        layout: nextLayout,
      };
      const result = await saveSnapshot(meta, parsed.records, user?.fullName);
      setLayout(nextLayout);
      setRecords(parsed.records);
      setActiveSnapshotId(result.meta.id);
      setStorageMode(result.storage);
      setSelected(null);
      setFilters(DEFAULT_FILTERS);
      const list = await listSnapshots(branch.id);
      setSnapshots(list.snapshots);
      setImportOpen(false);
      toast({
        title:
          result.storage === "cloud"
            ? "Inventory snapshot saved"
            : "Snapshot saved in this browser",
        description:
          result.storage === "cloud"
            ? `${formatNumber(parsed.records.length)} rows saved for ${branch.name}.`
            : "The warehouse API could not be reached, so the snapshot was saved in this browser only.",
      });
    } catch (error) {
      console.error("Failed to save warehouse snapshot", error);
      toast({
        variant: "destructive",
        title: "Import failed",
        description: "The snapshot could not be saved.",
      });
    } finally {
      setSavingImport(false);
    }
  };

  const handleDeleteSnapshot = async (meta: SnapshotMeta) => {
    if (!branchId) return;
    if (
      !window.confirm(
        `Delete the snapshot from ${formatDate(meta.uploadedAt)}? This cannot be undone.`,
      )
    )
      return;
    try {
      await deleteSnapshot(meta.id);
      const list = await listSnapshots(branchId);
      setSnapshots(list.snapshots);
      if (activeSnapshotId === meta.id) {
        const next = list.snapshots[0];
        if (next) await openSnapshot(next);
        else {
          setRecords([]);
          setActiveSnapshotId("");
        }
      }
      toast({ title: "Snapshot deleted" });
    } catch (error) {
      console.error("Failed to delete snapshot", error);
      toast({ variant: "destructive", title: "Could not delete the snapshot" });
    }
  };

  const handleDeleteBranchData = async () => {
    if (!branchId) return;
    if (
      !window.confirm(
        `Delete the warehouse layout and all snapshots for ${branchName}? This cannot be undone.`,
      )
    )
      return;
    setDeletingBranch(true);
    try {
      const storage = await deleteBranchData(branchId);
      setLayout(null);
      setRecords([]);
      setSnapshots([]);
      setActiveSnapshotId("");
      setSavedLayoutExists(false);
      setLayoutDirty(false);
      toast({
        title:
          storage === "cloud"
            ? "Branch warehouse data deleted"
            : "Local warehouse data deleted",
        description: "You can now create a new zone layout from scratch.",
      });
    } catch (error) {
      console.error("Failed to delete branch data", error);
      toast({
        variant: "destructive",
        title: "Could not delete the branch data",
      });
    } finally {
      setDeletingBranch(false);
    }
  };

  const handleExport = () => {
    if (!report) return;
    void exportWarehouseWorkbook(report, activeSnapshot).then(
      () =>
        toast({
          title: "Report exported",
          description: "The warehouse workbook has been downloaded.",
        }),
      (error) => {
        console.error("Failed to export report", error);
        toast({ variant: "destructive", title: "Export failed" });
      },
    );
  };

  const startManualLayout = () => {
    if (!branch) return;
    setLayout(
      buildLayoutWithRackBuilder(
        createLayout(branchId, branchName),
        createRackBuilderConfig("T"),
      ),
    );
    setLayoutDirty(true);
  };

  const canUpload = Boolean(branch) && can("warehouse", "add");
  const hasData = records.length > 0;

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Warehouse 3D" />

      <main className="flex-1 space-y-4 overflow-auto p-4 lg:p-6">
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Branch</Label>
              {branches.length > 0 ? (
                <Select
                  value={selectedBranchId}
                  onValueChange={setSelectedBranchId}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    className="w-[220px]"
                    placeholder="Branch name"
                    value={manualInput}
                    onChange={(event) => setManualInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && manualInput.trim())
                        setManualBranch(manualInput.trim());
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!manualInput.trim()}
                    onClick={() => setManualBranch(manualInput.trim())}
                  >
                    Use
                  </Button>
                </div>
              )}
              {branchesLoaded && branches.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No branches available — type a branch name to work locally.
                </p>
              )}
            </div>

            {snapshots.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Snapshot
                </Label>
                <Select
                  value={activeSnapshotId}
                  onValueChange={(value) => {
                    const meta = snapshots.find((entry) => entry.id === value);
                    if (meta) void openSnapshot(meta);
                  }}
                >
                  <SelectTrigger className="w-[260px]">
                    <SelectValue placeholder="Latest snapshot" />
                  </SelectTrigger>
                  <SelectContent>
                    {snapshots.map((meta) => (
                      <SelectItem key={meta.id} value={meta.id}>
                        {formatDate(meta.uploadedAt)} ·{" "}
                        {formatPct(meta.summary.occupancyPct)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <Button
                type="button"
                onClick={() => setImportOpen(true)}
                disabled={!canUpload || savingImport}
              >
                <Upload className="mr-2 h-4 w-4" /> Upload data
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleExport}
                disabled={!report || !can("warehouse", "export")}
              >
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
              {layout && can("warehouse", "edit") && (
                <Button
                  type="button"
                  variant={layoutDirty ? "default" : "outline"}
                  onClick={() => void handleSaveLayout()}
                  disabled={savingLayout || !layoutDirty}
                  title={
                    layoutDirty ? "Save layout changes" : "No layout changes"
                  }
                >
                  {savingLayout ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save layout
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {storageMode === "local" && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Working in local mode</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span>
                The warehouse API could not be reached, so layouts and snapshots
                are stored in this browser only. Check the server logs if this
                persists.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => window.location.reload()}
              >
                Retry connection
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!branchesLoaded || loading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading warehouse data…
          </div>
        ) : !branch ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Select a branch to open its warehouse layout and occupancy
              snapshots.
            </CardContent>
          </Card>
        ) : !layout ? (
          <Card>
            <CardHeader>
              <CardTitle>Set up the 3D warehouse for {branchName}</CardTitle>
              <CardDescription>
                Upload an inventory export and we will detect the storage areas,
                then save a dated occupancy snapshot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    icon: Upload,
                    title: "1. Upload the export",
                    text: "Excel or CSV with Locator, LPN and On-hand. Column names are detected automatically.",
                  },
                  {
                    icon: LayoutGrid,
                    title: "2. Confirm the layout",
                    text: "Rows, racks, levels and bins are inferred from the file and can be fine-tuned.",
                  },
                  {
                    icon: Boxes,
                    title: "3. Explore in 3D",
                    text: "Walk the racks, filter by brand or row, and export the full occupation report.",
                  },
                ].map((step) => (
                  <div key={step.title} className="rounded-lg border p-4">
                    <step.icon className="mb-2 h-5 w-5 text-primary" />
                    <div className="font-medium">{step.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {step.text}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => setImportOpen(true)} disabled={!canUpload}>
                  <Upload className="mr-2 h-4 w-4" /> Upload inventory file
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={startManualLayout}
                  disabled={!can("warehouse", "edit")}
                >
                  Create rack layout
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {report && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                  label="Occupancy"
                  value={formatPct(report.summary.occupancyPct)}
                  hint={
                    delta && previousSnapshot
                      ? `${delta.occupancyPct > 0 ? "+" : ""}${formatPct(delta.occupancyPct)} and ${delta.occupiedLocations > 0 ? "+" : ""}${formatNumber(delta.occupiedLocations)} locations vs previous snapshot`
                      : `${formatNumber(report.summary.occupiedLocations)} of ${formatNumber(report.summary.totalLocations)} locations`
                  }
                  icon={Boxes}
                />
                <Metric
                  label="Empty locations"
                  value={formatNumber(report.summary.emptyLocations)}
                  hint={`${formatNumber(report.summary.mixedLocations)} mixed-brand locations`}
                  icon={LayoutGrid}
                />
                <Metric
                  label="LPNs"
                  value={formatNumber(report.summary.lpnCount)}
                  hint={`${formatNumber(report.summary.skuCount)} SKUs · ${formatNumber(report.summary.recordCount)} rows`}
                  icon={Package}
                />
                <Metric
                  label="On-hand units"
                  value={formatNumber(report.summary.onHandTotal)}
                  hint={`${formatNumber(report.summary.brandCount)} brands detected`}
                  icon={History}
                />
              </div>
            )}

            {report && report.summary.unplannedLocations > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  Some locations are outside the configured layout
                </AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  <span>
                    {formatNumber(report.summary.unplannedLocations)} locator(s)
                    from the file do not exist in the branch layout. They are
                    shown in red in 3D and can be fixed in the Setup tab.
                  </span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() =>
                      setFilters({ ...DEFAULT_FILTERS, showEmpty: true })
                    }
                  >
                    Show all locations
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {!hasData && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No inventory loaded yet</AlertTitle>
                <AlertDescription>
                  The layout is configured with{" "}
                  {formatNumber(capacityOf(layout))} locations, all currently
                  shown as empty. Upload an inventory export to fill the
                  warehouse.
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="3d" className="space-y-4">
              <TabsList className="flex h-auto flex-wrap justify-start">
                <TabsTrigger value="3d">3D view</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="locations">Locations</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="setup">Setup</TabsTrigger>
              </TabsList>

              <TabsContent value="3d" className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        {layout.name} · {branchName}
                      </CardTitle>
                      <CardDescription>
                        {formatNumber(drawLocations.length)} of{" "}
                        {formatNumber(report?.locations.size ?? 0)} locations
                        shown
                        {report && report.summary.unplannedLocations > 0
                          ? ` · ${formatNumber(report.summary.unplannedLocations)} unmapped`
                          : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Colour by
                          </Label>
                          <Select
                            value={colorMode}
                            onValueChange={(value) =>
                              setColorMode(value as ColorMode)
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="brand">Brand</SelectItem>
                              <SelectItem value="occupancy">
                                Occupancy
                              </SelectItem>
                              <SelectItem value="area">Zone</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Zone
                          </Label>
                          <Select
                            value={filters.sub}
                            onValueChange={(value) =>
                              setFilters((state) => ({ ...state, sub: value }))
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ALL}>All zones</SelectItem>
                              {options.areas.map((area) => (
                                <SelectItem key={area} value={area}>
                                  {area}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Row
                          </Label>
                          <Select
                            value={filters.aisle}
                            onValueChange={(value) =>
                              setFilters((state) => ({
                                ...state,
                                aisle: value,
                              }))
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ALL}>All rows</SelectItem>
                              {options.aisles.map((aisle) => (
                                <SelectItem key={aisle} value={aisle}>
                                  Row {aisle}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Level
                          </Label>
                          <Select
                            value={filters.level}
                            onValueChange={(value) =>
                              setFilters((state) => ({
                                ...state,
                                level: value,
                              }))
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ALL}>All levels</SelectItem>
                              {options.levels.map((level) => (
                                <SelectItem key={level} value={level}>
                                  Level {level}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Brand
                          </Label>
                          <Select
                            value={filters.brand}
                            onValueChange={(value) =>
                              setFilters((state) => ({
                                ...state,
                                brand: value,
                              }))
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ALL}>All brands</SelectItem>
                              {options.brands.map((brand) => (
                                <SelectItem key={brand} value={brand}>
                                  {brand}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="relative min-w-[220px] flex-1">
                          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-8"
                            placeholder="Find a locator, LPN, brand or item…"
                            value={filters.search}
                            onChange={(event) =>
                              setFilters((state) => ({
                                ...state,
                                search: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={filters.showEmpty}
                            onCheckedChange={(value) =>
                              setFilters((state) => ({
                                ...state,
                                showEmpty: value,
                              }))
                            }
                          />
                          Show empty locations
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFilters(DEFAULT_FILTERS)}
                          disabled={
                            JSON.stringify(filters) ===
                            JSON.stringify(DEFAULT_FILTERS)
                          }
                        >
                          Clear filters
                        </Button>
                      </div>

                      {snapshotLoading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading
                          snapshot…
                        </div>
                      )}

                      {scenePlan && (
                        <WarehouseViewport
                          ref={viewportRef}
                          plan={scenePlan}
                          locations={drawLocations}
                          selected={selected}
                          onSelect={handleSelect}
                        />
                      )}

                      {drawLocations.length === 0 && (
                        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                          No locations match the current filters.
                        </div>
                      )}

                      <div className="space-y-2 rounded-lg border p-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Legend
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                          {legend.map((entry) => (
                            <LegendRow
                              key={entry.label}
                              color={entry.color}
                              label={entry.label}
                              value={entry.value}
                            />
                          ))}
                          {report && report.summary.unplannedLocations > 0 && (
                            <LegendRow
                              color={UNPLANNED_COLOR}
                              label="Outside layout"
                              value={`${report.summary.unplannedLocations}`}
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Occupied locations are full cartons; empty locations
                          are thin floor slabs at their level.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          Selected location
                        </CardTitle>
                        <CardDescription>
                          {selectedLocation
                            ? selectedLocation.meta.locator
                            : "Click a storage location in the 3D view."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedLocation ? (
                          <>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="secondary">
                                {selectedLocation.meta.sub}
                              </Badge>
                              {selectedLocation.meta.aisle !== null && (
                                <Badge variant="outline">
                                  Row {selectedLocation.meta.aisle}
                                </Badge>
                              )}
                              {selectedLocation.meta.bay !== null && (
                                <Badge variant="outline">
                                  Rack {selectedLocation.meta.bay}
                                </Badge>
                              )}
                              {selectedLocation.meta.bay === null &&
                                selectedLocation.meta.rackCode && (
                                  <Badge variant="outline">
                                    Rack {selectedLocation.meta.rackCode}
                                  </Badge>
                                )}
                              <Badge variant="outline">
                                Level {selectedLocation.meta.level}
                              </Badge>
                              {selectedLocation.meta.bin !== null && (
                                <Badge variant="outline">
                                  Bin {selectedLocation.meta.bin}
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  selectedLocation.occupied
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {selectedLocation.occupied
                                  ? "Occupied"
                                  : "Empty"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="rounded-md border p-2">
                                <div className="text-xs text-muted-foreground">
                                  LPNs
                                </div>
                                <div className="font-semibold tabular-nums">
                                  {formatNumber(selectedLocation.lpnCount)}
                                </div>
                              </div>
                              <div className="rounded-md border p-2">
                                <div className="text-xs text-muted-foreground">
                                  On-hand
                                </div>
                                <div className="font-semibold tabular-nums">
                                  {formatNumber(selectedLocation.onHand)}
                                </div>
                              </div>
                            </div>
                            {selectedLocation.meta.unplanned && (
                              <p className="text-xs text-red-600">
                                This locator is not part of the configured
                                layout. Add the range in Setup, or correct the
                                locator in the source file.
                              </p>
                            )}
                            <div className="max-h-64 space-y-2 overflow-auto pr-1">
                              {selectedLocation.records.map((record, index) => (
                                <div
                                  key={`${record.lpn}-${index}`}
                                  className="rounded-md border p-2 text-xs"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono font-medium">
                                      {record.lpn || "No LPN"}
                                    </span>
                                    <span className="tabular-nums text-muted-foreground">
                                      {formatNumber(record.onHand)}
                                    </span>
                                  </div>
                                  <div className="mt-1 font-medium">
                                    {record.brand}
                                  </div>
                                  {(record.item || record.description) && (
                                    <div className="mt-0.5 truncate text-muted-foreground">
                                      {[record.item, record.description]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {!selectedLocation.records.length && (
                                <div className="text-xs text-muted-foreground">
                                  No inventory in this location.
                                </div>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                selected && viewportRef.current?.focus(selected)
                              }
                            >
                              <ChevronRight className="mr-1 h-4 w-4" /> Centre
                              camera on location
                            </Button>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Select any carton or empty slot to inspect its LPNs,
                            on-hand quantity and item details.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {filters.search ? "Search results" : "Top brands"}
                        </CardTitle>
                        <CardDescription>
                          {filters.search
                            ? `${searchMatches.length}${searchMatches.length >= 30 ? "+" : ""} match(es) for “${filters.search}”`
                            : "Click a location to inspect it."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-1.5">
                        {filters.search ? (
                          searchMatches.length ? (
                            searchMatches.map((location) => (
                              <button
                                key={location.meta.locator}
                                type="button"
                                onClick={() =>
                                  handleSelect(location.meta.locator)
                                }
                                className="flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs hover:bg-muted"
                              >
                                <span className="font-mono">
                                  {location.meta.locator}
                                </span>
                                <span className="text-muted-foreground">
                                  {location.brands.slice(0, 2).join(", ") ||
                                    "Empty"}
                                </span>
                              </button>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              No location, LPN or item matches the search.
                            </p>
                          )
                        ) : (
                          report?.summary.brandRows.slice(0, 10).map((row) => (
                            <div
                              key={row.brand}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="truncate">{row.brand}</span>
                              <span className="tabular-nums text-muted-foreground">
                                {formatNumber(row.locations)} loc
                              </span>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="analytics">
                {report && <WarehouseAnalytics report={report} />}
              </TabsContent>

              <TabsContent value="locations">
                {report && <WarehouseLocationsTable report={report} />}
              </TabsContent>

              <TabsContent value="history">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      Snapshot history
                    </CardTitle>
                    <CardDescription>
                      Every upload is stored as a dated snapshot for this
                      branch, so you can compare occupancy over time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!snapshots.length ? (
                      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No snapshots yet. Upload an inventory file to create the
                        first one.
                      </div>
                    ) : (
                      <div className="overflow-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/60 text-left text-xs">
                            <tr>
                              <th className="p-2 font-medium">Uploaded</th>
                              <th className="p-2 font-medium">File</th>
                              <th className="p-2 text-right font-medium">
                                Rows
                              </th>
                              <th className="p-2 text-right font-medium">
                                Locations
                              </th>
                              <th className="p-2 text-right font-medium">
                                Occupancy
                              </th>
                              <th className="p-2 text-right font-medium">
                                LPNs
                              </th>
                              <th className="p-2 text-right font-medium">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshots.map((meta) => (
                              <tr
                                key={meta.id}
                                className={`border-t ${meta.id === activeSnapshotId ? "bg-primary/5" : ""}`}
                              >
                                <td className="p-2">
                                  <div className="font-medium">
                                    {formatDate(meta.uploadedAt)}
                                  </div>
                                  {meta.uploadedBy && (
                                    <div className="text-xs text-muted-foreground">
                                      by {meta.uploadedBy}
                                    </div>
                                  )}
                                </td>
                                <td
                                  className="max-w-[220px] truncate p-2"
                                  title={meta.fileName}
                                >
                                  {meta.fileName}
                                </td>
                                <td className="p-2 text-right tabular-nums">
                                  {formatNumber(meta.recordCount)}
                                </td>
                                <td className="p-2 text-right tabular-nums">
                                  {formatNumber(meta.summary.occupiedLocations)}
                                  /{formatNumber(meta.summary.totalLocations)}
                                </td>
                                <td className="p-2 text-right tabular-nums">
                                  {formatPct(meta.summary.occupancyPct)}
                                </td>
                                <td className="p-2 text-right tabular-nums">
                                  {formatNumber(meta.summary.lpnCount)}
                                </td>
                                <td className="p-2">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => void openSnapshot(meta)}
                                      disabled={
                                        meta.id === activeSnapshotId ||
                                        snapshotLoading
                                      }
                                    >
                                      Load
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 text-destructive"
                                      title="Delete snapshot"
                                      onClick={() =>
                                        void handleDeleteSnapshot(meta)
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {activeSnapshot && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Active snapshot: {formatDate(activeSnapshot.uploadedAt)}{" "}
                        · {activeSnapshot.fileName} ·{" "}
                        {formatNumber(activeSnapshot.recordCount)} rows
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="setup">
                <div className="space-y-4">
                  {report && report.warnings.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Validation</AlertTitle>
                      <AlertDescription>
                        <ul className="list-inside list-disc space-y-1">
                          {report.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  {layout && (
                    <WarehouseLayoutEditor
                      layout={layout}
                      onChange={(next) => {
                        setLayout(next);
                        setLayoutDirty(true);
                      }}
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => void handleSaveLayout()}
                      disabled={!layoutDirty || savingLayout}
                    >
                      {savingLayout ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save layout for {branchName}
                    </Button>
                    {layoutDirty && (
                      <span className="text-sm text-amber-600">
                        Unsaved layout changes
                      </span>
                    )}
                    {!savedLayoutExists && layout && (
                      <span className="text-sm text-muted-foreground">
                        This layout is not saved for the branch yet.
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      Capacity:{" "}
                      {formatNumber(
                        capacityOf(
                          layout ?? createLayout(branchId, branchName),
                        ),
                      )}{" "}
                      locations
                    </span>
                  </div>

                  {report && report.unplanned.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          Locators outside the layout
                        </CardTitle>
                        <CardDescription>
                          These records are displayed in the red “unmapped”
                          area. Widen the ranges above, or fix the locators in
                          the source export.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-60 overflow-auto rounded-lg border">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-muted/80 text-left">
                              <tr>
                                <th className="p-2 font-medium">Locator</th>
                                <th className="p-2 font-medium">Area</th>
                                <th className="p-2 text-right font-medium">
                                  Records
                                </th>
                                <th className="p-2 text-right font-medium">
                                  On-hand
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.unplanned
                                .slice(0, 200)
                                .map((location) => (
                                  <tr
                                    key={location.meta.locator}
                                    className="border-t"
                                  >
                                    <td className="p-2 font-mono">
                                      {location.meta.locator}
                                    </td>
                                    <td className="p-2">{location.meta.sub}</td>
                                    <td className="p-2 text-right tabular-nums">
                                      {location.records.length}
                                    </td>
                                    <td className="p-2 text-right tabular-nums">
                                      {formatNumber(location.onHand)}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                        {report.unplanned.length > 200 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Showing the first 200 of {report.unplanned.length}.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-destructive">
                        Delete branch warehouse data
                      </CardTitle>
                      <CardDescription>
                        Removes the saved layout and every occupancy snapshot
                        for {branchName}. Use this to start fresh with a new
                        zone structure you create below.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deletingBranch || !can("warehouse", "delete")}
                        onClick={() => void handleDeleteBranchData()}
                      >
                        {deletingBranch ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Delete layout and snapshots
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <WarehouseImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        branchId={branchId}
        branchName={branchName}
        brandRules={
          layout?.brandRules ?? createLayout(branchId, branchName).brandRules
        }
        hasSavedLayout={Boolean(layout)}
        busy={savingImport}
        onConfirm={handleImportConfirm}
      />
    </div>
  );
}
