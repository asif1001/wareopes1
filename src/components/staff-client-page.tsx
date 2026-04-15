"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Trash2, Edit, Users, UserCheck, Clock, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import { storage } from "@/lib/firebase/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Branch } from "@/lib/types";
import { cn } from "@/lib/utils";

// Bahrain working days
const BH_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type ShiftTiming = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  workingDays: string[];
  notes?: string | null;
};

export type StaffMember = {
  id: string;
  type: 'Staff' | 'Contractor';
  // Staff fields
  fullName: string;
  cprNo?: string | null;
  contactNo?: string | null;
  cprExpiry?: string | null;
  visaExpiry?: string | null;
  contractorCompanyName?: string | null;
  assignedShiftId?: string | null;
  assignedShiftName?: string | null;
  // Contractor fields
  employeeId?: string | null;
  designation?: string | null;
  department?: string | null;
  branch?: string | null;
  email?: string | null;
  nationality?: string | null;
  companyName?: string | null;
  contactPersonName?: string | null;
  contactPersonPhone?: string | null;
  contactPersonEmail?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  ratePerHour?: number | null;
  currency?: string | null;
  // Common
  phone?: string | null;
  status: 'Active' | 'Inactive' | 'On Leave';
  notes?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

// ── helpers ─────────────────────────────────────────────────────────────────

async function uploadStaffImage(file: File, staffId: string): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const imgRef = ref(storage, `staff/${staffId}/images/${Date.now()}-${safeName}`);
  await uploadBytes(imgRef, file);
  return await getDownloadURL(imgRef);
}

function expiryBadge(dateStr?: string | null) {
  if (!dateStr) return <span className="text-muted-foreground text-xs">—</span>;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return <Badge variant="destructive">Expired</Badge>;
  if (diff <= 30) return <Badge variant="destructive">{diff}d</Badge>;
  if (diff <= 60) return <Badge variant="secondary">{diff}d</Badge>;
  return <span className="text-xs">{new Date(dateStr).toLocaleDateString()}</span>;
}

function statusBadge(status: string) {
  if (status === 'Active') return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Active</Badge>;
  if (status === 'Inactive') return <Badge variant="secondary">Inactive</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">On Leave</Badge>;
}

function Avatar({ s }: { s: StaffMember }) {
  const [broken, setBroken] = useState(false);
  if (s.imageUrl && !broken) {
    return <img src={s.imageUrl} alt={s.fullName} className="h-8 w-8 rounded-full object-cover" onError={() => setBroken(true)} />;
  }
  return (
    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
      {s.fullName?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ── Staff Form (separate, Bahrain-specific) ───────────────────────────────────

function StaffMemberForm({ member, shifts, branches, contractors, onSaved }: {
  member?: StaffMember; shifts: ShiftTiming[]; branches: Branch[]; contractors: StaffMember[]; onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<StaffMember>>(() => member ? { ...member } : { type: 'Staff', status: 'Active' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof StaffMember, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.fullName?.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('type', 'Staff');
      fd.append('fullName', form.fullName || '');
      fd.append('status', form.status || 'Active');
      if (form.cprNo) fd.append('cprNo', form.cprNo);
      if (form.contactNo) fd.append('contactNo', form.contactNo);
      if (form.cprExpiry) fd.append('cprExpiry', form.cprExpiry);
      if (form.visaExpiry) fd.append('visaExpiry', form.visaExpiry);
      if (form.contractorCompanyName) fd.append('contractorCompanyName', form.contractorCompanyName);
      if (form.designation) fd.append('designation', form.designation);
      if (form.department) fd.append('department', form.department);
      if (form.branch) fd.append('branch', form.branch);
      if (form.nationality) fd.append('nationality', form.nationality);
      if (form.assignedShiftId) fd.append('assignedShiftId', form.assignedShiftId);
      if (form.assignedShiftName) fd.append('assignedShiftName', form.assignedShiftName);
      if (form.notes) fd.append('notes', form.notes);
      if (imageFile) {
        try { const url = await uploadStaffImage(imageFile, member?.id || `tmp-${Date.now()}`); fd.append('imageUrl', url); }
        catch { /* skip */ }
      } else if (form.imageUrl?.startsWith('https://')) fd.append('imageUrl', form.imageUrl);
      const res = await fetch(member?.id ? `/api/staff/${member.id}` : '/api/staff', { method: member?.id ? 'PUT' : 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      toast({ title: member?.id ? 'Staff updated' : 'Staff added', description: form.fullName });
      onSaved?.();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 p-3 bg-muted/40 rounded-lg">
        <div className="relative">
          {(preview || form.imageUrl) ? (
            <img src={preview || form.imageUrl || ''} alt="Photo" className="h-16 w-16 rounded-full object-cover border-2 border-border" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary border-2 border-dashed border-border">
              {form.fullName?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Photo</Label>
          <Input type="file" accept="image/*" className="mt-1 text-sm" onChange={e => {
            const file = e.target.files?.[0] || null; setImageFile(file);
            if (file) { const r = new FileReader(); r.onload = () => setPreview(r.result as string); r.readAsDataURL(file); }
            else setPreview(null);
          }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Full Name" required><Input placeholder="John Doe" value={form.fullName || ''} onChange={e => set('fullName', e.target.value)} /></Field>
        <Field label="Status">
          <Select value={form.status || 'Active'} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="On Leave">On Leave</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="CPR No"><Input placeholder="e.g. 890101234" value={form.cprNo || ''} onChange={e => set('cprNo', e.target.value)} /></Field>
        <Field label="Contact No"><Input placeholder="e.g. +973 3300 0000" value={form.contactNo || ''} onChange={e => set('contactNo', e.target.value)} /></Field>
        <Field label="CPR Expiry"><Input type="date" value={(form.cprExpiry || '').split('T')[0]} onChange={e => set('cprExpiry', e.target.value)} /></Field>
        <Field label="Visa Expiry"><Input type="date" value={(form.visaExpiry || '').split('T')[0]} onChange={e => set('visaExpiry', e.target.value)} /></Field>
        <Field label="Contractor Company Name">
          {contractors.length > 0 ? (
            <Select
              value={form.contractorCompanyName || '__none__'}
              onValueChange={v => set('contractorCompanyName', v === '__none__' ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {Array.from(new Set(contractors.map(c => c.companyName).filter(Boolean))).sort().map(name => (
                  <SelectItem key={name!} value={name!}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input placeholder="No contractors added yet — type manually" value={form.contractorCompanyName || ''} onChange={e => set('contractorCompanyName', e.target.value)} />
          )}
        </Field>
        <Field label="Designation"><Input placeholder="e.g. Driver / Supervisor" value={form.designation || ''} onChange={e => set('designation', e.target.value)} /></Field>
        <Field label="Department"><Input placeholder="e.g. Logistics" value={form.department || ''} onChange={e => set('department', e.target.value)} /></Field>
        <Field label="Nationality"><Input placeholder="e.g. Bahraini / Indian" value={form.nationality || ''} onChange={e => set('nationality', e.target.value)} /></Field>
        <Field label="Branch">
          <Select value={form.branch || ''} onValueChange={v => set('branch', v)}>
            <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
            <SelectContent>
              {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Assigned Shift">
          <Select value={form.assignedShiftId || '__none__'} onValueChange={v => {
            const sh = shifts.find(s => s.id === v);
            set('assignedShiftId', v === '__none__' ? null : v);
            set('assignedShiftName', v === '__none__' ? null : (sh?.name || ''));
          }}>
            <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No shift</SelectItem>
              {shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="Notes"><Textarea placeholder="Any notes..." value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} /></Field>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t">
        <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : member?.id ? 'Update Staff' : 'Add Staff'}</Button>
      </div>
    </div>
  );
}

// ── Contractor Form ───────────────────────────────────────────────────────────

function ContractorForm({ member, branches, onSaved }: {
  member?: StaffMember; branches: Branch[]; onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<StaffMember>>(() => member ? { ...member } : { type: 'Contractor', status: 'Active' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof StaffMember, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.fullName?.trim()) { toast({ title: 'Contact person name is required', variant: 'destructive' }); return; }
    if (!form.companyName?.trim()) { toast({ title: 'Company name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('type', 'Contractor');
      fd.append('fullName', form.fullName || '');
      fd.append('status', form.status || 'Active');
      if (form.companyName) fd.append('companyName', form.companyName);
      if (form.contactPersonName) fd.append('contactPersonName', form.contactPersonName);
      if (form.contactPersonPhone) fd.append('contactPersonPhone', form.contactPersonPhone);
      if (form.contactPersonEmail) fd.append('contactPersonEmail', form.contactPersonEmail);
      if (form.employeeId) fd.append('employeeId', form.employeeId);
      if (form.designation) fd.append('designation', form.designation);
      if (form.department) fd.append('department', form.department);
      if (form.branch) fd.append('branch', form.branch);
      if (form.phone) fd.append('phone', form.phone);
      if (form.email) fd.append('email', form.email);
      if (form.nationality) fd.append('nationality', form.nationality);
      if (form.cprNo) fd.append('cprNo', form.cprNo);
      if (form.cprExpiry) fd.append('cprExpiry', form.cprExpiry);
      if (form.visaExpiry) fd.append('visaExpiry', form.visaExpiry);
      if (form.contractStartDate) fd.append('contractStartDate', form.contractStartDate);
      if (form.contractEndDate) fd.append('contractEndDate', form.contractEndDate);
      if (form.ratePerHour != null) fd.append('ratePerHour', String(form.ratePerHour));
      if (form.currency) fd.append('currency', form.currency);
      if (form.notes) fd.append('notes', form.notes);
      if (imageFile) {
        try { const url = await uploadStaffImage(imageFile, member?.id || `tmp-${Date.now()}`); fd.append('imageUrl', url); }
        catch { /* skip */ }
      } else if (form.imageUrl?.startsWith('https://')) fd.append('imageUrl', form.imageUrl);
      const res = await fetch(member?.id ? `/api/staff/${member.id}` : '/api/staff', { method: member?.id ? 'PUT' : 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      toast({ title: member?.id ? 'Contractor updated' : 'Contractor added', description: form.companyName });
      onSaved?.();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Building2 className="h-3 w-3" />Company Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Company Name" required><Input placeholder="e.g. ABC Contractors WLL" value={form.companyName || ''} onChange={e => set('companyName', e.target.value)} /></Field>
          </div>
          <Field label="Contract Start"><Input type="date" value={(form.contractStartDate || '').split('T')[0]} onChange={e => set('contractStartDate', e.target.value)} /></Field>
          <Field label="Contract End"><Input type="date" value={(form.contractEndDate || '').split('T')[0]} onChange={e => set('contractEndDate', e.target.value)} /></Field>
          <Field label="Branch">
            <Select value={form.branch || ''} onValueChange={v => set('branch', v)}>
              <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Department"><Input placeholder="e.g. Security / Cleaning" value={form.department || ''} onChange={e => set('department', e.target.value)} /></Field>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-3">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-1">
          <span className="text-base leading-none">＄</span> Billing Rate
          <span className="ml-1 text-blue-500 font-normal normal-case">(used for attendance billing calculation)</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rate per Hour">
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 3.500"
                className="pr-16"
                value={form.ratePerHour ?? ''}
                onChange={e => set('ratePerHour', e.target.value === '' ? null : parseFloat(e.target.value))}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                {form.currency || 'BHD'}/hr
              </span>
            </div>
          </Field>
          <Field label="Currency">
            <Select value={form.currency || 'BHD'} onValueChange={v => set('currency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BHD">BHD – Bahraini Dinar</SelectItem>
                <SelectItem value="USD">USD – US Dollar</SelectItem>
                <SelectItem value="SAR">SAR – Saudi Riyal</SelectItem>
                <SelectItem value="AED">AED – UAE Dirham</SelectItem>
                <SelectItem value="KWD">KWD – Kuwaiti Dinar</SelectItem>
                <SelectItem value="QAR">QAR – Qatari Riyal</SelectItem>
                <SelectItem value="OMR">OMR – Omani Rial</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        {form.ratePerHour != null && form.ratePerHour > 0 && (
          <p className="text-xs text-blue-600 bg-blue-100 rounded px-2 py-1">
            Daily (8h): <strong>{(form.ratePerHour * 8).toFixed(3)} {form.currency || 'BHD'}</strong>
            &nbsp;·&nbsp; Monthly (26d): <strong>{(form.ratePerHour * 8 * 26).toFixed(3)} {form.currency || 'BHD'}</strong>
          </p>
        )}
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Person</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact Person Name" required><Input placeholder="e.g. Ahmed Al-Farsi" value={form.fullName || ''} onChange={e => set('fullName', e.target.value)} /></Field>
          <Field label="Designation"><Input placeholder="e.g. Site Manager" value={form.designation || ''} onChange={e => set('designation', e.target.value)} /></Field>
          <Field label="Phone"><Input placeholder="e.g. +973 3300 0000" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></Field>
          <Field label="Email"><Input type="email" placeholder="e.g. ahmed@abc.com" value={form.email || ''} onChange={e => set('email', e.target.value)} /></Field>
        </div>
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Personal / ID Details</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nationality"><Input placeholder="e.g. Bahraini / Indian" value={form.nationality || ''} onChange={e => set('nationality', e.target.value)} /></Field>
          <Field label="Badge / Employee ID"><Input placeholder="e.g. CTR-001" value={form.employeeId || ''} onChange={e => set('employeeId', e.target.value)} /></Field>
          <Field label="CPR No"><Input placeholder="e.g. 890101234" value={form.cprNo || ''} onChange={e => set('cprNo', e.target.value)} /></Field>
          <Field label="CPR Expiry"><Input type="date" value={(form.cprExpiry || '').split('T')[0]} onChange={e => set('cprExpiry', e.target.value)} /></Field>
          <Field label="Visa Expiry"><Input type="date" value={(form.visaExpiry || '').split('T')[0]} onChange={e => set('visaExpiry', e.target.value)} /></Field>
          <Field label="Status">
            <Select value={form.status || 'Active'} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="col-span-2">
            <Field label="Photo">
              <div className="flex items-center gap-3">
                {(preview || form.imageUrl) && <img src={preview || form.imageUrl || ''} alt="" className="h-10 w-10 rounded-full object-cover border" />}
                <Input type="file" accept="image/*" className="text-sm" onChange={e => {
                  const file = e.target.files?.[0] || null; setImageFile(file);
                  if (file) { const r = new FileReader(); r.onload = () => setPreview(r.result as string); r.readAsDataURL(file); }
                  else setPreview(null);
                }} />
              </div>
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Notes"><Textarea placeholder="Any notes..." value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} /></Field>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t">
        <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving...' : member?.id ? 'Update Contractor' : 'Add Contractor'}</Button>
      </div>
    </div>
  );
}

// ── Shift Form ────────────────────────────────────────────────────────────────

function ShiftForm({ shift, onSaved, onCancel }: { shift?: ShiftTiming; onSaved: (s: ShiftTiming) => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(shift?.name || '');
  const [startTime, setStartTime] = useState(shift?.startTime || '08:00');
  const [endTime, setEndTime] = useState(shift?.endTime || '17:00');
  const [days, setDays] = useState<string[]>(shift?.workingDays || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']);
  const [notes, setNotes] = useState(shift?.notes || '');

  const toggle = (day: string) => setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  const save = () => {
    if (!name.trim()) { toast({ title: 'Shift name is required', variant: 'destructive' }); return; }
    if (days.length === 0) { toast({ title: 'Select at least one working day', variant: 'destructive' }); return; }
    onSaved({ id: shift?.id || `shift-${Date.now()}`, name: name.trim(), startTime, endTime, workingDays: days, notes: notes || null });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Shift Name" required><Input placeholder="e.g. Morning Shift / Night Shift" value={name} onChange={e => setName(e.target.value)} /></Field>
        </div>
        <Field label="Start Time"><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></Field>
        <Field label="End Time"><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></Field>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Working Days (Bahrain)</Label>
        <div className="grid grid-cols-4 gap-2">
          {BH_DAYS.map(day => (
            <label key={day} className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors select-none',
              days.includes(day) ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
            )}>
              <Checkbox
                checked={days.includes(day)}
                onCheckedChange={() => toggle(day)}
                className={days.includes(day) ? 'border-primary-foreground' : ''}
              />
              <span className="truncate">{day.slice(0, 3)}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Bahrain weekend: Friday & Saturday. Typical work week: Sun–Thu.
        </p>
      </div>

      <Field label="Notes (optional)"><Textarea placeholder="e.g. Overnight security shift" value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></Field>

      <div className="flex justify-end gap-2 pt-1 border-t">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={save}>{shift ? 'Update Shift' : 'Add Shift'}</Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function StaffClientPage({ initialStaff = [], initialBranches = [] }: { initialStaff?: StaffMember[]; initialBranches?: Branch[] }) {
  const { toast } = useToast();
  const { canAdd, canEdit, canDelete } = usePagePermissions('staff');
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [branches] = useState<Branch[]>(initialBranches);
  const [shifts, setShifts] = useState<ShiftTiming[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('staff');

  // dialog states
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [addContractorOpen, setAddContractorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shiftFormOpen, setShiftFormOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftTiming | null>(null);
  const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null);

  const refresh = () => fetch('/api/staff?limit=200').then(r => r.json()).then(d => { if (d.success) setStaff(d.items); }).catch(() => {});
  const refreshShifts = () => fetch('/api/shifts').then(r => r.json()).then(d => { if (d.success) setShifts(d.items); }).catch(() => {});

  useEffect(() => { refreshShifts(); }, []);

  const filtered = staff.filter(s => {
    const q = search.toLowerCase();
    const ms = !q || s.fullName?.toLowerCase().includes(q) || s.cprNo?.toLowerCase().includes(q) ||
      s.companyName?.toLowerCase().includes(q) || s.designation?.toLowerCase().includes(q) || s.contactPersonName?.toLowerCase().includes(q);
    return ms && (statusFilter === 'all' || s.status === statusFilter) && (branchFilter === 'all' || s.branch === branchFilter);
  });

  const staffList = filtered.filter(s => s.type === 'Staff');
  const contractorList = filtered.filter(s => s.type === 'Contractor');
  const editingMember = editingId ? staff.find(s => s.id === editingId) : undefined;
  const thirty = Date.now() + 30 * 86400000;

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setStaff(prev => prev.filter(s => s.id !== id));
      toast({ title: 'Record deleted' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
    } finally { setDeletingId(null); }
  };

  const handleShiftSaved = async (s: ShiftTiming) => {
    const isExisting = shifts.some(x => x.id === s.id);
    try {
      if (isExisting) {
        await fetch(`/api/shifts/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      } else {
        await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      }
      await refreshShifts();
    } catch { /* optimistic fallback */
      setShifts(prev => { const idx = prev.findIndex(x => x.id === s.id); return idx >= 0 ? prev.map((x, i) => i === idx ? s : x) : [...prev, s]; });
    }
    setShiftFormOpen(false);
    setEditingShift(null);
  };

  const handleShiftDelete = async (id: string) => {
    try {
      await fetch(`/api/shifts/${id}`, { method: 'DELETE' });
      await refreshShifts();
    } catch {
      setShifts(prev => prev.filter(x => x.id !== id));
    }
    setDeletingShiftId(null);
  };

  // Staff table
  const StaffTable = ({ rows }: { rows: StaffMember[] }) => (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Photo</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>CPR No</TableHead>
            <TableHead>Contact No</TableHead>
            <TableHead>CPR Expiry</TableHead>
            <TableHead>Visa Expiry</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Shift</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0
            ? <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-10">No staff records found.</TableCell></TableRow>
            : rows.map(s => (
              <TableRow key={s.id} className={s.status !== 'Active' ? 'bg-orange-50/60' : undefined}>
                <TableCell><Avatar s={s} /></TableCell>
                <TableCell className="font-medium">
                  <div>{s.fullName}</div>
                  {s.designation && <div className="text-xs text-muted-foreground">{s.designation}</div>}
                </TableCell>
                <TableCell className="font-mono text-sm">{s.cprNo || '—'}</TableCell>
                <TableCell>{s.contactNo || '—'}</TableCell>
                <TableCell>{expiryBadge(s.cprExpiry)}</TableCell>
                <TableCell>{expiryBadge(s.visaExpiry)}</TableCell>
                <TableCell>{s.contractorCompanyName || s.branch || '—'}</TableCell>
                <TableCell>
                  {s.assignedShiftName
                    ? <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">{s.assignedShiftName}</span>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>{statusBadge(s.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canEdit && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(s.id)}><Edit className="h-3.5 w-3.5" /></Button>}
                    {canDelete && <AlertDialog open={deletingId === s.id} onOpenChange={o => setDeletingId(o ? s.id : null)}>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete {s.fullName}?</AlertDialogTitle></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );

  // Contractor table
  const ContractorTable = ({ rows }: { rows: StaffMember[] }) => (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Photo</TableHead>
            <TableHead>Contact Person</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>CPR No</TableHead>
            <TableHead>CPR Expiry</TableHead>
            <TableHead>Visa Expiry</TableHead>
            <TableHead>Contract End</TableHead>
            <TableHead>Rate/hr</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0
            ? <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-10">No contractor records found.</TableCell></TableRow>
            : rows.map(s => (
              <TableRow key={s.id} className={s.status !== 'Active' ? 'bg-orange-50/60' : undefined}>
                <TableCell><Avatar s={s} /></TableCell>
                <TableCell className="font-medium">
                  <div>{s.fullName}</div>
                  {s.designation && <div className="text-xs text-muted-foreground">{s.designation}</div>}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{s.companyName || '—'}</div>
                  {s.branch && <div className="text-xs text-muted-foreground">{s.branch}</div>}
                </TableCell>
                <TableCell>{s.phone || '—'}</TableCell>
                <TableCell className="font-mono text-sm">{s.cprNo || '—'}</TableCell>
                <TableCell>{expiryBadge(s.cprExpiry)}</TableCell>
                <TableCell>{expiryBadge(s.visaExpiry)}</TableCell>
                <TableCell>{expiryBadge(s.contractEndDate)}</TableCell>
                <TableCell>
                  {s.ratePerHour != null
                    ? <span className="text-xs font-mono font-semibold text-blue-700">{s.ratePerHour.toFixed(3)} <span className="font-normal text-muted-foreground">{s.currency || 'BHD'}</span></span>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>{statusBadge(s.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canEdit && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(s.id)}><Edit className="h-3.5 w-3.5" /></Button>}
                    {canDelete && <AlertDialog open={deletingId === s.id} onOpenChange={o => setDeletingId(o ? s.id : null)}>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete {s.companyName || s.fullName}?</AlertDialogTitle></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Staff', value: staff.filter(s => s.type === 'Staff').length, color: '' },
          { label: 'Contractors', value: staff.filter(s => s.type === 'Contractor').length, color: '' },
          { label: 'Active', value: staff.filter(s => s.status === 'Active').length, color: 'text-green-600' },
          { label: 'CPR Expiring ≤30d', value: staff.filter(s => s.cprExpiry && new Date(s.cprExpiry).getTime() < thirty).length, color: 'text-destructive' },
          { label: 'Visa Expiring ≤30d', value: staff.filter(s => s.visaExpiry && new Date(s.visaExpiry).getTime() < thirty).length, color: 'text-orange-600' },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="pt-4 pb-3">
              <div className={cn('text-2xl font-bold', c.color)}>{c.value}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs + contextual toolbar ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>

        {/* tab bar + action buttons in one row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-9">
            <TabsTrigger value="staff" className="text-sm gap-1.5">
              <Users className="h-3.5 w-3.5" />Staff
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{staffList.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="contractors" className="text-sm gap-1.5">
              <Building2 className="h-3.5 w-3.5" />Contractors
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{contractorList.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="shifts" className="text-sm gap-1.5">
              <Clock className="h-3.5 w-3.5" />Shifts
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{shifts.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* contextual action button */}
          <div className="flex items-center gap-2">
            {activeTab === 'staff' && canAdd && (
              <Button size="sm" onClick={() => setAddStaffOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Add Staff
              </Button>
            )}
            {activeTab === 'contractors' && canAdd && (
              <Button size="sm" onClick={() => setAddContractorOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Add Contractor
              </Button>
            )}
            {activeTab === 'shifts' && (
              <Button size="sm" onClick={() => { setShiftFormOpen(true); setEditingShift(null); }}>
                <Plus className="h-4 w-4 mr-1" />Add Shift
              </Button>
            )}
          </div>
        </div>

        {/* ── Search / filter bar (hidden on shifts tab) ── */}
        {activeTab !== 'shifts' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={activeTab === 'staff' ? 'Search name, CPR, company…' : 'Search company, person, CPR…'}
                className="pl-8 h-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ── Tab content ── */}
        <TabsContent value="staff" className="mt-3">
          <StaffTable rows={staffList} />
        </TabsContent>

        <TabsContent value="contractors" className="mt-3">
          <ContractorTable rows={contractorList} />
        </TabsContent>

        <TabsContent value="shifts" className="mt-3">
          {shifts.length === 0 ? (
            <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No shifts defined yet</p>
              <p className="text-sm mt-1">Click <strong>Add Shift</strong> to create your first shift timing.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {shifts.map(s => (
                <Card key={s.id} className="relative hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-semibold">{s.name}</CardTitle>
                        <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="font-medium text-foreground">{s.startTime}</span>
                          <span>→</span>
                          <span className="font-medium text-foreground">{s.endTime}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingShift(s); setShiftFormOpen(true); }}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog open={deletingShiftId === s.id} onOpenChange={o => setDeletingShiftId(o ? s.id : null)}>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete "{s.name}"?</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleShiftDelete(s.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {BH_DAYS.map(d => (
                        <span key={d} className={cn(
                          'text-[11px] px-1.5 py-0.5 rounded border font-medium',
                          s.workingDays.includes(d)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'text-muted-foreground border-border bg-muted/40'
                        )}>{d.slice(0, 3)}</span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.workingDays.length} working day{s.workingDays.length !== 1 ? 's' : ''} per week
                    </p>
                    {s.notes && <p className="text-xs text-muted-foreground italic">{s.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Staff Dialog */}
      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Add Staff Member</DialogTitle></DialogHeader>
          <StaffMemberForm shifts={shifts} branches={branches} contractors={staff.filter(s => s.type === 'Contractor')} onSaved={() => { setAddStaffOpen(false); refresh(); }} />
        </DialogContent>
      </Dialog>

      {/* Add Contractor Dialog */}
      <Dialog open={addContractorOpen} onOpenChange={setAddContractorOpen}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" />Add Contractor</DialogTitle></DialogHeader>
          <ContractorForm branches={branches} onSaved={() => { setAddContractorOpen(false); refresh(); }} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog — auto-detects type */}
      <Dialog open={Boolean(editingId)} onOpenChange={o => { if (!o) setEditingId(null); }}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingMember?.type === 'Contractor' ? <><Building2 className="h-4 w-4" />Edit Contractor</> : <><Users className="h-4 w-4" />Edit Staff</>}
            </DialogTitle>
          </DialogHeader>
          {editingMember?.type === 'Contractor'
            ? <ContractorForm member={editingMember} branches={branches} onSaved={() => { setEditingId(null); refresh(); }} />
            : editingMember && <StaffMemberForm member={editingMember} shifts={shifts} branches={branches} contractors={staff.filter(s => s.type === 'Contractor')} onSaved={() => { setEditingId(null); refresh(); }} />}
        </DialogContent>
      </Dialog>

      {/* Shift Dialog */}
      <Dialog open={shiftFormOpen} onOpenChange={o => { if (!o) { setShiftFormOpen(false); setEditingShift(null); } }}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />{editingShift ? 'Edit Shift' : 'Add Shift Timing'}</DialogTitle></DialogHeader>
          <ShiftForm shift={editingShift || undefined} onSaved={handleShiftSaved} onCancel={() => { setShiftFormOpen(false); setEditingShift(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
