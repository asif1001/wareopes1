"use client";

import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { uploadProductionFile } from '@/lib/firebase/storage';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';

import type { SerializableShipment } from '@/lib/types';

type CaseRecord = {
  caseNumber: string;
  criticalParts: number;
  totalLines: number;
  domesticLines: number;
  bulkLines: number;
  row: number;
};

type ProductionClientPageProps = {
  initialShipments: SerializableShipment[];
};

function getPriorityScore(s: SerializableShipment) {
  // Derived priority: earlier ETA first; tie-breaker by totalCases desc
  const eta = s.bahrainEta ? new Date(s.bahrainEta).getTime() : Number.MAX_SAFE_INTEGER;
  const cases = typeof s.totalCases === 'number' ? s.totalCases : 0;
  return { key: eta, tie: -cases }; // lower eta is higher priority
}

export function ProductionClientPage({ initialShipments }: ProductionClientPageProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  // Selection & filtering state
  const [search, setSearch] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'date' | 'id' | 'priority'>('priority');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});

  // Upload & parsing state
  const [dragActive, setDragActive] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [records, setRecords] = React.useState<CaseRecord[]>([]);
  const [recordErrors, setRecordErrors] = React.useState<Record<number, string[]>>({});

  // Confirmation dialog state
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
const [processingPhase, setProcessingPhase] = React.useState<'idle' | 'upload' | 'process'>('idle');

function uploadProductionFileViaServer(
  file: File,
  shipmentId: string,
  onProgress: (pct: number) => void
): Promise<{ storagePath?: string; downloadURL?: string; fileName?: string }> {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/production/upload');
      xhr.responseType = 'json';
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onload = () => {
        const status = xhr.status || 0;
        const body = xhr.response;
        if (status >= 200 && status < 300) {
          resolve(body || {});
        } else {
          const msg = body?.message || body?.error || `HTTP ${status}`;
          reject(new Error(String(msg)));
        }
      };
      const form = new FormData();
      form.append('file', file);
      form.append('shipmentId', shipmentId);
      xhr.send(form);
    } catch (err) {
      reject(err as Error);
    }
  });
}
  const [lastUpload, setLastUpload] = React.useState<{ shipmentIds: string[]; caseNumbers: string[] } | null>(null);

  const shipments = React.useMemo(() => initialShipments, [initialShipments]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = shipments;
    if (q) {
      arr = arr.filter((s) => {
        const id = String(s.id || '').toLowerCase();
        const inv = String(s.invoice || '').toLowerCase();
        const bl = String(s.billOfLading || '').toLowerCase();
        return id.includes(q) || inv.includes(q) || bl.includes(q);
      });
    }
    // sort
    const sorted = [...arr].sort((a, b) => {
      if (sortBy === 'id') {
        return String(a.id || '').localeCompare(String(b.id || ''));
      }
      if (sortBy === 'date') {
        const ad = a.bahrainEta ? new Date(a.bahrainEta).getTime() : 0;
        const bd = b.bahrainEta ? new Date(b.bahrainEta).getTime() : 0;
        return ad - bd;
      }
      const ap = getPriorityScore(a);
      const bp = getPriorityScore(b);
      if (ap.key !== bp.key) return ap.key - bp.key;
      if (ap.tie !== bp.tie) return ap.tie - bp.tie;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    return sorted;
  }, [shipments, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageData = filtered.slice(pageStart, pageStart + pageSize);

  React.useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const isOn = !!prev[id];
      const next: Record<string, boolean> = {};
      // Enforce single selection: toggle off if already on, else only this id
      if (!isOn) next[id] = true;
      return next;
    });
  }

  function selectPage(value: boolean) {
    const ids = pageData.map((s) => String(s.id));
    setSelected((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = value;
      return next;
    });
  }

  function validateFile(f: File): string[] {
    const errors: string[] = [];
    const ext = f.name.split('.').pop()?.toLowerCase();
    const allowed = ['xlsx', 'xls', 'csv'];
    if (!ext || !allowed.includes(ext)) {
      errors.push('Invalid file format. Allowed: .xlsx, .xls, .csv');
    }
    const maxBytes = 10 * 1024 * 1024; // 10MB
    if (f.size > maxBytes) {
      errors.push('File size exceeds 10MB limit');
    }
    return errors;
  }

  function normalizeHeader(h: string) {
    return h.trim().toLowerCase().replace(/\s+/g, '');
  }

  function validateRecord(r: CaseRecord): string[] {
    const errors: string[] = [];
    if (!r.caseNumber || typeof r.caseNumber !== 'string') {
      errors.push('Case number is required');
    } else if (!/^[-A-Za-z0-9_/\\]+$/.test(r.caseNumber)) {
      errors.push('Invalid case number format');
    }
    const numericFields: Array<keyof CaseRecord> = ['criticalParts','totalLines','domesticLines','bulkLines'];
    for (const f of numericFields) {
      const v = Number(r[f] as any);
      if (r[f] == null || Number.isNaN(v)) {
        errors.push(`${String(f)} must be a number`);
      } else if (v < 0) {
        errors.push(`${String(f)} must be ≥ 0`);
      }
    }
    return errors;
  }

  async function parseFile(f: File) {
    const fileErrors = validateFile(f);
    if (fileErrors.length) {
      toast({ title: 'Invalid file', description: fileErrors.join('\n'), variant: 'destructive' });
      return;
    }
    setParsing(true);
    setRecordErrors({});
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (!json.length) throw new Error('Empty file');
      // New Spec: header row is at Excel row 1 (0-index 0)
      const headerIndex = 0;
      if (!json[headerIndex]) throw new Error('Header row (1) not found');
      const headerRow: string[] = (json[headerIndex] || []).map((x: any) => String(x || ''));
      const A = normalizeHeader(headerRow[0] || '');
      const B = normalizeHeader(headerRow[1] || '');
      const C = normalizeHeader(headerRow[2] || '');
      const D = normalizeHeader(headerRow[3] || '');
      const E = normalizeHeader(headerRow[4] || '');

      const expect = {
        A: ['caseno','case#','case'],
        B: ['no.ofcriticalparts','criticalparts'],
        C: ['totallines'],
        D: ['ekc'],
        E: ['ekm'],
      } as const;

      function matches(h: string, alts: readonly string[]) {
        return alts.some((a) => h.includes(a));
      }

      const headerOk = matches(A, expect.A) && matches(B, expect.B) && matches(C, expect.C) && matches(D, expect.D) && matches(E, expect.E);
      if (!headerOk) {
        toast({
          title: 'Invalid file format',
          description: 'Expected headers at row 1: A=Case No, B=No. of Critical Parts, C=Total Lines, D=EKC, E=EKM',
          variant: 'destructive',
        });
        setParsing(false);
        return;
      }
      const recs: CaseRecord[] = [];
      const errs: Record<number, string[]> = {};
      // Data section begins after header, i.e., row 2 onward
      for (let i = headerIndex + 1; i < json.length; i++) {
        const row = json[i];
        if (!row || !row.length) continue;
        const caseNumber = String(row[0] ?? '').trim();
        const r: CaseRecord = {
          caseNumber,
          criticalParts: Number(row[1] ?? 0),
          totalLines: Number(row[2] ?? 0),
          domesticLines: Number(row[3] ?? 0),
          bulkLines: Number(row[4] ?? 0),
          row: i + 1,
        };
        const v = validateRecord(r);
        if (v.length) {
          errs[r.row] = v;
        } else {
          recs.push(r);
        }
      }
      setRecords(recs);
      setRecordErrors(errs);
      toast({ title: 'File parsed', description: `Parsed ${recs.length} valid row(s) starting from row 2`, variant: 'default' });
    } catch (e: any) {
      toast({ title: 'Parse error', description: e?.message || 'Failed to parse file', variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  }

  function downloadTemplate() {
    try {
      const rows: any[][] = [];
      // New format: header at row 1 (index 0), columns A–E
      rows.push([
        'Case No',
        'No. of Critical Parts',
        'Total Lines',
        'EKC',
        'EKM',
      ]);
      // sample data starting row 2
      rows.push(['CASE-001', 2, 10, 7, 3]);
      rows.push(['CASE-002', 0, 5, 2, 3]);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, 'production-upload-template.xlsx');
    } catch (e: any) {
      toast({ title: 'Template download failed', description: e?.message || 'Could not generate template', variant: 'destructive' });
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      parseFile(f);
    }
  }

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      parseFile(f);
    }
  }

  const selectedIds = React.useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const selectedShipment = React.useMemo(() => shipments.find((s) => selected[String(s.id)]), [shipments, selected]);
  const isLocked = !!selectedShipment?.productionUploaded;
  const totalItems = React.useMemo(() => records.length * selectedIds.length, [records.length, selectedIds.length]);

  async function submitWithRetry(payload: any, maxRetries = 2, timeoutMs = 25000) {
    let attempt = 0;
    let lastError: any = null;
    while (attempt <= maxRetries) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
        const res = await fetch('/api/production/process-cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        return await res.json();
      } catch (e) {
        lastError = e;
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        attempt++;
      }
    }
    throw lastError;
  }

async function onConfirmProcess() {
    if (!selectedIds.length) {
      toast({ title: 'No shipments selected', description: 'Select at least one shipment', variant: 'destructive' });
      return;
    }
    if (!records.length) {
      toast({ title: 'No records to process', description: 'Upload a valid file first', variant: 'destructive' });
      return;
    }
    if (!file) {
      toast({ title: 'No file selected', description: 'Please select a file to upload', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
  setProcessingPhase('upload');
  setUploadProgress(0);
    const mapping: Record<string, CaseRecord[]> = {};
    for (const id of selectedIds) mapping[id] = records;
    try {
      // Upload original file to Firebase Storage under shipment path (best-effort)
      const shipmentId = selectedIds[0];
      let upload: { downloadURL?: string; storagePath?: string; fileName?: string } | null = null;
      try {
  try {
    upload = await uploadProductionFileViaServer(file, shipmentId, (pct) => setUploadProgress(pct));
  } catch (err) {
    console.error('Server-side upload failed, falling back to client upload:', err);
    try {
      // Fallback without progress; keep UI responsive by jumping to 100%.
      upload = await uploadProductionFile(file, shipmentId, user?.id);
      setUploadProgress(100);
    } catch (err2) {
      console.warn('Client-side upload also failed; continuing without file link.', err2);
      upload = {} as any;
    }
  }
      } catch (err) {
        console.warn('Upload to Storage failed, proceeding without file link', err);
      }
      setProcessingPhase('process');
      const meta = {
        fileName: file?.name || 'unknown',
        fileUrl: upload?.downloadURL,
        storagePath: upload?.storagePath,
        sheetName: undefined as string | undefined,
        headerRow: 1,
        columnMap: { A: 'Case No', B: 'No. of Critical Parts', C: 'Total Lines', D: 'EKC', E: 'EKM' },
        rowCount: records.length,
        shipmentIds: selectedIds,
      };
      const result = await submitWithRetry({ shipments: mapping, meta });
      toast({ title: 'Processed successfully', description: `Processed ${totalItems} item(s) across ${selectedIds.length} shipment(s)` });
      // preserve last upload info to enable deletion without additional reads
      setLastUpload({ shipmentIds: selectedIds, caseNumbers: records.map((r) => r.caseNumber) });
      setConfirmOpen(false);
      setRecords([]);
      setFile(null);
    } catch (e: any) {
      toast({ title: 'Processing failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
  setUploadProgress(null);
  setProcessingPhase('idle');
    }
  }

  async function onDeleteLastUpload() {
    if (!lastUpload) {
      toast({ title: 'Nothing to delete', description: 'No recent upload found', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const mapping: Record<string, string[]> = {};
      for (const id of lastUpload.shipmentIds) {
        mapping[id] = lastUpload.caseNumbers;
      }
      const res = await fetch('/api/production/process-cases', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipments: mapping }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      toast({ title: 'Deleted uploaded records', description: `Deleted ${data?.totalDeletes ?? 0} item(s)`, variant: 'default' });
      setLastUpload(null);
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">WIP Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex gap-2 items-end">
              <div className="grid gap-1">
                <Label htmlFor="search" className="sr-only">Search shipments</Label>
                <Input id="search" placeholder="Search by ID, Invoice, or B/L" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="sort" className="sr-only">Sort by</Label>
                <select id="sort" className="border rounded px-2 py-2" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} aria-label="Sort shipments">
                  <option value="priority">Priority (earlier ETA)</option>
                  <option value="date">Shipment Date (Bahrain ETA)</option>
                  <option value="id">Shipment ID</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Button variant="outline" onClick={() => selectPage(true)} aria-label="Select all on page">Select Page</Button>
              <Button variant="outline" onClick={() => selectPage(false)} aria-label="Clear selection on page">Clear Page</Button>
            </div>
          </div>

          <div className="border rounded mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Select</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>B/L</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Containers</TableHead>
                  <TableHead>Bahrain ETA</TableHead>
                  <TableHead>Actual Bahrain ETA</TableHead>
                  <TableHead>Cleared</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.map((s) => (
                  <TableRow key={String(s.id)}>
                    <TableCell>
                      <Checkbox
                        checked={!!selected[String(s.id)]}
                        onCheckedChange={() => toggleSelected(String(s.id))}
                        aria-label={`Select shipment ${String(s.id)}`}
                      />
                    </TableCell>
                    <TableCell>{s.invoice || '-'}</TableCell>
                    <TableCell>{s.billOfLading || '-'}</TableCell>
                    <TableCell>{s.source || '-'}</TableCell>
                    <TableCell>{Array.isArray(s.containers) ? s.containers.length : 0}</TableCell>
                    <TableCell>{s.bahrainEta ? new Date(s.bahrainEta).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{s.actualBahrainEta ? new Date(s.actualBahrainEta).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>{s.cleared ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))}
                {pageData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm py-6">No shipments found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm">Page {page} of {totalPages}</div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload & Parse */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Case Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-muted-foreground">
              Template format: header at row 1 with columns A–E → A=Case No, B=No. of Critical Parts, C=Total Lines, D=EKC, E=EKM.
            </div>
            <Button variant="outline" onClick={downloadTemplate} aria-label="Download upload template">
              Download Template
            </Button>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded p-6 text-center transition ${dragActive ? 'border-primary bg-muted' : 'border-muted'}`}
            aria-label="Drag and drop file here"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="text-sm">Drag and drop Excel/CSV file here</div>
              <div className="text-xs text-muted-foreground">Accepted: .xlsx, .xls, .csv · Max 10MB</div>
              <div className="flex items-center gap-2 mt-2">
                <Input type="file" accept=".xlsx,.xls,.csv" onChange={onSelectFile} aria-label="Select file" disabled={isLocked} />
                {parsing && <Spinner aria-label="Parsing file" />}
              </div>
              {isLocked && (
                <div className="text-xs text-destructive mt-2">Cases already uploaded for this shipment. Delete to re-upload.</div>
              )}
            </div>
          </div>

          {/* Preview */}
          {file && (
            <div className="mt-4 text-sm">Selected file: {file.name} ({(file.size / 1024).toFixed(1)} KB)</div>
          )}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Parsed Records</div>
              <div className="text-xs text-muted-foreground">Valid: {records.length} · Errors: {Object.keys(recordErrors).length}</div>
            </div>
            <div className="border rounded overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Case Number</TableHead>
                    <TableHead>No. of Critical Parts</TableHead>
                    <TableHead>Total Lines</TableHead>
                    <TableHead>No. of Line of Domestic</TableHead>
                    <TableHead>No. of Lines of Bulk</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={`r-${r.row}`}>
                      <TableCell>{r.row}</TableCell>
                      <TableCell>{r.caseNumber}</TableCell>
                      <TableCell>{r.criticalParts}</TableCell>
                      <TableCell>{r.totalLines}</TableCell>
                      <TableCell>{r.domesticLines}</TableCell>
                      <TableCell>{r.bulkLines}</TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                  ))}
                  {Object.entries(recordErrors).map(([row, errs]) => (
                    <TableRow key={`e-${row}`} className="bg-destructive/10">
                      <TableCell>{row}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-destructive text-xs">{errs.join('; ')}</TableCell>
                    </TableRow>
                  ))}
                  {records.length === 0 && Object.keys(recordErrors).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm py-6">No data parsed yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Confirm */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm">Selected shipments: {selectedIds.length} · Total items to process: {totalItems}</div>
            <Button onClick={() => setConfirmOpen(true)} disabled={!selectedIds.length || !records.length || isLocked}>Review & Confirm</Button>
          </div>

          {/* Delete last upload */}
          {lastUpload && (
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Last upload: {lastUpload.caseNumbers.length} cases across {lastUpload.shipmentIds.length} shipment(s)</div>
              <Button variant="destructive" onClick={onDeleteLastUpload} disabled={submitting} aria-label="Delete last uploaded records">Delete Last Upload</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent aria-describedby="confirm-desc">
          <DialogHeader>
            <DialogTitle>Confirm Processing</DialogTitle>
          </DialogHeader>
          <div id="confirm-desc" className="text-sm text-muted-foreground">
            Review summary before submitting to server
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            <div>Selected shipment count: {selectedIds.length}</div>
            <div>Total items being processed: {totalItems}</div>
            <div className="font-medium mt-2">Sample of case numbers</div>
            <div className="border rounded p-2 max-h-40 overflow-auto">
              {records.slice(0, 10).map((r) => (
                <div key={`samp-${r.row}`} className="flex justify-between">
                  <span>{r.caseNumber}</span>
                  <span>{r.criticalParts}</span>
                </div>
              ))}
              {records.length === 0 && <div className="text-xs text-muted-foreground">No records</div>}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Back</Button>
            <div className="flex flex-col gap-2 w-64">
              {submitting && (
                <div className="text-xs text-muted-foreground">
                  {processingPhase === 'upload' && (
                    <span>Uploading file{uploadProgress !== null ? `: ${uploadProgress}%` : '...'}</span>
                  )}
                  {processingPhase === 'process' && (
                    <span>Processing cases...</span>
                  )}
                </div>
              )}
              {submitting && processingPhase === 'upload' && (
                <Progress value={uploadProgress || 0} className="h-2" />
              )}
              <Button onClick={onConfirmProcess} disabled={submitting}>
                {submitting ? (processingPhase === 'upload' && uploadProgress !== null ? `Uploading ${uploadProgress}%` : 'Processing...') : 'Confirm & Process'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete existing uploaded cases for selected shipment */}
      {selectedShipment && isLocked && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delete Uploaded Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Shipment {String(selectedShipment.id)} has production cases uploaded.</div>
              <Button variant="destructive" onClick={async () => {
                try {
                  setSubmitting(true);
                  const mapping: Record<string, string[]> = {};
                  mapping[String(selectedShipment.id)] = ['*'];
                  const res = await fetch('/api/production/process-cases', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shipments: mapping }),
                  });
                  if (!res.ok) throw new Error(`Server responded ${res.status}`);
                  const data = await res.json();
                  toast({ title: 'Deleted uploaded records', description: `Deleted ${data?.totalDeletes ?? 0} item(s)`, variant: 'default' });
                } catch (e: any) {
                  toast({ title: 'Delete failed', description: e?.message || 'Unknown error', variant: 'destructive' });
                } finally {
                  setSubmitting(false);
                }
              }} disabled={submitting} aria-label="Delete uploaded cases for shipment">Delete Uploaded Cases</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}