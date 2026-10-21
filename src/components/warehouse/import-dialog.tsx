"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  SUPPORTED_EXTENSIONS,
  parseWarehouseFile,
} from "@/lib/warehouse/parse";
import { capacityOf, detectLayout, describeSub } from "@/lib/warehouse/layout";
import { formatNumber } from "@/lib/warehouse/palette";
import type {
  BrandRule,
  ParsedWorkbook,
  WarehouseLayout,
} from "@/lib/warehouse/types";

export type ImportConfirmPayload = {
  parsed: ParsedWorkbook;
  detected: WarehouseLayout;
  useDetectedLayout: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  branchName: string;
  brandRules: BrandRule[];
  hasSavedLayout: boolean;
  busy?: boolean;
  onConfirm: (payload: ImportConfirmPayload) => Promise<void> | void;
};

export function WarehouseImportDialog({
  open,
  onOpenChange,
  branchId,
  branchName,
  brandRules,
  hasSavedLayout,
  busy,
  onConfirm,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [detected, setDetected] = useState<WarehouseLayout | null>(null);
  const [useDetectedLayout, setUseDetectedLayout] = useState(!hasSavedLayout);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setFileName("");
    setParsed(null);
    setDetected(null);
    setError(null);
    setParsing(false);
    setUseDetectedLayout(!hasSavedLayout);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
      setError("Use an .xlsx, .xls or .csv file.");
      return;
    }
    setError(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const result = await parseWarehouseFile(file, brandRules);
      setParsed(result);
      setDetected(detectLayout(result.records, branchId, branchName));
      setUseDetectedLayout(!hasSavedLayout);
    } catch (parseError) {
      console.error("Failed to parse warehouse file", parseError);
      setParsed(null);
      setDetected(null);
      setError(
        "The file could not be read. Check that it is a valid Excel or CSV workbook.",
      );
    } finally {
      setParsing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upload warehouse inventory</DialogTitle>
          <DialogDescription>
            Import an Excel/CSV export with{" "}
            <span className="font-medium">Locator</span>,{" "}
            <span className="font-medium">LPN</span> and{" "}
            <span className="font-medium">On-hand</span> columns. Everything is
            processed in your browser before being saved for this branch.
          </DialogDescription>
        </DialogHeader>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ")
              inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFile(event.dataTransfer.files?.[0]);
          }}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/60 hover:bg-muted/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <UploadCloud className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <div className="font-medium">
            {fileName || "Drop your file here, or click to browse"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            .xlsx, .xls or .csv · processed locally
          </div>
        </div>

        {parsing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading workbook…
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Import failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {parsed && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4" /> Sheet
                </div>
                <div className="mt-1 font-medium">
                  {parsed.sheetName || "—"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">
                  Inventory rows
                </div>
                <div className="mt-1 font-medium">
                  {formatNumber(parsed.records.length)}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">
                  Unique locations
                </div>
                <div className="mt-1 font-medium">
                  {formatNumber(
                    new Set(parsed.records.map((record) => record.locator))
                      .size,
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Detected areas
                <Badge variant="secondary">
                  {formatNumber(detected?.subInventories.length ?? 0)}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {detected?.subInventories.map((sub) => (
                  <Badge
                    key={sub.code}
                    variant="outline"
                    className="font-normal"
                  >
                    <span className="font-mono">{sub.code}</span>
                    <span className="ml-2 text-muted-foreground">
                      {describeSub(sub)}
                    </span>
                  </Badge>
                ))}
              </div>
              {detected && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Detected capacity: {formatNumber(capacityOf(detected))}{" "}
                  locations. Empty slots beyond the observed range can be added
                  in the Layout tab after import.
                </div>
              )}
            </div>

            {!hasSavedLayout && (
              <div className="flex items-start gap-2 rounded-lg border p-3">
                <Checkbox
                  id="use-detected"
                  checked={useDetectedLayout}
                  onCheckedChange={(value) =>
                    setUseDetectedLayout(value === true)
                  }
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="use-detected" className="text-sm">
                    Create the branch layout from this file
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Recommended for the first upload. You can fine-tune the
                    aisles, bays, levels and bins before or after saving.
                  </p>
                </div>
              </div>
            )}

            {parsed.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Review before importing</AlertTitle>
                <AlertDescription>
                  <ul className="list-inside list-disc space-y-1">
                    {parsed.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {parsed.records.length > 0 && (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      <th className="p-2 font-medium">Locator</th>
                      <th className="p-2 font-medium">LPN</th>
                      <th className="p-2 font-medium">Brand</th>
                      <th className="p-2 text-right font-medium">On-hand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.records.slice(0, 8).map((record, index) => (
                      <tr
                        key={`${record.locator}-${record.lpn}-${index}`}
                        className="border-t"
                      >
                        <td className="p-2 font-mono">{record.locator}</td>
                        <td className="p-2 font-mono">{record.lpn || "—"}</td>
                        <td className="p-2">{record.brand}</td>
                        <td className="p-2 text-right tabular-nums">
                          {formatNumber(record.onHand)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Detected columns:{" "}
              {Object.entries(parsed.mappedColumns)
                .map(([key, header]) => `${key} → ${header}`)
                .join(" · ") || "none"}
              {parsed.skippedRows > 0 &&
                ` · ${formatNumber(parsed.skippedRows)} row(s) skipped (no locator)`}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              !parsed || !detected || busy || parsed.records.length === 0
            }
            onClick={() => {
              if (!parsed || !detected) return;
              void onConfirm({ parsed, detected, useDetectedLayout });
            }}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {busy ? "Saving…" : "Save & view in 3D"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
