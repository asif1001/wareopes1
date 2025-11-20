"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import MaintenanceActionButton from "./MaintenanceActionButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ListFilter, Plus, Trash2, Edit, Wrench, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { User, Branch } from "@/lib/types";
import { getUsers, getBranches } from "@/lib/firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { storage } from "@/lib/firebase/firebase";
import { cn } from "@/lib/utils";
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from "firebase/storage";
import { useDropzone } from "react-dropzone";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

// Helper: derive Storage object path from a Firebase download URL
function storagePathFromDownloadUrl(url: string): string | null {
  try {
    // Typical: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path-encoded>?...
    const marker = "/o/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    const after = url.substring(idx + marker.length);
    const endIdx = after.indexOf("?");
    const encodedPath = endIdx === -1 ? after : after.substring(0, endIdx);
    const decodedPath = decodeURIComponent(encodedPath);
    return decodedPath || null;
  } catch {
    return null;
  }
}

type Vehicle = {
  id: string;
  plateNo?: string | null;
  vehicleType?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  branch: string;
  status?: "Active" | "Breakdown" | "Accident Repair" | "Replacement" | "Under Maintenance" | "Out of Service";
  ownership: "Owned" | "Hired";
  hireCompanyName?: string | null;
  driverName: string;
  driverEmployeeId?: string | null;
  driverContact?: string | null;
  lastOdometerReading?: number | null;
  nextServiceDueKm?: number | null;
  nextServiceDueDate?: string | null;
  insuranceExpiry?: string | null;
  registrationExpiry?: string | null;
  fuelType?: "Diesel" | "Petrol" | "Electric" | string | null;
  attachments?: string[];
  imageUrl?: string | null;
};

type VehicleMaintenanceRecord = {
  id: string;
  vehicleId: string;
  date: string;
  type: string;
  reportedBy?: string | null;
  workDescription: string;
  vendor?: string | null;
  cost?: number | null;
  invoiceNumber?: string | null;
  nextServiceDueKm?: number | null;
  nextServiceDueDate?: string | null;
  remarks?: string | null;
  attachmentUrl?: string | null;
};

type MheMaintenanceRecord = {
  id: string;
  mheId: string;
  date: string;
  type: string;
  reportedBy?: string | null;
  workDescription: string;
  vendor?: string | null;
  cost?: number | null;
  nextServiceDueDate?: string | null;
  remarks?: string | null;
  attachmentUrl?: string | null;
};

type Certification = {
  type: string;
  issueDate?: string | null;
  expiry?: string | null;
  vendor?: string | null;
  attachment?: string | null;
  certificateNo?: string | null;
};

type Battery = {
  type: string;
  voltage: string;
  size: string;
  serialNo?: string | null;
  installDate?: string | null;
  replacementDate?: string | null;
};

type Repair = {
  date?: string | null;
  cost?: number | null;
  remarks?: string | null;
};

type Mhe = {
  id: string;
  equipmentInfo: string;
  modelNo?: string | null;
  serialNo?: string | null;
  certification?: Certification;
  battery?: Battery;
  repairs?: Repair[];
  imageUrl?: string | null;
  status?: "Active" | "In Maintenance" | "Inactive";
};

type GatePass = {
  id: string;
  customerName: string;
  location: string;
  passNumber: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  attachment?: string | null;
  status?: "Active" | "Suspended" | "Expired";
  vehicleId?: string | null;
  driverName?: string | null;
};

type GatePassMaintenanceRecord = {
  id: string;
  gatePassId: string;
  date: string;
  type: string;
  detail: string;
  vendor?: string | null;
  cost?: number | null;
  remarks?: string | null;
  attachmentUrl?: string | null;
};

type DriverLicense = {
  id: string;
  driverId: string;
  vehicleType: string;
  licenseNumber: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  attachmentUrl?: string | null;
  attachments?: string[];
  remarks?: string | null;
};

function expiryStatus(expiry?: string | null) {
  if (!expiry) return { label: "Active", variant: "secondary" as const };
  const today = new Date();
  const exp = new Date(expiry);
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "Expired", variant: "destructive" as const };
  if (diffDays <= 60) return { label: "Expiring Soon", variant: "default" as const };
  return { label: "Active", variant: "secondary" as const };
}

function isWithin30Days(dateISO?: string | null) {
  if (!dateISO) return false;
  try {
    const now = new Date();
    const target = new Date(dateISO);
    const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 60;
  } catch { return false; }
}

function daysUntil(dateISO?: string | null): number | null {
  if (!dateISO) return null;
  try {
    const now = new Date();
    const target = new Date(dateISO);
    const diffMs = target.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch { return null; }
}

export function MaintenanceClientPage({ initialUsers, initialBranches, initialVehicles, initialMhes, initialGatePasses, initialLicenses }: { initialUsers?: User[]; initialBranches?: Branch[]; initialVehicles?: Vehicle[]; initialMhes?: Mhe[]; initialGatePasses?: GatePass[]; initialLicenses?: DriverLicense[] }) {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [ownershipFilter, setOwnershipFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Local state; wired to Firestore via API endpoints
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => initialVehicles || []);
  const [mhes, setMhes] = useState<Mhe[]>(() => initialMhes || []);
  const [gatePasses, setGatePasses] = useState<GatePass[]>(() => initialGatePasses || []);
  const [vehicleMaintenances, setVehicleMaintenances] = useState<VehicleMaintenanceRecord[]>([]);
  const [mheMaintenances, setMheMaintenances] = useState<MheMaintenanceRecord[]>([]);
  const [users, setUsers] = useState<User[]>(() => initialUsers || []);
  const [branches, setBranches] = useState<Branch[]>(() => initialBranches || []);
  // Dialog open states for Vehicle add/edit
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [maintenanceVehicleId, setMaintenanceVehicleId] = useState<string | null>(null);
  const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null);
  const [addMheOpen, setAddMheOpen] = useState(false);
  const [editingMheId, setEditingMheId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedMheId, setSelectedMheId] = useState<string | null>(null);
  const [selectedGatePassId, setSelectedGatePassId] = useState<string | null>(null);
  const [maintenanceMheId, setMaintenanceMheId] = useState<string | null>(null);
  const [deleteMheId, setDeleteMheId] = useState<string | null>(null);
  const [editingGatePassId, setEditingGatePassId] = useState<string | null>(null);
  const [maintenanceGatePassId, setMaintenanceGatePassId] = useState<string | null>(null);
  const [deleteGatePassId, setDeleteGatePassId] = useState<string | null>(null);
  const [gatePassMaintenances, setGatePassMaintenances] = useState<GatePassMaintenanceRecord[]>([]);
  const [addGatePassOpen, setAddGatePassOpen] = useState<boolean>(false);
  const [licenses, setLicenses] = useState<DriverLicense[]>(() => initialLicenses || []);
  const [addLicenseOpen, setAddLicenseOpen] = useState<boolean>(false);
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);
  const [deleteLicenseId, setDeleteLicenseId] = useState<string | null>(null);
  const [viewLicenseId, setViewLicenseId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string; type: string } | null>(null);

  // Load MHEs from Firestore
  useEffect(() => {
    // Data provided server-side to reduce reads
  }, []);

  // Load Gate Passes from Firestore
  useEffect(() => {
    // Data provided server-side to reduce reads
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/licenses?limit=50", { method: "GET" });
        if (!res.ok) throw new Error(`Failed to load Licenses: ${res.status}`);
        const data = await res.json();
        const list = (data?.items || []) as any[];
        const normalized = (list || []).map((l: any) => ({
          id: l.id,
          driverId: l.driverId,
          vehicleType: l.vehicleType || "",
          licenseNumber: l.licenseNumber || "",
          issueDate: l.issueDate ?? null,
          expiryDate: l.expiryDate ?? null,
          attachments: Array.isArray(l.attachments) ? (l.attachments as string[]) : (l.attachmentUrl ? [String(l.attachmentUrl)] : []),
          attachmentUrl: l.attachmentUrl ?? null,
          remarks: l.remarks ?? null,
        })) as DriverLicense[];
        if (active) setLicenses(normalized);
      } catch (e) {
        console.warn("Failed to fetch Licenses from Firestore", e);
      }
    })();
    return () => { active = false; };
  }, []);

  // Load Vehicle Maintenance records from Firestore
  useEffect(() => {
    // Load maintenance records on demand to reduce reads
  }, []);

  // Load MHE Maintenance records from Firestore
  useEffect(() => {
    // Load maintenance records on demand to reduce reads
  }, []);

  // Load vehicles from Firestore
  useEffect(() => {
    // Vehicles provided server-side; local filters apply without new reads
  }, [branchFilter, isAdmin, user?.branch]);

  // Event-driven only: remove periodic polling. Vehicles refresh is triggered by user actions (add/edit/delete) and filter changes.

  // Load users for driver selector from Firebase
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Skip client fetch if we already have server-provided users
        if (users.length > 0) return;
        const list = await getUsers();
        if (active) setUsers(list);
      } catch (e) {
        console.warn("Failed to fetch users", e);
      }
    })();
    return () => { active = false; };
  }, [users.length]);

  // Load branches for Branch Location selector
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Skip client fetch if we already have server-provided branches
        if (branches.length > 0) return;
        const list = await getBranches();
        if (active) setBranches(list);
      } catch (e) {
        console.warn("Failed to fetch branches", e);
      }
    })();
    return () => { active = false; };
  }, [branches.length]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const q = searchQuery.toLowerCase();
      const plate = (v.plateNo || "").toLowerCase();
      const type = (v.vehicleType || "").toLowerCase();
      const driver = (v.driverName || "").toLowerCase();
      const matches = plate.includes(q) || type.includes(q) || driver.includes(q);
      const matchesBranch = branchFilter === "all" || v.branch === branchFilter;
      const matchesOwnership = ownershipFilter === "all" || v.ownership === ownershipFilter;
      const ins = expiryStatus(v.insuranceExpiry);
      const reg = expiryStatus(v.registrationExpiry);
      const status = [ins.label, reg.label].includes("Expired") ? "expired" : ([ins.label, reg.label].includes("Expiring Soon") ? "soon" : "active");
      const matchesStatus = statusFilter === "all" || statusFilter === status;
      return matches && matchesBranch && matchesOwnership && matchesStatus;
    });
  }, [vehicles, searchQuery, branchFilter, ownershipFilter, statusFilter]);

  const expiringVehiclesCount = useMemo(() => {
    const days = (iso?: string | null): number | null => {
      if (!iso) return null;
      try {
        const now = new Date();
        const t = new Date(iso);
        return Math.ceil((t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      } catch { return null; }
    };
    const soon = (d: number | null) => d != null && d >= 0 && d <= 60;
    let count = 0;
    for (const v of vehicles) {
      const ins = days(v.insuranceExpiry ?? null);
      const reg = days(v.registrationExpiry ?? null);
      const svc = days(v.nextServiceDueDate ?? null);
      if (soon(ins) || soon(reg) || soon(svc)) count++;
    }
    return count;
  }, [vehicles]);

  const filteredMhes = useMemo(() => {
    return mhes.filter(m => {
      const q = searchQuery.toLowerCase();
      const matches = m.equipmentInfo.toLowerCase().includes(q);
      const certStatus = expiryStatus(m.certification?.expiry).label.toLowerCase();
      const normalized = certStatus === "expiring soon" ? "soon" : certStatus;
      const matchesStatus = statusFilter === "all" || statusFilter === normalized;
      return matches && matchesStatus;
    });
  }, [mhes, searchQuery, statusFilter]);

  const vehicleAlert = useMemo(() => {
    return vehicles.some(v => {
      const d1 = daysUntil(v.insuranceExpiry)
      const d2 = daysUntil(v.registrationExpiry)
      const d3 = daysUntil(v.nextServiceDueDate)
      return (d1 != null && d1 <= 60) || (d2 != null && d2 <= 60) || (d3 != null && d3 <= 60)
    })
  }, [vehicles])

  const mheAlert = useMemo(() => {
    return mhes.some(m => {
      const d = daysUntil(m.certification?.expiry)
      return d != null && d <= 60
    })
  }, [mhes])

  const filteredGatePasses = useMemo(() => {
    return gatePasses.filter(g => {
      const q = searchQuery.toLowerCase();
      const matches = g.customerName.toLowerCase().includes(q) || g.passNumber.toLowerCase().includes(q);
      const gpStatus = expiryStatus(g.expiryDate).label.toLowerCase();
      const normalized = gpStatus === "expiring soon" ? "soon" : gpStatus;
      const matchesStatus = statusFilter === "all" || statusFilter === normalized;
      return matches && matchesStatus;
    });
  }, [gatePasses, searchQuery, statusFilter]);

  const gatePassAlert = useMemo(() => {
    return gatePasses.some(g => {
      const d = daysUntil(g.expiryDate)
      return d != null && d <= 60
    })
  }, [gatePasses])

  const filteredLicenses = useMemo(() => {
    return licenses.filter(l => {
      const q = searchQuery.toLowerCase();
      const driver = (users.find(u => u.id === l.driverId)?.name || "").toLowerCase();
      const type = (l.vehicleType || "").toLowerCase();
      const num = (l.licenseNumber || "").toLowerCase();
      const matches = driver.includes(q) || type.includes(q) || num.includes(q);
      const licStatus = expiryStatus(l.expiryDate).label.toLowerCase();
      const normalized = licStatus === "expiring soon" ? "soon" : licStatus;
      const matchesStatus = statusFilter === "all" || statusFilter === normalized;
      return matches && matchesStatus;
    });
  }, [licenses, users, searchQuery, statusFilter]);

  const licenseAlert = useMemo(() => {
    return licenses.some(l => {
      const d = daysUntil(l.expiryDate)
      return d != null && d <= 60
    })
  }, [licenses])

  function VehicleForm({ onSaved, vehicle }: { onSaved?: () => void, vehicle?: Vehicle }) {
    const [form, setForm] = useState<Partial<Vehicle>>(() => vehicle ? { ...vehicle } : { ownership: "Owned", status: "Active" });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [uploadingImage, setUploadingImage] = useState<boolean>(false);
    const [uploadProgressImage, setUploadProgressImage] = useState<number>(0);
    const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
    const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<string[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    
    
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-10 bg-background border-b py-3">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={async () => {
              if (!form.plateNo || !form.vehicleType || !form.driverName || !form.branch || !form.ownership) {
                toast({ title: "Missing required fields", description: "Plate No, Vehicle Type, Driver, Branch, and Ownership are required." });
                return;
              }
              const doSave = async () => {
                if (vehicle) {
                  try {
                    const fd = new FormData();
                    fd.append('plateNo', form.plateNo || '');
                    fd.append('vehicleType', form.vehicleType || '');
                    if (form.make) fd.append('make', form.make);
                    if (form.model) fd.append('model', form.model);
                    if (form.year != null) fd.append('year', String(form.year));
                    fd.append('branch', form.branch || '');
                    fd.append('ownership', String(form.ownership || 'Owned'));
                    if (form.hireCompanyName) fd.append('hireCompanyName', form.hireCompanyName);
                    fd.append('driverName', form.driverName || '');
                    if (form.driverEmployeeId) fd.append('driverEmployeeId', form.driverEmployeeId);
                    if (form.driverContact) fd.append('driverContact', form.driverContact);
                    if (form.lastOdometerReading != null) fd.append('lastOdometerReading', String(form.lastOdometerReading));
                    if (form.nextServiceDueKm != null) fd.append('nextServiceDueKm', String(form.nextServiceDueKm));
                    if (form.nextServiceDueDate) fd.append('nextServiceDueDate', form.nextServiceDueDate);
                    if (form.insuranceExpiry) fd.append('insuranceExpiry', form.insuranceExpiry);
                    if (form.registrationExpiry) fd.append('registrationExpiry', form.registrationExpiry);
                    if (form.fuelType) fd.append('fuelType', String(form.fuelType as any));
                    if (form.status) fd.append('status', String(form.status as any));
                    if (imageFile) {
                      fd.append('image', imageFile, imageFile.name);
                    } else if (form.imageUrl) {
                      fd.append('existingImageUrl', form.imageUrl);
                    }
                    const res = await fetch(`/api/vehicles/${vehicle.id}`, { method: 'PUT', body: fd });
                    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
                    const data = await res.json();
                    const saved = (data?.item || { ...vehicle, ...form }) as Vehicle;
                    setVehicles(prev => prev.map(x => x.id === vehicle.id ? saved : x));
                    toast({ title: "Vehicle updated", description: `${saved.plateNo || saved.vehicleType} updated` });
                    onSaved?.();
                  } catch (e) {
                    console.warn("Failed to update vehicle via API", e);
                    toast({ title: "Update failed", description: "Could not persist changes. Check network/permissions.", variant: "destructive" });
                  }
                } else {
                  try {
                    const fd = new FormData();
                    fd.append('plateNo', form.plateNo || '');
                    fd.append('vehicleType', form.vehicleType || '');
                    if (form.make) fd.append('make', form.make);
                    if (form.model) fd.append('model', form.model);
                    if (form.year != null) fd.append('year', String(form.year));
                    fd.append('branch', form.branch || '');
                    fd.append('ownership', String(form.ownership || 'Owned'));
                    if (form.hireCompanyName) fd.append('hireCompanyName', form.hireCompanyName);
                    fd.append('driverName', form.driverName || '');
                    if (form.driverEmployeeId) fd.append('driverEmployeeId', form.driverEmployeeId);
                    if (form.driverContact) fd.append('driverContact', form.driverContact);
                    if (form.lastOdometerReading != null) fd.append('lastOdometerReading', String(form.lastOdometerReading));
                    if (form.nextServiceDueKm != null) fd.append('nextServiceDueKm', String(form.nextServiceDueKm));
                    if (form.nextServiceDueDate) fd.append('nextServiceDueDate', form.nextServiceDueDate);
                    if (form.insuranceExpiry) fd.append('insuranceExpiry', form.insuranceExpiry);
                    if (form.registrationExpiry) fd.append('registrationExpiry', form.registrationExpiry);
                    if (form.fuelType) fd.append('fuelType', String(form.fuelType as any));
                    if (form.status) fd.append('status', String(form.status as any));
                    const res = await fetch(`/api/vehicles`, { method: 'POST', body: fd });
                    let data: any = null;
                    try { data = await res.json(); } catch (_) { /* ignore parse errors */ }
                    if (!res.ok) {
                      const errMsg = (data && (data.error || data.message)) ? (data.error || data.message) : `Create failed: ${res.status}`;
                      throw new Error(errMsg);
                    }
                    const created = data?.item as Vehicle | undefined;
                    if (created) {
                      setVehicles(prev => [created, ...prev]);
                      toast({ title: "Vehicle saved", description: `${created.plateNo || created.vehicleType}` });
                      // Upload vehicle image with progress via server
                      if (imageFile) {
                        try {
                          setUploadingImage(true);
                          setUploadProgressImage(0);
                          const fdImg = new FormData();
                          fdImg.append('image', imageFile, imageFile.name);
                          const xhrImg = new XMLHttpRequest();
                          xhrImg.open('PUT', `/api/vehicles/${created.id}`);
                          xhrImg.upload.onprogress = (e) => {
                            if (e.lengthComputable) setUploadProgressImage((e.loaded / e.total) * 100);
                          };
                          xhrImg.onreadystatechange = () => {
                            if (xhrImg.readyState === 4) {
                              setUploadingImage(false);
                              try {
                                const ok = xhrImg.status >= 200 && xhrImg.status < 300;
                                if (ok) {
                                  const data2 = JSON.parse(xhrImg.responseText || '{}');
                                  const saved2 = (data2?.item || created) as Vehicle;
                                  setVehicles((prev) => prev.map((x) => (x.id === saved2.id ? saved2 : x)));
                                  setForm((f) => ({ ...f, imageUrl: saved2.imageUrl || f.imageUrl || null }));
                                }
                              } catch {}
                              setImageFile(null);
                            }
                          };
                          xhrImg.send(fdImg);
                        } catch {}
                      }
                      // Upload attachments with progress via server
                      if (attachmentFiles.length > 0) {
                        attachmentFiles.forEach((file) => {
                          setUploadingFiles((prev) => [...prev, file]);
                          setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));
                          const fdAtt = new FormData();
                          fdAtt.append('attachments', file);
                          const xhrAtt = new XMLHttpRequest();
                          xhrAtt.open('PUT', `/api/vehicles/${created.id}`);
                          xhrAtt.upload.onprogress = (e) => {
                            try {
                              if (e.lengthComputable) {
                                const pct = (e.loaded / e.total) * 100;
                                setUploadProgress((prev) => ({ ...prev, [file.name]: pct }));
                              }
                            } catch {}
                          };
                          xhrAtt.onreadystatechange = () => {
                            if (xhrAtt.readyState === 4) {
                              try {
                                const ok = xhrAtt.status >= 200 && xhrAtt.status < 300;
                                if (ok) {
                                  const data3 = JSON.parse(xhrAtt.responseText || '{}');
                                  const saved3 = (data3?.item || created) as Vehicle;
                                  setVehicles((prev) => prev.map((x) => (x.id === saved3.id ? saved3 : x)));
                                  setForm((f) => ({ ...f, attachments: Array.isArray((saved3 as any)?.attachments) ? (saved3 as any).attachments : (f.attachments || []) }));
                                }
                              } catch {}
                              setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
                            }
                          };
                          xhrAtt.send(fdAtt);
                        });
                      }
                      setForm({ ownership: "Owned", status: "Active" });
                      // Keep previews until uploads complete
                      onSaved?.();
                    }
                  } catch (e) {
                    console.warn("Failed to add vehicle via API", e);
                    toast({ title: "Save failed", description: (e as any)?.message || "Could not persist vehicle. Check network/permissions.", variant: "destructive" });
                  }
                }
              };
              doSave();
            }}>
              <Plus className="h-4 w-4 mr-2" /> Save Vehicle
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1"><Label htmlFor="plateNo">Vehicle ID / Plate No.<span className="text-destructive"> *</span></Label><Input id="plateNo" required placeholder="e.g. BH-12345" value={form.plateNo || ""} onChange={e => setForm(f => ({ ...f, plateNo: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="vehicleType">Vehicle Type<span className="text-destructive"> *</span></Label><Input id="vehicleType" required placeholder="Van / Truck / Pickup" value={form.vehicleType || ""} onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="make">Make</Label><Input id="make" placeholder="e.g. Toyota" value={form.make || ""} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="model">Model</Label><Input id="model" placeholder="e.g. Hilux" value={form.model || ""} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="year">Year</Label><Input id="year" type="number" placeholder="e.g. 2021" value={(form.year ?? '') as any} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, year: v === '' ? null : Number(v) })); }} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="branch">Branch Location<span className="text-destructive"> *</span></Label><Input id="branch" required placeholder="e.g. Salmabad" value={form.branch || ""} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="status">Status</Label><Input id="status" placeholder="Active / Under Maintenance / Out of Service" value={(form.status || "") as any} onChange={e => setForm(f => ({ ...f, status: (e.target.value as any) }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="ownership">Ownership Type<span className="text-destructive"> *</span></Label><Input id="ownership" required placeholder="Owned / Hired" value={(form.ownership || "") as any} onChange={e => setForm(f => ({ ...f, ownership: (e.target.value === "Hired" ? "Hired" : "Owned") }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="hireCompanyName">Hire Company Name</Label><Input id="hireCompanyName" placeholder="e.g. Al Ahlia" value={form.hireCompanyName || ""} onChange={e => setForm(f => ({ ...f, hireCompanyName: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="driverName">Assigned Driver<span className="text-destructive"> *</span></Label><Input id="driverName" required placeholder="Driver Name" value={form.driverName || ""} onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="driverEmployeeId">Driver Employee ID</Label><Input id="driverEmployeeId" placeholder="e.g. EMP-1001" value={form.driverEmployeeId || ""} onChange={e => setForm(f => ({ ...f, driverEmployeeId: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="driverContact">Driver Contact</Label><Input id="driverContact" placeholder="e.g. +973-xxx" value={form.driverContact || ""} onChange={e => setForm(f => ({ ...f, driverContact: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="odometer">Last Odometer Reading</Label><Input id="odometer" type="number" placeholder="e.g. 45210" value={(form.lastOdometerReading || 0) as any} onChange={e => setForm(f => ({ ...f, lastOdometerReading: Number(e.target.value || 0) }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="nextServiceKm">Next Service Due (Km)</Label><Input id="nextServiceKm" type="number" placeholder="e.g. 50000" value={(form.nextServiceDueKm || 0) as any} onChange={e => setForm(f => ({ ...f, nextServiceDueKm: Number(e.target.value || 0) }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="nextServiceDate">Next Service Due (Date)</Label><Input id="nextServiceDate" type="date" value={(form.nextServiceDueDate || "").split("T")[0]} onChange={e => setForm(f => ({ ...f, nextServiceDueDate: new Date(e.target.value).toISOString() }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="insuranceExpiry">Insurance Expiry</Label><Input id="insuranceExpiry" type="date" placeholder="Insurance Expiry" value={(form.insuranceExpiry || "").split("T")[0]} onChange={e => setForm(f => ({ ...f, insuranceExpiry: new Date(e.target.value).toISOString() }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="registrationExpiry">Registration Expiry</Label><Input id="registrationExpiry" type="date" placeholder="Registration Expiry" value={(form.registrationExpiry || "").split("T")[0]} onChange={e => setForm(f => ({ ...f, registrationExpiry: new Date(e.target.value).toISOString() }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="fuelType">Fuel Type</Label><Input id="fuelType" placeholder="Diesel / Petrol / Electric" value={(form.fuelType || "") as any} onChange={e => setForm(f => ({ ...f, fuelType: (e.target.value as any) }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="vehicleImage">Vehicle Image</Label><Input id="vehicleImage" type="file" accept="image/*" onChange={e => {
          const file = e.target.files?.[0] || null;
          setImageFile(file);
          if (file) {
            const url = URL.createObjectURL(file);
            setForm(f => ({ ...f, imageUrl: url }));
          } else {
            setForm(f => ({ ...f, imageUrl: null }));
          }
        }} /></div>
        {form.imageUrl && (
          <div className="md:col-span-2">
            <img src={form.imageUrl || ''} alt="Vehicle image preview" className="h-20 w-20 rounded object-cover" />
            {uploadingImage && <Progress value={uploadProgressImage} className="h-2 mt-2 w-40" />}
          </div>
        )}
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label htmlFor="attachments">Attachments</Label>
          <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50">
            <Input id="attachments" type="file" accept="image/*,.pdf" multiple onChange={e => { const files = Array.from(e.target.files || []); setAttachmentFiles(files); setAttachmentPreviewUrls(files.map(f => URL.createObjectURL(f))); }} />
          </div>
          {attachmentPreviewUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              {attachmentPreviewUrls.map((url, idx) => (
                (attachmentFiles[idx]?.type || '').startsWith('image/') ? (
                  <img key={idx} src={url} alt="Attachment preview" className="w-full h-32 rounded object-contain bg-muted" />
                ) : (
                  <iframe key={idx} src={url} title="Attachment preview" className="w-full h-32 rounded" />
                )
              ))}
            </div>
          )}
          {uploadingFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {uploadingFiles.map((file, i) => (
                <div key={`${file.name}-${i}`} className="flex items-center gap-3 p-2 border rounded">
                  <div className="flex-1">
                    <div className="text-xs font-medium truncate">{file.name}</div>
                    <Progress value={uploadProgress[file.name] || 0} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    );
  }

  function VehicleFormPro({ onSaved, vehicle }: { onSaved?: () => void, vehicle?: Vehicle }) {
    const [form, setForm] = useState<Partial<Vehicle>>(
      () => (vehicle ? { ...vehicle } : { ownership: "Owned", status: "Active" })
    );
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
    const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<string[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [uploadingImage, setUploadingImage] = useState<boolean>(false);
    const [uploadProgressImage, setUploadProgressImage] = useState<number>(0);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const DRAFT_KEY = 'vehicle_add_draft_v1';
    // Track selected driver by User ID, while storing employeeNo into form.driverEmployeeId
    const [selectedDriverId, setSelectedDriverId] = useState<string>("");
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
    const validAttachment = (file: File) => {
      const t = (file.type || '').toLowerCase();
      return t.startsWith('image/') || t === 'application/pdf' || t === 'application/octet-stream';
    };
    const validImage = (file: File) => (file.type || '').toLowerCase().startsWith('image/');

    useEffect(() => {
      if (!vehicle) {
        try {
          const raw = sessionStorage.getItem(DRAFT_KEY);
          if (raw) {
            const draft = JSON.parse(raw);
            setForm((f) => ({ ...f, ...(draft.form || {}) }));
            if (Array.isArray(draft.attachmentPreviewUrls)) setAttachmentPreviewUrls(draft.attachmentPreviewUrls);
            if (typeof draft.imageUrl === 'string') setForm((f) => ({ ...f, imageUrl: draft.imageUrl }));
          }
        } catch {}
      }
    }, [vehicle]);

    useEffect(() => {
      if (!vehicle) {
        try {
          const payload = {
            form: {
              plateNo: form.plateNo || '',
              vehicleType: form.vehicleType || '',
              make: form.make || '',
              model: form.model || '',
              year: form.year ?? null,
              branch: form.branch || '',
              ownership: form.ownership || 'Owned',
              driverName: form.driverName || '',
              driverEmployeeId: form.driverEmployeeId || '',
              imageUrl: form.imageUrl || null,
            },
            attachmentPreviewUrls,
            imageUrl: form.imageUrl || null,
          };
          sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        } catch {}
      }
    }, [vehicle, form, attachmentPreviewUrls]);

    useEffect(() => {
      const empNo = form.driverEmployeeId || vehicle?.driverEmployeeId || "";
      if (!empNo) { setSelectedDriverId(""); return; }
      const match = users.find(u => String(u.employeeNo) === String(empNo));
      setSelectedDriverId(match?.id || "");
    }, [users, form.driverEmployeeId, vehicle?.driverEmployeeId]);

    const startClientUpload = (file: File, targetId?: string) => {
      const id = targetId || vehicle?.id;
      if (!id) return;
      if (!validAttachment(file)) {
        toast({ title: 'Unsupported file', description: 'Only images or PDFs are allowed', variant: 'destructive' });
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast({ title: 'File too large', description: 'Attachment must be under 10 MB', variant: 'destructive' });
        return;
      }
      setUploadingFiles((prev) => [...prev, file]);
      setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `vehicles/${id}/attachments/${Date.now()}-${safeName}`;
        const storageRef = ref(storage, storagePath);
        const task = uploadBytesResumable(storageRef, file);
        task.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress((prev) => ({ ...prev, [file.name]: progress }));
          },
          async (error) => {
            console.error('Attachment upload failed', error);
            // Fallback: try server PUT for this file
            try {
              const fd = new FormData();
              fd.append('attachments', file);
              const res = await fetch(`/api/vehicles/${id}`, { method: 'PUT', body: fd });
              if (res.ok) {
                const data = await res.json().catch(() => ({}));
                const saved = (data?.item || vehicle) as Vehicle;
                setVehicles((prev) => prev.map((x) => (x.id === (saved?.id || id || x.id) ? saved : x)));
                setForm((f) => ({ ...f, attachments: Array.isArray((saved as any)?.attachments) ? (saved as any).attachments : (f.attachments || []) }));
              } else {
                toast({ title: 'Upload failed', description: 'Could not upload attachment. Please retry.', variant: 'destructive' });
              }
            } catch {
              toast({ title: 'Network error', description: 'Attachment upload failed. Check connection.', variant: 'destructive' });
            } finally {
              setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
            }
          },
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              const fd = new FormData();
              fd.append('attachmentsUrls', JSON.stringify([url]));
              const res = await fetch(`/api/vehicles/${id}`, { method: 'PUT', body: fd });
              let data: any = null;
              try { data = await res.json(); } catch {}
              if (res.ok) {
                const saved = (data?.item || vehicle) as Vehicle;
                setVehicles((prev) => prev.map((x) => (x.id === (saved?.id || id || x.id) ? saved : x)));
                setForm((f) => ({ ...f, attachments: Array.isArray((saved as any)?.attachments) ? (saved as any).attachments : ((f.attachments || []).concat([url])) }));
              }
            } finally {
              setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
            }
          }
        );
      } catch (e) {
        console.warn('Failed to start client upload', e);
      }
    };

    const onDrop = (files: File[]) => {
      if (!files || files.length === 0) return;
      const valid = files.filter((f) => validAttachment(f) && f.size <= MAX_ATTACHMENT_BYTES);
      const invalid = files.filter((f) => !validAttachment(f) || f.size > MAX_ATTACHMENT_BYTES);
      if (invalid.length) {
        toast({ title: 'Some files were skipped', description: 'Only images/PDF under 10 MB are allowed', variant: 'destructive' });
      }
      setAttachmentFiles(valid);
      setAttachmentPreviewUrls(valid.map((f) => URL.createObjectURL(f)));
      valid.forEach((f) => startClientUpload(f));
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true, accept: { "image/*": [], "application/pdf": [".pdf"] } });

    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-10 bg-background border-b py-3">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (!form.plateNo || !form.vehicleType || !form.driverName || !form.branch || !form.ownership) {
                  toast({
                    title: "Missing required fields",
                    description:
                      "Plate No, Vehicle Type, Driver, Branch, and Ownership are required.",
                  });
                  return;
                }
                if (imageFile) {
                  if (!validImage(imageFile)) { toast({ title: 'Invalid image', description: 'Please select a valid image file', variant: 'destructive' }); return; }
                  if (imageFile.size > MAX_IMAGE_BYTES) { toast({ title: 'Image too large', description: 'Image must be under 5 MB', variant: 'destructive' }); return; }
                }
                const doSave = async () => {
                  setIsSaving(true);
                  if (vehicle) {
                    try {
                      const fd = new FormData();
                      fd.append('plateNo', form.plateNo || '');
                      fd.append('vehicleType', form.vehicleType || '');
                      if (form.make) fd.append('make', form.make);
                      if (form.model) fd.append('model', form.model);
                      if (form.year != null) fd.append('year', String(form.year));
                      fd.append('branch', form.branch || '');
                      fd.append('ownership', String(form.ownership || 'Owned'));
                      if (form.hireCompanyName) fd.append('hireCompanyName', form.hireCompanyName);
                      fd.append('driverName', form.driverName || '');
                      if (form.driverEmployeeId) fd.append('driverEmployeeId', form.driverEmployeeId);
                      if (form.driverContact) fd.append('driverContact', form.driverContact);
                      if (form.lastOdometerReading != null) fd.append('lastOdometerReading', String(form.lastOdometerReading));
                      if (form.nextServiceDueKm != null) fd.append('nextServiceDueKm', String(form.nextServiceDueKm));
                      if (form.nextServiceDueDate) fd.append('nextServiceDueDate', form.nextServiceDueDate);
                      if (form.insuranceExpiry) fd.append('insuranceExpiry', form.insuranceExpiry);
                      if (form.registrationExpiry) fd.append('registrationExpiry', form.registrationExpiry);
                      if (form.fuelType) fd.append('fuelType', String(form.fuelType as any));
                      if (form.status) fd.append('status', String(form.status as any));
                      if (imageFile) {
                        fd.append('image', imageFile, imageFile.name);
                      } else if (form.imageUrl) {
                        fd.append('existingImageUrl', form.imageUrl);
                      }
                      
                      const res = await fetch(`/api/vehicles/${vehicle.id}`, { method: 'PUT', body: fd });
                      let data: any = null;
                      try { data = await res.json(); } catch (_) { /* ignore parse errors */ }
                      if (!res.ok) {
                        const errMsg = (data && (data.error || data.message)) ? (data.error || data.message) : `Update failed: ${res.status}`;
                        throw new Error(errMsg);
                      }
                      const saved = (data?.item || { ...vehicle, ...form }) as Vehicle;
                      setVehicles((prev) => prev.map((x) => (x.id === vehicle.id ? saved : x)));
                      setForm(f => ({ ...f, attachments: Array.isArray((saved as any).attachments) ? (saved as any).attachments : (f.attachments || []) }));
                      setAttachmentPreviewUrls([]);
                      toast({ title: "Vehicle updated", description: `${saved.plateNo || saved.vehicleType} updated` });
                      onSaved?.();
                    } catch (e) {
                      console.warn("Failed to update vehicle via API", e);
                      toast({ title: "Update failed", description: (e as any)?.message || "Could not persist changes. Check network/permissions.", variant: "destructive" });
                    } finally {
                      setIsSaving(false);
                    }
                  } else {
                    try {
                      const fd = new FormData();
                      fd.append('plateNo', form.plateNo || '');
                      fd.append('vehicleType', form.vehicleType || '');
                      if (form.make) fd.append('make', form.make);
                      if (form.model) fd.append('model', form.model);
                      if (form.year != null) fd.append('year', String(form.year));
                      fd.append('branch', form.branch || '');
                      fd.append('ownership', String(form.ownership || 'Owned'));
                      if (form.hireCompanyName) fd.append('hireCompanyName', form.hireCompanyName);
                      fd.append('driverName', form.driverName || '');
                      if (form.driverEmployeeId) fd.append('driverEmployeeId', form.driverEmployeeId);
                      if (form.driverContact) fd.append('driverContact', form.driverContact);
                      if (form.lastOdometerReading != null) fd.append('lastOdometerReading', String(form.lastOdometerReading));
                      if (form.nextServiceDueKm != null) fd.append('nextServiceDueKm', String(form.nextServiceDueKm));
                      if (form.nextServiceDueDate) fd.append('nextServiceDueDate', form.nextServiceDueDate);
                      if (form.insuranceExpiry) fd.append('insuranceExpiry', form.insuranceExpiry);
                      if (form.registrationExpiry) fd.append('registrationExpiry', form.registrationExpiry);
                      if (form.fuelType) fd.append('fuelType', String(form.fuelType as any));
                      if (form.status) fd.append('status', String(form.status as any));
                      
                      // Include image and attachments in initial create so persistence works even if client Storage is restricted
                      if (imageFile) fd.append('image', imageFile, imageFile.name);
                      for (const f of attachmentFiles) fd.append('attachments', f);
                      const res = await fetch(`/api/vehicles`, { method: 'POST', body: fd });
                      let data: any = null;
                      try { data = await res.json(); } catch (_) { /* ignore parse errors */ }
                      if (!res.ok) {
                        const errMsg = (data && (data.error || data.message)) ? (data.error || data.message) : `Create failed: ${res.status}`;
                        throw new Error(errMsg);
                      }
                      const created = data?.item as Vehicle | undefined;
                      if (created) {
                        setVehicles((prev) => [created, ...prev]);
                        toast({ title: "Vehicle saved", description: `${created.plateNo || created.vehicleType}` });
                        try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
                      // Upload image with client SDK only if not already sent in POST
                      if (imageFile && !(created.imageUrl)) {
                        try {
                          setUploadingImage(true);
                          setUploadProgressImage(0);
                          const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                          const storagePath = `vehicles/${created.id}/images/${Date.now()}-${safeName}`;
                          const imgRef = ref(storage, storagePath);
                          const task = uploadBytesResumable(imgRef, imageFile);
                          task.on(
                            'state_changed',
                            (snapshot) => {
                              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                              setUploadProgressImage(progress);
                            },
                            (error) => {
                              console.error('Image upload failed', error);
                              setUploadingImage(false);
                            },
                            async () => {
                              try {
                                const url = await getDownloadURL(task.snapshot.ref);
                                const fdImg = new FormData();
                                fdImg.append('existingImageUrl', url);
                                const res2 = await fetch(`/api/vehicles/${created.id}`, { method: 'PUT', body: fdImg });
                                let data2: any = null;
                                try { data2 = await res2.json(); } catch {}
                                if (res2.ok) {
                                  const saved2 = (data2?.item || created) as Vehicle;
                                  setVehicles((prev) => prev.map((x) => (x.id === saved2.id ? saved2 : x)));
                                  setForm((f) => ({ ...f, imageUrl: saved2.imageUrl || f.imageUrl || null }));
                                }
                              } finally {
                                setUploadingImage(false);
                                setImageFile(null);
                              }
                            }
                          );
                        } catch {}
                      }
                      // Upload attachments with progress only if not already sent in POST
                      if (attachmentFiles.length > 0 && !(Array.isArray(created.attachments) && created.attachments.length >= attachmentFiles.length)) {
                        attachmentFiles.forEach((f) => startClientUpload(f, created.id));
                      }
                        onSaved?.();
                      }
                    } catch (e) {
                      console.warn("Failed to add vehicle via API", e);
                      toast({ title: "Save failed", description: (e as any)?.message || "Could not persist vehicle. Check network/permissions.", variant: "destructive" });
                    } finally {
                      setIsSaving(false);
                    }
                  }
                };
                doSave();
              }}
              disabled={isSaving}
            >
              <Plus className="h-4 w-4 mr-2" /> Save Vehicle
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Details</CardTitle>
                <CardDescription>Identification and specifications.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="plateNo">Vehicle ID / Plate No.<span className="text-destructive"> *</span></Label>
                    <Input
                      id="plateNo"
                      required
                      placeholder="e.g. BH-12345"
                      value={form.plateNo || ""}
                      onChange={(e) => setForm((f) => ({ ...f, plateNo: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="vehicleType">Vehicle Type<span className="text-destructive"> *</span></Label>
                    <Input
                      id="vehicleType"
                      required
                      placeholder="Van / Truck / Pickup"
                      value={form.vehicleType || ""}
                      onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="make">Make</Label>
                    <Input
                      id="make"
                      placeholder="e.g. Toyota"
                      value={form.make || ""}
                      onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      placeholder="e.g. Hilux"
                      value={form.model || ""}
                      onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      type="number"
                      placeholder="e.g. 2021"
                      value={(form.year || 0) as any}
                      onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value || 0) }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="fuelType">Fuel Type</Label>
                    <Input
                      id="fuelType"
                      placeholder="Diesel / Petrol / Electric"
                      value={(form.fuelType || "") as any}
                      onChange={(e) => setForm((f) => ({ ...f, fuelType: e.target.value as any }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <Label htmlFor="vehicleImage">Vehicle Image</Label>
                    <Input
                      id="vehicleImage"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setImageFile(file);
                        if (file) {
                          const url = URL.createObjectURL(file);
                          setForm((f) => ({ ...f, imageUrl: url }));
                        } else {
                          setForm((f) => ({ ...f, imageUrl: null }));
                        }
                      }}
                    />
                    <div className="text-xs text-muted-foreground mt-1">{imageFile?.name || 'No file chosen'}</div>
                  </div>
                  {form.imageUrl && (
                    <div className="md:col-span-2">
                      <img
                        src={form.imageUrl}
                        alt="Vehicle image preview"
                        className="h-20 w-20 rounded object-cover"
                      />
                      {uploadingImage && <Progress value={uploadProgressImage} className="h-2 mt-2 w-40" />}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Service & Odometer</CardTitle>
                <CardDescription>Track last reading and next service.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="odometer">Last Odometer Reading</Label>
                    <Input
                      id="odometer"
                      type="number"
                      placeholder="e.g. 45210"
                      value={(form.lastOdometerReading || 0) as any}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lastOdometerReading: Number(e.target.value || 0) }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="nextServiceKm">Next Service (Km)</Label>
                    <Input
                      id="nextServiceKm"
                      type="number"
                      placeholder="e.g. 50000"
                      value={(form.nextServiceDueKm || 0) as any}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, nextServiceDueKm: Number(e.target.value || 0) }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="nextServiceDate">Next Service (Date)</Label>
                    <Input
                      id="nextServiceDate"
                      type="date"
                      value={(form.nextServiceDueDate || "").split("T")[0]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, nextServiceDueDate: new Date(e.target.value).toISOString() }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documents & Expiry</CardTitle>
                <CardDescription>Insurance, registration, and attachments.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="insuranceExpiry">Insurance Expiry</Label>
                    <Input
                      id="insuranceExpiry"
                      type="date"
                      value={(form.insuranceExpiry || "").split("T")[0]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, insuranceExpiry: new Date(e.target.value).toISOString() }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="registrationExpiry">Registration Expiry</Label>
                    <Input
                      id="registrationExpiry"
                      type="date"
                      value={(form.registrationExpiry || "").split("T")[0]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, registrationExpiry: new Date(e.target.value).toISOString() }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1 md:col-span-3">
                    <Label htmlFor="attachments">Attachments</Label>
                    <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isDragActive ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}>
                      <input {...getInputProps()} id="attachments" />
                      <div className="text-sm text-muted-foreground">Drag & drop files here, or click to select</div>
                    </div>
                    <Input id="attachments_fallback" type="file" accept="image/*,.pdf" multiple onChange={e => { const files = Array.from(e.target.files || []); onDrop(files); }} className="mt-2" />
                    {attachmentPreviewUrls.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {attachmentPreviewUrls.map((url, idx) => (
                          (attachmentFiles[idx]?.type || '').startsWith('image/') ? (
                            <img key={idx} src={url} alt="Attachment preview" className="w-full h-32 rounded object-contain bg-muted" />
                          ) : (
                            <iframe key={idx} src={url} title="Attachment preview" className="w-full h-32 rounded" />
                          )
                        ))}
                      </div>
                    )}
                    {uploadingFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {uploadingFiles.map((file, i) => (
                          <div key={`${file.name}-${i}`} className="flex items-center gap-3 p-2 border rounded">
                            <div className="flex-1">
                              <div className="text-xs font-medium truncate">{file.name}</div>
                              <Progress value={uploadProgress[file.name] || 0} className="h-2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(form.attachments) && form.attachments.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(form.attachments || []).map((url, idx) => (
                          String(url).toLowerCase().endsWith('.pdf') ? (
                            <div key={idx} className="space-y-2">
                              <iframe src={String(url)} title="Attachment" className="w-full h-32 rounded" />
                              <div className="flex items-center justify-between">
                                <a href={String(url)} download className="text-xs underline">Download</a>
                                <Button variant="ghost" size="sm" onClick={async () => {
                                  try {
                                    const fd = new FormData();
                                    fd.append('removeAttachmentsUrls', JSON.stringify([String(url)]));
                                    const res = await fetch(`/api/vehicles/${vehicle?.id || ''}`, { method: 'PUT', body: fd });
                                    if (res.ok) {
                                      setForm(f => ({ ...f, attachments: (f.attachments || []).filter(u => u !== url) }));
                                      setVehicles(prev => prev.map(x => x.id === (vehicle?.id || x.id) ? { ...x, attachments: (x.attachments || []).filter(u => u !== url) } : x));
                                    }
                                  } catch {}
                                }}>Remove</Button>
                              </div>
                            </div>
                          ) : (
                            <div key={idx} className="space-y-2">
                              <img src={String(url)} alt="Attachment" className="w-full h-32 rounded object-contain bg-muted" />
                              <div className="flex items-center justify-between">
                                <a href={String(url)} download className="text-xs underline">Download</a>
                                <Button variant="ghost" size="sm" onClick={async () => {
                                  try {
                                    const fd = new FormData();
                                    fd.append('removeAttachmentsUrls', JSON.stringify([String(url)]));
                                    const res = await fetch(`/api/vehicles/${vehicle?.id || ''}`, { method: 'PUT', body: fd });
                                    if (res.ok) {
                                      setForm(f => ({ ...f, attachments: (f.attachments || []).filter(u => u !== url) }));
                                      setVehicles(prev => prev.map(x => x.id === (vehicle?.id || x.id) ? { ...x, attachments: (x.attachments || []).filter(u => u !== url) } : x));
                                    }
                                  } catch {}
                                }}>Remove</Button>
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assignment & Ownership</CardTitle>
                <CardDescription>Branch, driver, and ownership details.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="branch">Branch Location<span className="text-destructive"> *</span></Label>
                    <Select value={form.branch || ""} onValueChange={(val) => setForm((f) => ({ ...f, branch: val }))}>
                      <SelectTrigger id="branch" className="w-full">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.name}>{b.name}{b.code ? ` (${b.code})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="status">Status</Label>
                    <Select value={(form.status || "") as any} onValueChange={(val) => setForm((f) => ({ ...f, status: val as any }))}>
                      <SelectTrigger id="status" className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Breakdown">Breakdown</SelectItem>
                        <SelectItem value="Accident Repair">Accident Repair</SelectItem>
                        <SelectItem value="Replacement">Replacement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="ownership">Ownership Type<span className="text-destructive"> *</span></Label>
                    <Select value={(form.ownership || "") as any} onValueChange={(val) => setForm((f) => ({ ...f, ownership: (val === "Hired" ? "Hired" : "Owned") }))}>
                      <SelectTrigger id="ownership" className="w-full">
                        <SelectValue placeholder="Select ownership" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Owned">Owned</SelectItem>
                        <SelectItem value="Hired">On Hire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="hireCompanyName">Hire Company Name</Label>
                    <Input
                      id="hireCompanyName"
                      placeholder="e.g. Al Ahlia"
                      value={form.hireCompanyName || ""}
                      onChange={(e) => setForm((f) => ({ ...f, hireCompanyName: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="driverName">Assigned Driver<span className="text-destructive"> *</span></Label>
                    <Select value={selectedDriverId} onValueChange={(val) => {
                      const u = users.find((x) => x.id === val);
                      setSelectedDriverId(val);
                      setForm((f) => ({
                        ...f,
                        driverEmployeeId: (u?.employeeNo ? String(u.employeeNo) : ""),
                        driverName: u?.fullName || u?.name || f.driverName || "",
                      }));
                    }}>
                      <SelectTrigger id="driverName" className="w-full">
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName || u.name || u.email || u.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="driverEmployeeId">Driver Employee ID</Label>
                    <Input
                      id="driverEmployeeId"
                      value={form.driverEmployeeId || ""}
                      placeholder="Auto-filled from Assigned Driver"
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="driverContact">Driver Contact</Label>
                    <Input
                      id="driverContact"
                      placeholder="e.g. +973-xxx"
                      value={form.driverContact || ""}
                      onChange={(e) => setForm((f) => ({ ...f, driverContact: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }


  function VehicleMaintenanceForm({ onSaved, vehicleId, record }: { onSaved?: () => void, vehicleId?: string, record?: VehicleMaintenanceRecord }) {
    const [form, setForm] = useState<Partial<VehicleMaintenanceRecord>>(() => {
      if (record) {
        return { ...record };
      }
      return { date: new Date().toISOString(), vehicleId };
    });
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => record?.vehicleId || vehicleId || "");
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const isEdit = !!record;
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-10 bg-background border-b py-3">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={async () => {
              if (!form.vehicleId || !form.date || !form.type || !form.workDescription) {
                toast({ title: "Missing required fields", description: "Vehicle, Date, Type, and Work Description are required." });
                return;
              }
              if (isEdit && record) {
                const updated: VehicleMaintenanceRecord = {
                  id: record.id,
                  vehicleId: form.vehicleId!,
                  date: form.date!,
                  type: form.type!,
                  reportedBy: form.reportedBy || null,
                  workDescription: form.workDescription!,
                  vendor: form.vendor || null,
                  cost: form.cost || null,
                  invoiceNumber: form.invoiceNumber || null,
                  nextServiceDueKm: form.nextServiceDueKm || null,
                  nextServiceDueDate: form.nextServiceDueDate || null,
                  remarks: form.remarks || null,
                  attachmentUrl: form.attachmentUrl || null,
                };
                setVehicleMaintenances(prev => prev.map(r => r.id === record.id ? updated : r));
                // Persist vehicle's next service fields when provided
                try {
                  const fd = new FormData();
                  if (updated.nextServiceDueKm != null) fd.append('nextServiceDueKm', String(updated.nextServiceDueKm));
                  if (updated.nextServiceDueDate) fd.append('nextServiceDueDate', String(updated.nextServiceDueDate));
                  if (fd.has('nextServiceDueKm') || fd.has('nextServiceDueDate')) {
                    const res = await fetch(`/api/vehicles/${updated.vehicleId}`, { method: 'PUT', body: fd });
                    if (res.ok) {
                      const data = await res.json();
                      const item = data?.item as any;
                      setVehicles(prev => prev.map(x => x.id === updated.vehicleId ? { ...x, nextServiceDueKm: item?.nextServiceDueKm ?? updated.nextServiceDueKm ?? null, nextServiceDueDate: item?.nextServiceDueDate ?? updated.nextServiceDueDate ?? null } : x));
                    }
                  }
                } catch {}
                const v = vehicles.find(v => v.id === updated.vehicleId);
                toast({ title: "Maintenance updated", description: `${v?.plateNo || v?.vehicleType || updated.vehicleId} • ${updated.type}` });
                onSaved?.();
              } else {
                (async () => {
                  try {
                    const fd = new FormData();
                    fd.append('vehicleId', String(form.vehicleId || ''));
                    fd.append('date', String(form.date || ''));
                    fd.append('type', String(form.type || ''));
                    if (form.reportedBy) fd.append('reportedBy', String(form.reportedBy));
                    fd.append('workDescription', String(form.workDescription || ''));
                    if (form.vendor) fd.append('vendor', String(form.vendor));
                    if (form.cost != null) fd.append('cost', String(form.cost));
                    if (form.invoiceNumber) fd.append('invoiceNumber', String(form.invoiceNumber));
                    if (form.nextServiceDueKm != null) fd.append('nextServiceDueKm', String(form.nextServiceDueKm));
                    if (form.nextServiceDueDate) fd.append('nextServiceDueDate', String(form.nextServiceDueDate));
                    if (form.remarks) fd.append('remarks', String(form.remarks));
                    if (attachmentFile) fd.append('attachment', attachmentFile);
                    const res = await fetch('/api/vehicle-maintenance', { method: 'POST', body: fd });
                    if (!res.ok) throw new Error(`Failed to save maintenance: ${res.status}`);
                    const data = await res.json();
                    const saved = data?.item as any;
                    const rec: VehicleMaintenanceRecord = {
                      id: saved.id,
                      vehicleId: saved.vehicleId,
                      date: saved.date,
                      type: saved.type,
                      reportedBy: saved.reportedBy ?? null,
                      workDescription: saved.workDescription,
                      vendor: saved.vendor ?? null,
                      cost: saved.cost ?? null,
                      invoiceNumber: saved.invoiceNumber ?? null,
                      nextServiceDueKm: saved.nextServiceDueKm ?? null,
                      nextServiceDueDate: saved.nextServiceDueDate ?? null,
                      remarks: saved.remarks ?? null,
                      attachmentUrl: saved.attachmentUrl ?? null,
                    };
                    setVehicleMaintenances(prev => [rec, ...prev]);
                    // Persist vehicle's next service fields when provided
                    try {
                      const fd2 = new FormData();
                      if (rec.nextServiceDueKm != null) fd2.append('nextServiceDueKm', String(rec.nextServiceDueKm));
                      if (rec.nextServiceDueDate) fd2.append('nextServiceDueDate', String(rec.nextServiceDueDate));
                      if (fd2.has('nextServiceDueKm') || fd2.has('nextServiceDueDate')) {
                        const res2 = await fetch(`/api/vehicles/${rec.vehicleId}`, { method: 'PUT', body: fd2 });
                        if (res2.ok) {
                          const data2 = await res2.json();
                          const item2 = data2?.item as any;
                          setVehicles(prev => prev.map(x => x.id === rec.vehicleId ? { ...x, nextServiceDueKm: item2?.nextServiceDueKm ?? rec.nextServiceDueKm ?? null, nextServiceDueDate: item2?.nextServiceDueDate ?? rec.nextServiceDueDate ?? null } : x));
                        }
                      }
                    } catch {}
                    const v = vehicles.find(v => v.id === rec.vehicleId);
                    toast({ title: 'Maintenance saved', description: `${v?.plateNo || v?.vehicleType || rec.vehicleId} • ${rec.type}` });
                    onSaved?.();
                  } catch (e: any) {
                    console.warn(e);
                    toast({ title: 'Save failed', description: e?.message || 'Could not save maintenance.', variant: 'destructive' as any });
                  }
                })();
              }
            }}>
              <Plus className="h-4 w-4 mr-2" /> {isEdit ? "Update Maintenance" : "Save Maintenance"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label htmlFor="vm-vehicle">Vehicle<span className="text-destructive"> *</span></Label>
          <Select value={selectedVehicleId} onValueChange={(val) => { setSelectedVehicleId(val); setForm(f => ({ ...f, vehicleId: val })); }}>
            <SelectTrigger id="vm-vehicle" className="w-full">
              <SelectValue placeholder="Select vehicle" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.plateNo || v.vehicleType || v.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1"><Label htmlFor="vm-date">Date<span className="text-destructive"> *</span></Label><Input id="vm-date" type="date" value={(form.date || "").split("T")[0]} onChange={e => setForm(f => ({ ...f, date: new Date(e.target.value).toISOString() }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="vm-type">Type of Maintenance<span className="text-destructive"> *</span></Label><Input id="vm-type" placeholder="Routine / Breakdown / Tyre Change" value={form.type || ""} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="vm-reportedBy">Reported By</Label><Input id="vm-reportedBy" placeholder="Driver or Supervisor" value={form.reportedBy || ""} onChange={e => setForm(f => ({ ...f, reportedBy: e.target.value }))} /></div>
        <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="vm-work">Work Description<span className="text-destructive"> *</span></Label><Input id="vm-work" placeholder="e.g. Oil change, brake pad replace" value={form.workDescription || ""} onChange={e => setForm(f => ({ ...f, workDescription: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="vm-vendor">Workshop / Vendor</Label><Input id="vm-vendor" placeholder="Name + Contact" value={form.vendor || ""} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="vm-cost">Cost (BHD)</Label><Input id="vm-cost" type="number" placeholder="e.g. 120" value={(form.cost || 0) as any} onChange={e => setForm(f => ({ ...f, cost: Number(e.target.value || 0) }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="vm-invoice">Invoice Number</Label><Input id="vm-invoice" placeholder="Optional" value={form.invoiceNumber || ""} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="vm-nextKm">Next Service Due (Km)</Label><Input id="vm-nextKm" type="number" placeholder="e.g. 50000" value={(form.nextServiceDueKm || 0) as any} onChange={e => setForm(f => ({ ...f, nextServiceDueKm: Number(e.target.value || 0) }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="vm-nextDate">Next Service Due (Date)</Label><Input id="vm-nextDate" type="date" value={(form.nextServiceDueDate || "").split("T")[0]} onChange={e => setForm(f => ({ ...f, nextServiceDueDate: new Date(e.target.value).toISOString() }))} /></div>
        <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="vm-remarks">Remarks</Label><Input id="vm-remarks" placeholder="Notes or follow-up" value={form.remarks || ""} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
        <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="vm-attachment">Attachment</Label><Input id="vm-attachment" type="file" accept="image/*,.pdf" onChange={e => {
          const file = e.target.files?.[0] || null;
          setAttachmentFile(file);
        }} /></div>
        {(attachmentFile || form.attachmentUrl) && (
          <div className="md:col-span-2">
            {attachmentFile ? (
              attachmentFile.type.startsWith('image/') ? (
                <img src={URL.createObjectURL(attachmentFile)} alt="Attachment preview" className="w-full max-h-64 rounded object-contain" />
              ) : (
                <iframe src={URL.createObjectURL(attachmentFile)} title="Attachment preview" className="w-full h-64 rounded" />
              )
            ) : (
              (String(form.attachmentUrl).toLowerCase().endsWith('.pdf')) ? (
                <iframe src={String(form.attachmentUrl)} title="Attachment" className="w-full h-64 rounded" />
              ) : (
                <img src={String(form.attachmentUrl)} alt="Attachment" className="w-full max-h-64 rounded object-contain" />
              )
            )}
          </div>
        )}
        </div>
      </div>
    );
  }

  function MheMaintenanceForm({ onSaved, mheId, record }: { onSaved?: () => void, mheId?: string, record?: MheMaintenanceRecord }) {
    const [form, setForm] = useState<Partial<MheMaintenanceRecord>>(() => {
      if (record) {
        return { ...record };
      }
      return { date: new Date().toISOString(), mheId };
    });
    const [selectedMheId, setSelectedMheId] = useState<string>(() => record?.mheId || mheId || "");
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const isEdit = !!record;
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-10 bg-background border-b py-3">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={() => {
              if (!form.mheId || !form.date || !form.type || !form.workDescription) {
                toast({ title: "Missing required fields", description: "MHE, Date, Type, and Work Description are required." });
                return;
              }
              if (isEdit && record) {
                const updated: MheMaintenanceRecord = {
                  id: record.id,
                  mheId: form.mheId!,
                  date: form.date!,
                  type: form.type!,
                  reportedBy: form.reportedBy || null,
                  workDescription: form.workDescription!,
                  vendor: form.vendor || null,
                  cost: form.cost || null,
                  nextServiceDueDate: form.nextServiceDueDate || null,
                  remarks: form.remarks || null,
                  attachmentUrl: form.attachmentUrl || null,
                };
                setMheMaintenances(prev => prev.map(r => r.id === record.id ? updated : r));
                const m = mhes.find(x => x.id === updated.mheId);
                toast({ title: "Maintenance updated", description: `${m?.equipmentInfo || updated.mheId} • ${updated.type}` });
                onSaved?.();
              } else {
                (async () => {
                  try {
                    const fd = new FormData();
                    fd.append('mheId', String(form.mheId || ''));
                    fd.append('date', String(form.date || ''));
                    fd.append('type', String(form.type || ''));
                    if (form.reportedBy) fd.append('reportedBy', String(form.reportedBy));
                    fd.append('workDescription', String(form.workDescription || ''));
                    if (form.vendor) fd.append('vendor', String(form.vendor));
                    if (form.cost != null) fd.append('cost', String(form.cost));
                    if (form.nextServiceDueDate) fd.append('nextServiceDueDate', String(form.nextServiceDueDate));
                    if (form.remarks) fd.append('remarks', String(form.remarks));
                    if (attachmentFile) fd.append('attachment', attachmentFile);
                    const res = await fetch('/api/mhe-maintenance', { method: 'POST', body: fd });
                    if (!res.ok) throw new Error(`Failed to save maintenance: ${res.status}`);
                    const data = await res.json();
                    const saved = data?.item as any;
                    const rec: MheMaintenanceRecord = {
                      id: saved.id,
                      mheId: saved.mheId,
                      date: saved.date,
                      type: saved.type,
                      reportedBy: saved.reportedBy ?? null,
                      workDescription: saved.workDescription,
                      vendor: saved.vendor ?? null,
                      cost: saved.cost ?? null,
                      nextServiceDueDate: saved.nextServiceDueDate ?? null,
                      remarks: saved.remarks ?? null,
                      attachmentUrl: saved.attachmentUrl ?? null,
                    };
                    setMheMaintenances(prev => [rec, ...prev]);
                    const m = mhes.find(x => x.id === rec.mheId);
                    toast({ title: 'Maintenance saved', description: `${m?.equipmentInfo || rec.mheId} • ${rec.type}` });
                    onSaved?.();
                  } catch (e: any) {
                    console.warn(e);
                    toast({ title: 'Save failed', description: e?.message || 'Could not save maintenance.', variant: 'destructive' as any });
                  }
                })();
              }
            }}>
              <Plus className="h-4 w-4 mr-2" /> {isEdit ? "Update Maintenance" : "Save Maintenance"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label htmlFor="mm-mhe">MHE<span className="text-destructive"> *</span></Label>
          <Select value={selectedMheId} onValueChange={(val) => { setSelectedMheId(val); setForm(f => ({ ...f, mheId: val })); }}>
            <SelectTrigger id="mm-mhe" className="w-full">
              <SelectValue placeholder="Select MHE" />
            </SelectTrigger>
            <SelectContent>
              {mhes.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.equipmentInfo || m.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1"><Label htmlFor="mm-date">Date<span className="text-destructive"> *</span></Label><Input id="mm-date" type="date" value={(form.date || "").split("T")[0]} onChange={e => setForm(f => ({ ...f, date: new Date(e.target.value).toISOString() }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="mm-type">Type of Maintenance<span className="text-destructive"> *</span></Label><Input id="mm-type" placeholder="Routine / Breakdown / Inspection" value={form.type || ""} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="mm-reportedBy">Reported By</Label><Input id="mm-reportedBy" placeholder="Operator or Supervisor" value={form.reportedBy || ""} onChange={e => setForm(f => ({ ...f, reportedBy: e.target.value }))} /></div>
        <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="mm-work">Work Description<span className="text-destructive"> *</span></Label><Input id="mm-work" placeholder="e.g. Hydraulic hose replacement, chain tension" value={form.workDescription || ""} onChange={e => setForm(f => ({ ...f, workDescription: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="mm-vendor">Workshop / Vendor</Label><Input id="mm-vendor" placeholder="Name + Contact" value={form.vendor || ""} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="mm-cost">Cost (BHD)</Label><Input id="mm-cost" type="number" placeholder="e.g. 120" value={(form.cost || 0) as any} onChange={e => setForm(f => ({ ...f, cost: Number(e.target.value || 0) }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="mm-nextDate">Next Service / Inspection Date</Label><Input id="mm-nextDate" type="date" value={(form.nextServiceDueDate || "").split("T")[0]} onChange={e => setForm(f => ({ ...f, nextServiceDueDate: new Date(e.target.value).toISOString() }))} /></div>
        <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="mm-remarks">Remarks</Label><Input id="mm-remarks" placeholder="Notes or follow-up" value={form.remarks || ""} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
        <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="mm-attachment">Attachment</Label><Input id="mm-attachment" type="file" accept="image/*,.pdf" onChange={e => {
          const file = e.target.files?.[0] || null;
          setAttachmentFile(file);
        }} /></div>
        {(attachmentFile || form.attachmentUrl) && (
          <div className="md:col-span-2">
            {attachmentFile ? (
              attachmentFile.type.startsWith('image/') ? (
                <img src={URL.createObjectURL(attachmentFile)} alt="Attachment preview" className="w-full max-h-64 rounded object-contain" />
              ) : (
                <iframe src={URL.createObjectURL(attachmentFile)} title="Attachment preview" className="w-full h-64 rounded" />
              )
            ) : (
              (String(form.attachmentUrl).toLowerCase().endsWith('.pdf')) ? (
                <iframe src={String(form.attachmentUrl)} title="Attachment" className="w-full h-64 rounded" />
              ) : (
                <img src={String(form.attachmentUrl)} alt="Attachment" className="w-full max-h-64 rounded object-contain" />
              )
            )}
          </div>
        )}
        </div>
      </div>
    );
  }

  function MheForm({ onSaved }: { onSaved?: () => void }) {
    const [form, setForm] = useState<Partial<Mhe>>({ status: "Active" });
    const [cert, setCert] = useState<Partial<Certification>>({});
    const [bat, setBat] = useState<Partial<Battery>>({});
    const mheImageFileRef = useRef<File | null>(null);
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-10 bg-background border-b py-3">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={async () => {
              if (!form.equipmentInfo || !form.status) {
                toast({ title: "Missing required fields", description: "Equipment Info and Status are required." });
                return;
              }
              try {
                const fd = new FormData();
                fd.append('equipmentInfo', String(form.equipmentInfo));
                fd.append('status', String(form.status));
                if (form.modelNo) fd.append('modelNo', String(form.modelNo));
                if (form.serialNo) fd.append('serialNo', String(form.serialNo));
                fd.append('battery', JSON.stringify(bat));
                fd.append('certification', JSON.stringify(cert));
                fd.append('repairs', JSON.stringify([]));
                if (mheImageFileRef.current) fd.append('image', mheImageFileRef.current);
                const res = await fetch('/api/mhes', { method: 'POST', body: fd });
                if (!res.ok) {
                  const j = await res.json().catch(() => ({}));
                  throw new Error(String(j?.error || res.statusText || res.status));
                }
                const data = await res.json();
                const saved = data?.item;
                const m: Mhe = {
                  id: saved?.id || `m-${Date.now()}`,
                  equipmentInfo: saved?.equipmentInfo || form.equipmentInfo || "",
                  modelNo: saved?.modelNo ?? (form.modelNo || null),
                  serialNo: saved?.serialNo ?? (form.serialNo || null),
                  certification: saved?.certification ?? (cert as Certification),
                  battery: saved?.battery ?? (bat as Battery),
                  repairs: Array.isArray(saved?.repairs) ? saved.repairs : [],
                  imageUrl: saved?.imageUrl ?? (form.imageUrl || null),
                  status: (saved?.status as any) || (form.status as any) || "Active",
                };
                setMhes(prev => [m, ...prev]);
                toast({ title: "MHE saved", description: m.equipmentInfo });
                setForm({}); setCert({}); setBat({});
                mheImageFileRef.current = null;
                onSaved?.();
              } catch (e: any) {
                console.warn(e);
                toast({ title: 'Save failed', description: e?.message || 'Could not save MHE.', variant: 'destructive' as any });
              }
            }}>
              <Plus className="h-4 w-4 mr-2" /> Save MHE
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1"><Label htmlFor="equipmentInfo">Equipment Info<span className="text-destructive"> *</span></Label><Input id="equipmentInfo" required placeholder="e.g. Forklift Cat 2.5T" value={form.equipmentInfo || ""} onChange={e => setForm(f => ({ ...f, equipmentInfo: e.target.value }))} /></div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="mheStatus">Status<span className="text-destructive"> *</span></Label>
            <Select value={(form.status || "") as any} onValueChange={(val) => setForm((f) => ({ ...f, status: val as any }))}>
              <SelectTrigger id="mheStatus" className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="In Maintenance">In Maintenance</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1"><Label htmlFor="modelNo">Model No.</Label><Input id="modelNo" placeholder="e.g. CAT-25" value={form.modelNo || ""} onChange={e => setForm(f => ({ ...f, modelNo: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="mheSerial">Serial No.</Label><Input id="mheSerial" placeholder="e.g. FL-12345" value={form.serialNo || ""} onChange={e => setForm(f => ({ ...f, serialNo: e.target.value }))} /></div>
          <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="mheImage">MHE Image</Label><Input id="mheImage" type="file" accept="image/*" onChange={e => {
            const file = e.target.files?.[0] || null;
            mheImageFileRef.current = file;
            if (file) {
              const reader = new FileReader();
              reader.onload = () => setForm(f => ({ ...f, imageUrl: reader.result as string }));
              reader.readAsDataURL(file);
            } else {
              setForm(f => ({ ...f, imageUrl: undefined }));
            }
          }} /></div>
          {form.imageUrl && (
            <div className="md:col-span-2">
              <img src={form.imageUrl} alt="MHE image preview" className="h-20 w-20 rounded object-cover" />
            </div>
          )}
          <div className="flex flex-col gap-1"><Label htmlFor="certType">Certification Type</Label><Input id="certType" placeholder="e.g. 3rd-party" value={cert.type || ""} onChange={e => setCert(c => ({ ...c, type: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="certIssue">Cert Issue Date</Label><Input id="certIssue" type="date" value={(cert.issueDate || "").split("T")[0]} onChange={e => setCert(c => ({ ...c, issueDate: new Date(e.target.value).toISOString() }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="certExpiry">Cert Expiry</Label><Input id="certExpiry" type="date" value={(cert.expiry || "").split("T")[0]} onChange={e => setCert(c => ({ ...c, expiry: new Date(e.target.value).toISOString() }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="certVendor">Cert Vendor</Label><Input id="certVendor" placeholder="e.g. CertPro" value={cert.vendor || ""} onChange={e => setCert(c => ({ ...c, vendor: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="certNumber">Certificate No.</Label><Input id="certNumber" placeholder="e.g. CERT-0001" value={cert.certificateNo || ""} onChange={e => setCert(c => ({ ...c, certificateNo: e.target.value }))} /></div>
          <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="mheAttachments">Attachments</Label><Input id="mheAttachments" type="file" onChange={() => { /* attach later */ }} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="batType">Battery Type</Label><Input id="batType" placeholder="e.g. Lead Acid" value={bat.type || ""} onChange={e => setBat(b => ({ ...b, type: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="voltage">Voltage</Label><Input id="voltage" placeholder="e.g. 48V" value={bat.voltage || ""} onChange={e => setBat(b => ({ ...b, voltage: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="size">Size</Label><Input id="size" placeholder="e.g. 2x24V" value={bat.size || ""} onChange={e => setBat(b => ({ ...b, size: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="serialNo">Serial No</Label><Input id="serialNo" placeholder="e.g. BAT-1234" value={bat.serialNo || ""} onChange={e => setBat(b => ({ ...b, serialNo: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="installDate">Install Date</Label><Input id="installDate" type="date" value={(bat.installDate || "").split("T")[0]} onChange={e => setBat(b => ({ ...b, installDate: new Date(e.target.value).toISOString() }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="replacementDate">Replacement Date</Label><Input id="replacementDate" type="date" value={(bat.replacementDate || "").split("T")[0]} onChange={e => setBat(b => ({ ...b, replacementDate: new Date(e.target.value).toISOString() }))} /></div>
        </div>
      </div>
    );
  }

  function MheFormPro({ mhe, onSaved }: { mhe?: Mhe; onSaved?: () => void }) {
    const [form, setForm] = useState<Partial<Mhe>>({ status: "Active" });
    const [cert, setCert] = useState<Partial<Certification>>({});
    const [bat, setBat] = useState<Partial<Battery>>({});
    const mheImageFileRef = useRef<File | null>(null);
    const certAttachmentFileRef = useRef<File | null>(null);

    useEffect(() => {
      if (mhe) {
        setForm({
          id: mhe.id,
          equipmentInfo: mhe.equipmentInfo,
          status: mhe.status,
          modelNo: mhe.modelNo || undefined,
          serialNo: mhe.serialNo || undefined,
          imageUrl: mhe.imageUrl || undefined,
        });
        setCert(mhe.certification || {});
        setBat(mhe.battery || {});
        mheImageFileRef.current = null;
      }
    }, [mhe]);
    return (
      <div className="space-y-4">
        {/* Removed sticky header actions to avoid duplicate Save/Cancel; Actions are in the right card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Equipment Details</CardTitle>
                <CardDescription>Core info and current status.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1"><Label htmlFor="equipmentInfo">Equipment Info<span className="text-destructive"> *</span></Label><Input id="equipmentInfo" required placeholder="e.g. Forklift Cat 2.5T" value={form.equipmentInfo || ""} onChange={e => setForm(f => ({ ...f, equipmentInfo: e.target.value }))} /></div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="mheStatus">Status<span className="text-destructive"> *</span></Label>
                    <Select value={(form.status || "") as any} onValueChange={(val) => setForm((f) => ({ ...f, status: val as any }))}>
                      <SelectTrigger id="mheStatus" className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="In Maintenance">In Maintenance</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1"><Label htmlFor="modelNo">Model No.</Label><Input id="modelNo" placeholder="e.g. CAT-25" value={form.modelNo || ""} onChange={e => setForm(f => ({ ...f, modelNo: e.target.value }))} /></div>
                  <div className="flex flex-col gap-1"><Label htmlFor="mheSerial">Serial No.</Label><Input id="mheSerial" placeholder="e.g. FL-12345" value={form.serialNo || ""} onChange={e => setForm(f => ({ ...f, serialNo: e.target.value }))} /></div>
                  <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="mheImage">MHE Image</Label><Input id="mheImage" type="file" accept="image/*" onChange={e => {
                    const file = e.target.files?.[0] || null;
                    mheImageFileRef.current = file;
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => setForm(f => ({ ...f, imageUrl: reader.result as string }));
                      reader.readAsDataURL(file);
                    } else {
                      setForm(f => ({ ...f, imageUrl: undefined }));
                    }
                  }} /></div>
                  {form.imageUrl && (
                    <div className="md:col-span-2">
                      <img src={form.imageUrl} alt="MHE image preview" className="h-20 w-20 rounded object-cover" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Certification</CardTitle>
                <CardDescription>Vendor, type, and dates.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1"><Label htmlFor="certType">Type</Label><Input id="certType" placeholder="e.g. 3rd-party" value={cert.type || ""} onChange={e => setCert(c => ({ ...c, type: e.target.value }))} /></div>
                  <div className="flex flex-col gap-1"><Label htmlFor="certVendor">Vendor</Label><Input id="certVendor" placeholder="e.g. CertPro" value={cert.vendor || ""} onChange={e => setCert(c => ({ ...c, vendor: e.target.value }))} /></div>
                  <div className="flex flex-col gap-1"><Label htmlFor="certIssue">Issue Date</Label><Input id="certIssue" type="date" value={(cert.issueDate || "").split("T")[0]} onChange={e => setCert(c => ({ ...c, issueDate: new Date(e.target.value).toISOString() }))} /></div>
                  <div className="flex flex-col gap-1"><Label htmlFor="certExpiry">Expiry</Label><Input id="certExpiry" type="date" value={(cert.expiry || "").split("T")[0]} onChange={e => setCert(c => ({ ...c, expiry: new Date(e.target.value).toISOString() }))} /></div>
                  <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="certNumber">Certificate No.</Label><Input id="certNumber" placeholder="e.g. CERT-0001" value={cert.certificateNo || ""} onChange={e => setCert(c => ({ ...c, certificateNo: e.target.value }))} /></div>
                  <div className="flex flex-col gap-1 md:col-span-4"><Label htmlFor="mheAttachments">Certificate Attachment</Label><Input id="mheAttachments" type="file" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0] || null; certAttachmentFileRef.current = f; }} />
                    {(certAttachmentFileRef.current || cert.attachment) && (
                      <div className="mt-3">
                        {certAttachmentFileRef.current ? (
                          (certAttachmentFileRef.current.type || '').startsWith('image/') ? (
                            <img src={URL.createObjectURL(certAttachmentFileRef.current)} alt="Certificate attachment" className="w-full max-h-64 rounded object-contain" />
                          ) : (
                            <iframe src={URL.createObjectURL(certAttachmentFileRef.current)} title="Certificate attachment" className="w-full h-64 rounded" />
                          )
                        ) : (
                          (String(cert.attachment).toLowerCase().endsWith('.pdf')) ? (
                            <iframe src={String(cert.attachment)} title="Certificate attachment" className="w-full h-64 rounded" />
                          ) : (
                            <img src={String(cert.attachment)} alt="Certificate attachment" className="w-full max-h-64 rounded object-contain" />
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

          <Card>
            <CardHeader>
              <CardTitle>Battery</CardTitle>
              <CardDescription>Type and lifecycle.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1"><Label htmlFor="batType">Type</Label><Input id="batType" placeholder="e.g. Lead Acid" value={bat.type || ""} onChange={e => setBat(b => ({ ...b, type: e.target.value }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="voltage">Voltage</Label><Input id="voltage" placeholder="e.g. 48V" value={bat.voltage || ""} onChange={e => setBat(b => ({ ...b, voltage: e.target.value }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="size">Size</Label><Input id="size" placeholder="e.g. 2x24V" value={bat.size || ""} onChange={e => setBat(b => ({ ...b, size: e.target.value }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="serialNo">Serial No</Label><Input id="serialNo" placeholder="e.g. BAT-1234" value={bat.serialNo || ""} onChange={e => setBat(b => ({ ...b, serialNo: e.target.value }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="installDate">Install Date</Label><Input id="installDate" type="date" value={(bat.installDate || "").split("T")[0]} onChange={e => setBat(b => ({ ...b, installDate: new Date(e.target.value).toISOString() }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="replacementDate">Replacement Date</Label><Input id="replacementDate" type="date" value={(bat.replacementDate || "").split("T")[0]} onChange={e => setBat(b => ({ ...b, replacementDate: new Date(e.target.value).toISOString() }))} /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Reset or save details.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={async () => {
                  if (!form.equipmentInfo || !form.status) {
                    toast({ title: "Missing required fields", description: "Equipment Info and Status are required." });
                    return;
                  }
                  try {
                    const fd = new FormData();
                    fd.append('equipmentInfo', String(form.equipmentInfo));
                    fd.append('status', String(form.status));
                    if (form.modelNo) fd.append('modelNo', String(form.modelNo));
                    if (form.serialNo) fd.append('serialNo', String(form.serialNo));
                    fd.append('battery', JSON.stringify(bat));
                    fd.append('certification', JSON.stringify(cert));
                    fd.append('repairs', JSON.stringify([]));
                    if (mheImageFileRef.current) {
                      fd.append('image', mheImageFileRef.current);
                    } else if (form.imageUrl) {
                      fd.append('existingImageUrl', String(form.imageUrl));
                    }
                    const isEdit = Boolean(mhe?.id);
                    const url = isEdit ? `/api/mhes/${mhe!.id}` : '/api/mhes';
                    const method = isEdit ? 'PUT' : 'POST';
                    if (certAttachmentFileRef.current) {
                      fd.append('certAttachment', certAttachmentFileRef.current);
                    }
                    const res = await fetch(url, { method, body: fd });
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}));
                      throw new Error(String(j?.error || res.statusText || res.status));
                    }
                    const data = await res.json();
                    const saved = data?.item;
                    const m: Mhe = {
                      id: saved?.id || (mhe?.id ?? `m-${Date.now()}`),
                      equipmentInfo: saved?.equipmentInfo || form.equipmentInfo || "",
                      modelNo: saved?.modelNo ?? (form.modelNo || null),
                      serialNo: saved?.serialNo ?? (form.serialNo || null),
                      certification: saved?.certification ?? (cert as Certification),
                      battery: saved?.battery ?? (bat as Battery),
                      repairs: Array.isArray(saved?.repairs) ? saved.repairs : [],
                      imageUrl: saved?.imageUrl ?? (form.imageUrl || null),
                      status: (saved?.status as any) || (form.status as any) || "Active",
                    };
                    setMhes(prev => {
                      const idx = prev.findIndex(x => x.id === m.id);
                      if (idx >= 0) {
                        const copy = [...prev];
                        copy[idx] = m;
                        return copy;
                      }
                      return [m, ...prev];
                    });
                    toast({ title: isEdit ? "MHE updated" : "MHE saved", description: m.equipmentInfo });
                    if (!isEdit) {
                      setForm({}); setCert({}); setBat({});
                      mheImageFileRef.current = null;
                    }
                    onSaved?.();
                  } catch (e: any) {
                    console.warn(e);
                    toast({ title: 'Save failed', description: e?.message || 'Could not save MHE.', variant: 'destructive' as any });
                  }
                }}>
                  <Plus className="h-4 w-4 mr-2" /> {mhe ? 'Update MHE' : 'Save MHE'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    );
  }


  function GatePassForm({ onSaved }: { onSaved?: () => void }) {
    const [form, setForm] = useState<Partial<GatePass>>({ status: "Active" });
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    // Attachment will be uploaded server-side via Admin Storage
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-10 bg-background border-b py-3">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={async () => {
              if (!form.customerName || !form.location || !form.passNumber || !form.status || !form.vehicleId || !form.driverName) {
                toast({ title: "Missing required fields", description: "Customer, Location, Pass Number, Status, Vehicle, and Driver are required." });
                return;
              }
              const fd = new FormData();
              fd.append('customerName', String(form.customerName || ''));
              fd.append('location', String(form.location || ''));
              fd.append('passNumber', String(form.passNumber || ''));
              if (form.issueDate) fd.append('issueDate', String(form.issueDate));
              if (form.expiryDate) fd.append('expiryDate', String(form.expiryDate));
              fd.append('status', String((form.status as any) || 'Active'));
              if (form.vehicleId) fd.append('vehicleId', String(form.vehicleId));
              if (form.driverName) fd.append('driverName', String(form.driverName));
              if (attachmentFile) fd.append('attachment', attachmentFile);
              try {
                const res = await fetch('/api/gatepasses', { method: 'POST', body: fd });
                if (!res.ok) throw new Error(`Failed to save Gate Pass: ${res.status}`);
                const data = await res.json();
                const saved = data?.item || {};
                const gp: GatePass = {
                  id: saved.id,
                  customerName: saved.customerName || String(form.customerName || ''),
                  location: saved.location || String(form.location || ''),
                  passNumber: saved.passNumber || String(form.passNumber || ''),
                  issueDate: saved.issueDate ?? (form.issueDate || null),
                  expiryDate: saved.expiryDate ?? (form.expiryDate || null),
                  attachment: Array.isArray(saved.attachments) && saved.attachments.length > 0 ? saved.attachments[0] : null,
                  status: (saved.status as any) || ((form.status as any) || 'Active'),
                  vehicleId: saved.vehicleId ?? (form.vehicleId || null),
                  driverName: saved.driverName ?? (form.driverName || null),
                };
                setGatePasses(prev => [gp, ...prev]);
                toast({ title: "Gate Pass saved", description: gp.passNumber });
                setForm({});
                setAttachmentFile(null);
                onSaved?.();
              } catch (e) {
                console.warn(e);
                toast({ title: 'Save failed', description: 'Could not save Gate Pass.', variant: 'destructive' as any });
              }
            }}>
              <Plus className="h-4 w-4 mr-2" /> Save Gate Pass
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1"><Label htmlFor="customerName">Customer Name<span className="text-destructive"> *</span></Label><Input id="customerName" required placeholder="e.g. ABC Logistics" value={form.customerName || ""} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="gpLocation">Location<span className="text-destructive"> *</span></Label><Input id="gpLocation" required placeholder="e.g. Sitra" value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="passNumber">Pass Number<span className="text-destructive"> *</span></Label><Input id="passNumber" required placeholder="e.g. GP-2025-001" value={form.passNumber || ""} onChange={e => setForm(f => ({ ...f, passNumber: e.target.value }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="issueDate">Issue Date</Label><Input id="issueDate" type="date" value={(form.issueDate || "").split("T")[0]} onChange={e => setForm(f => ({ ...f, issueDate: new Date(e.target.value).toISOString() }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="expiryDate">Expiry Date</Label><Input id="expiryDate" type="date" value={(form.expiryDate || "").split("T")[0]} onChange={e => setForm(f => ({ ...f, expiryDate: new Date(e.target.value).toISOString() }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="gpStatus">Status<span className="text-destructive"> *</span></Label><Input id="gpStatus" required placeholder="Active / Suspended / Expired" value={(form.status || "") as any} onChange={e => setForm(f => ({ ...f, status: (e.target.value as any) }))} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="gpVehicle">Vehicle<span className="text-destructive"> *</span></Label>
          <Select value={form.vehicleId || undefined} onValueChange={(val) => setForm(f => ({ ...f, vehicleId: val }))}>
            <SelectTrigger id="gpVehicle" className="w-full"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
            <SelectContent>
              {vehicles.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.plateNo || v.vehicleType || v.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1"><Label htmlFor="gpDriver">Driver<span className="text-destructive"> *</span></Label>
          <Select value={form.driverName || undefined} onValueChange={(val) => setForm(f => ({ ...f, driverName: val }))}>
            <SelectTrigger id="gpDriver" className="w-full"><SelectValue placeholder="Select driver" /></SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u.id} value={(u as any).fullName || (u as any).name || u.id}>{(u as any).fullName || (u as any).name || u.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="gpAttachment">Attachment</Label><Input id="gpAttachment" type="file" onChange={e => { const f = e.target.files?.[0] || null; setAttachmentFile(f); }} /></div>
      </div>
    </div>
  );
  }

  function GatePassFormPro({ onSaved, gatePass }: { onSaved?: () => void, gatePass?: GatePass }) {
    const [form, setForm] = useState<Partial<GatePass>>(() => gatePass ? { ...gatePass } : { status: "Active" });
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    // Attachment will be uploaded server-side via Admin Storage (create only)
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-10 bg-background border-b py-3">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={async () => {
              if (!form.customerName || !form.location || !form.passNumber || !form.status || !form.vehicleId || !form.driverName) {
                toast({ title: "Missing required fields", description: "Customer, Location, Pass Number, Status, Vehicle, and Driver are required." });
                return;
              }
              try {
                if (!gatePass) {
                  const fd = new FormData();
                  fd.append('customerName', String(form.customerName || ''));
                  fd.append('location', String(form.location || ''));
                  fd.append('passNumber', String(form.passNumber || ''));
                  if (form.issueDate) fd.append('issueDate', String(form.issueDate));
                  if (form.expiryDate) fd.append('expiryDate', String(form.expiryDate));
                  fd.append('status', String((form.status as any) || 'Active'));
                  if (form.vehicleId) fd.append('vehicleId', String(form.vehicleId));
                  if (form.driverName) fd.append('driverName', String(form.driverName));
                  if (attachmentFile) fd.append('attachment', attachmentFile);
                  const res = await fetch('/api/gatepasses', { method: 'POST', body: fd });
                  if (!res.ok) throw new Error(`Failed to save Gate Pass: ${res.status}`);
                  const data = await res.json();
                  const saved = data?.item || {};
                  const gp: GatePass = {
                    id: saved.id,
                    customerName: saved.customerName || String(form.customerName || ''),
                    location: saved.location || String(form.location || ''),
                    passNumber: saved.passNumber || String(form.passNumber || ''),
                    issueDate: saved.issueDate ?? (form.issueDate || null),
                    expiryDate: saved.expiryDate ?? (form.expiryDate || null),
                    attachment: Array.isArray(saved.attachments) && saved.attachments.length > 0 ? saved.attachments[0] : null,
                    status: (saved.status as any) || ((form.status as any) || 'Active'),
                    vehicleId: saved.vehicleId ?? (form.vehicleId || null),
                    driverName: saved.driverName ?? (form.driverName || null),
                  };
                  setGatePasses(prev => [gp, ...prev]);
                  toast({ title: "Gate Pass saved", description: gp.passNumber });
                  setForm({});
                  setAttachmentFile(null);
                  onSaved?.();
                } else {
                  const fd = new FormData();
                  fd.append('passNumber', String(form.passNumber || ''));
                  fd.append('customerName', String(form.customerName || ''));
                  fd.append('location', String(form.location || ''));
                  if (form.issueDate) fd.append('issueDate', String(form.issueDate));
                  if (form.expiryDate) fd.append('expiryDate', String(form.expiryDate));
                  fd.append('status', String((form.status as any) || 'Active'));
                  // Allow appending a new attachment in edit
                  if (attachmentFile) fd.append('attachment', attachmentFile);
                  const res = await fetch(`/api/gatepasses/${gatePass.id}`, { method: 'PUT', body: fd });
                  if (!res.ok) throw new Error(`Failed to update Gate Pass: ${res.status}`);
                  const data = await res.json();
                  const saved = data?.item || {};
                  const gp: GatePass = {
                    id: gatePass.id,
                    customerName: saved.customerName || String(form.customerName || ''),
                    location: saved.location || String(form.location || ''),
                    passNumber: saved.passNumber || String(form.passNumber || ''),
                    issueDate: saved.issueDate ?? (form.issueDate || null),
                    expiryDate: saved.expiryDate ?? (form.expiryDate || null),
                    attachment: Array.isArray(saved.attachments) && saved.attachments.length > 0 ? saved.attachments[0] : (gatePass.attachment || null),
                    status: (saved.status as any) || ((form.status as any) || 'Active'),
                    vehicleId: gatePass.vehicleId ?? (form.vehicleId || null),
                    driverName: gatePass.driverName ?? (form.driverName || null),
                  };
                  setGatePasses(prev => prev.map(x => x.id === gatePass.id ? gp : x));
                  toast({ title: "Gate Pass updated", description: gp.passNumber });
                  onSaved?.();
                }
              } catch (e) {
                console.warn(e);
                toast({ title: gatePass ? 'Update failed' : 'Save failed', description: gatePass ? 'Could not update Gate Pass.' : 'Could not save Gate Pass.', variant: 'destructive' as any });
              }
            }}>
              <Plus className="h-4 w-4 mr-2" /> {gatePass ? 'Update Gate Pass' : 'Save Gate Pass'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pass Details</CardTitle>
              <CardDescription>Customer, location, and pass number.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1"><Label htmlFor="customerName">Customer Name<span className="text-destructive"> *</span></Label><Input id="customerName" required placeholder="e.g. ABC Logistics" value={form.customerName || ""} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="gpLocation">Location<span className="text-destructive"> *</span></Label><Input id="gpLocation" required placeholder="e.g. Sitra" value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="passNumber">Pass Number<span className="text-destructive"> *</span></Label><Input id="passNumber" required placeholder="e.g. GP-2025-001" value={form.passNumber || ""} onChange={e => setForm(f => ({ ...f, passNumber: e.target.value }))} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dates & Status</CardTitle>
              <CardDescription>Issue, expiry, and current status.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1"><Label htmlFor="issueDate">Issue Date</Label><Input id="issueDate" type="date" value={(form.issueDate || "").split("T")[0]} onChange={e => setForm(f => ({ ...f, issueDate: new Date(e.target.value).toISOString() }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor="expiryDate">Expiry Date</Label><Input id="expiryDate" type="date" value={(form.expiryDate || "").split("T")[0]} onChange={e => setForm(f => ({ ...f, expiryDate: new Date(e.target.value).toISOString() }))} /></div>
                <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="gpStatus">Status<span className="text-destructive"> *</span></Label><Input id="gpStatus" required placeholder="Active / Suspended / Expired" value={(form.status || "") as any} onChange={e => setForm(f => ({ ...f, status: (e.target.value as any) }))} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vehicle & Driver</CardTitle>
              <CardDescription>Link this pass to a vehicle and driver.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1"><Label htmlFor="gpVehicle2">Vehicle<span className="text-destructive"> *</span></Label>
                  <Select value={form.vehicleId || undefined} onValueChange={(val) => setForm(f => ({ ...f, vehicleId: val }))}>
                    <SelectTrigger id="gpVehicle2" className="w-full"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                    <SelectContent>
                      {vehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.plateNo || v.vehicleType || v.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1"><Label htmlFor="gpDriver2">Driver<span className="text-destructive"> *</span></Label>
                  <Select value={form.driverName || undefined} onValueChange={(val) => setForm(f => ({ ...f, driverName: val }))}>
                    <SelectTrigger id="gpDriver2" className="w-full"><SelectValue placeholder="Select driver" /></SelectTrigger>
                    <SelectContent>
                      {users.map(u => (
                        <SelectItem key={u.id} value={(u as any).fullName || (u as any).name || u.id}>{(u as any).fullName || (u as any).name || u.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attachment</CardTitle>
              <CardDescription>Optional file upload.</CardDescription>
            </CardHeader>
            <CardContent>
              <Input id="gpAttachment" type="file" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0] || null; setAttachmentFile(f); }} />
              {(attachmentFile || form.attachment) && (
                <div className="mt-3">
                  {attachmentFile ? (
                    attachmentFile.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(attachmentFile)} alt="Attachment preview" className="w-full max-h-64 rounded object-contain" />
                    ) : (
                      <iframe src={URL.createObjectURL(attachmentFile)} title="Attachment preview" className="w-full h-64 rounded" />
                    )
                  ) : (
                    (String(form.attachment).toLowerCase().endsWith('.pdf')) ? (
                      <iframe src={String(form.attachment)} title="Attachment" className="w-full h-64 rounded" />
                    ) : (
                      <img src={String(form.attachment)} alt="Attachment" className="w-full max-h-64 rounded object-contain" />
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* bottom actions card removed in favor of sticky header */}
      </div>
      </div>
    );
  }

  function LicenseForm({ onSaved, license }: { onSaved?: () => void, license?: DriverLicense }) {
    const [selectedDriverId, setSelectedDriverId] = useState<string>(() => license?.driverId || '')
    const [entry, setEntry] = useState<Partial<DriverLicense>>(() => {
      if (license) {
        const first = Array.isArray(license.attachments) && (license.attachments as string[]).length > 0 ? (license.attachments as string[])[0] : null
        return { ...license, attachmentUrl: license.attachmentUrl || first || null }
      }
      return { vehicleType: '', licenseNumber: '', issueDate: '', expiryDate: '' }
    })
    const [licenseFiles, setLicenseFiles] = useState<File[]>([])
    useEffect(() => {
      if (!license && !selectedDriverId && users.length > 0) {
        setSelectedDriverId(users[0].id)
      }
    }, [users])

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1"><Label htmlFor="dl-driver">Driver<span className="text-destructive"> *</span></Label>
            <Select value={selectedDriverId} onValueChange={(val) => { setSelectedDriverId(val) }}>
              <SelectTrigger id="dl-driver" className="w-full"><SelectValue placeholder="Select driver" /></SelectTrigger>
              <SelectContent>
                {users.map(u => (<SelectItem key={u.id} value={u.id}>{(u as any).fullName || (u as any).name || u.id}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add License</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1"><Label htmlFor={`dl-type`}>Vehicle Type<span className="text-destructive"> *</span></Label><Input id={`dl-type`} required placeholder="e.g. Light Vehicle" value={entry.vehicleType || ''} onChange={ev => setEntry(e => ({ ...e, vehicleType: ev.target.value }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor={`dl-no`}>License Number<span className="text-destructive"> *</span></Label><Input id={`dl-no`} required placeholder="e.g. 123456789" value={entry.licenseNumber || ''} onChange={ev => setEntry(e => ({ ...e, licenseNumber: ev.target.value }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor={`dl-issue`}>Issue Date<span className="text-destructive"> *</span></Label><Input id={`dl-issue`} type="date" required value={entry.issueDate || ''} onChange={ev => setEntry(e => ({ ...e, issueDate: ev.target.value }))} /></div>
                <div className="flex flex-col gap-1"><Label htmlFor={`dl-expiry`}>Expiry Date<span className="text-destructive"> *</span></Label><Input id={`dl-expiry`} type="date" required value={entry.expiryDate || ''} onChange={ev => setEntry(e => ({ ...e, expiryDate: ev.target.value }))} /></div>
                <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor={`dl-file`}>License Document</Label><Input id={`dl-file`} type="file" accept="image/*,application/pdf" multiple onChange={ev => { const files = Array.from(ev.target.files || []); setLicenseFiles(files); }} />
                {licenseFiles.length > 0 && (
                  <div className="mt-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {licenseFiles.map((f, idx) => {
                        const isImage = (f.type || '').startsWith('image/')
                        const isPdf = (f.type || '') === 'application/pdf' || /\.pdf$/i.test(f.name || '')
                        const url = URL.createObjectURL(f)
                        return (
                          <div key={idx} className="space-y-1">
                            {isImage ? (
                              <img src={url} alt="Selected attachment" className="w-full h-28 rounded object-cover bg-muted" />
                            ) : isPdf ? (
                              <iframe src={url} title="Selected PDF" className="w-full h-28 rounded" />
                            ) : (
                              <div className="w-full h-28 rounded bg-muted flex items-center justify-center text-sm">FILE</div>
                            )}
                            <div className="text-xs truncate" title={f.name}>{f.name}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {entry.attachmentUrl && licenseFiles.length === 0 && (
                  <div className="mt-3 space-y-2">
                    {String(entry.attachmentUrl).toLowerCase().includes('.pdf') ? (
                      <iframe src={String(entry.attachmentUrl)} title="License document" className="w-full h-64 rounded" />
                    ) : (
                      <img src={String(entry.attachmentUrl)} alt="License document" className="w-full max-h-64 rounded object-contain bg-muted" />
                    )}
                    <div className="flex gap-3">
                      <a href={String(entry.attachmentUrl)} target="_blank" rel="noreferrer" className="text-sm text-blue-600" aria-label="Open attachment">Open</a>
                      <a href={String(entry.attachmentUrl)} download className="text-sm text-blue-600" aria-label="Download attachment">Download</a>
                    </div>
                  </div>
                )}
                </div>
                {license && Array.isArray(license.attachments) && license.attachments.length > 0 && (
                  <div className="md:col-span-2">
                    <div className="text-sm text-muted-foreground mb-2">Existing Attachments</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {license.attachments.map((u, idx) => {
                        const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(u)
                        const isPdf = /\.(pdf)(\?|$)/i.test(u)
                        return (
                          <div key={idx} className="space-y-1">
                            {isImage ? (
                              <img src={u} alt="Attachment" className="w-full h-28 rounded object-cover bg-muted" />
                            ) : (
                              <div className="w-full h-28 rounded bg-muted flex items-center justify-center text-sm">{isPdf ? 'PDF' : 'FILE'}</div>
                            )}
                            <div className="flex gap-2">
                              <a href={u} download className="text-xs text-blue-600" aria-label="Download attachment">Download</a>
                              <a href={u} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground" aria-label="Open attachment">Open</a>
                              <button type="button" className="text-xs text-destructive" onClick={async () => {
                                try {
                                  const fd = new FormData()
                                  fd.set('removeAttachmentsUrls', JSON.stringify([u]))
                                  const res = await fetch(`/api/licenses/${license.id}`, { method: 'PUT', body: fd })
                                  const data = await res.json()
                                  const updated = data?.item as DriverLicense | undefined
                                  if (!updated) throw new Error('Invalid server response')
                                  setLicenses(prev => prev.map(x => x.id === license.id ? updated : x))
                                  setEntry(e => ({ ...e, attachments: updated.attachments, attachmentUrl: updated.attachmentUrl }))
                                  toast({ title: 'Attachment removed', description: (updated.licenseNumber || license.licenseNumber) })
                                } catch (err: any) {
                                  toast({ title: 'Remove failed', description: err?.message || 'Could not remove attachment.', variant: 'destructive' as any })
                                }
                              }}>Remove</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor={`dl-remarks`}>Remarks</Label><Textarea id={`dl-remarks`} value={entry.remarks || ''} onChange={ev => setEntry(e => ({ ...e, remarks: ev.target.value }))} /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={async () => {
            try {
              if (!selectedDriverId) {
                toast({ title: 'Missing required fields', description: 'Driver is required.' })
                return
              }
              const valid = (entry.vehicleType && entry.licenseNumber && entry.issueDate && entry.expiryDate) ? entry : null
              if (!valid) {
                toast({ title: 'Missing required fields', description: 'Add at least one complete license entry.' })
                return
              }
              const form = new FormData()
              form.set('driverId', selectedDriverId)
              form.set('vehicleType', String(valid.vehicleType))
              form.set('licenseNumber', String(valid.licenseNumber))
              form.set('issueDate', String(valid.issueDate))
              form.set('expiryDate', String(valid.expiryDate))
              if (entry.remarks) form.set('remarks', String(entry.remarks))
              if (licenseFiles.length) {
                for (const f of licenseFiles) form.append('attachments', f)
              }
              if (license) {
                const res = await fetch(`/api/licenses/${license.id}`, { method: 'PUT', body: form })
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}))
                  throw new Error(err?.error || 'Update failed')
                }
                const data = await res.json()
                const saved = data?.item as DriverLicense | undefined
                if (!saved) throw new Error('Invalid server response')
                setLicenses(prev => prev.map(x => x.id === license.id ? saved : x))
                toast({ title: 'License updated', description: `${saved.licenseNumber}` })
                onSaved?.()
              } else {
                const res = await fetch('/api/licenses', { method: 'POST', body: form })
                if (!res.ok) {
                  if (res.status === 403) {
                    throw new Error('Forbidden: you do not have permission to add licenses')
                  }
                  const err = await res.json().catch(() => ({}))
                  throw new Error(err?.error || 'Save failed')
                }
                const data = await res.json()
                const created = data?.item as DriverLicense | undefined
                if (!created) throw new Error('Invalid server response')
                setLicenses(prev => [created, ...prev])
                toast({ title: 'License saved', description: `${created.licenseNumber}` })
                onSaved?.()
              }
            } catch (e: any) {
              toast({ title: 'Save failed', description: e?.message || 'Could not save license.', variant: 'destructive' as any })
            }
          }}>
            <Plus className="h-4 w-4 mr-2" /> {license ? 'Update License' : 'Save License(s)'}
          </Button>
        </div>
      </div>
    )
  }

  function GatePassMaintenanceForm({ onSaved, gatePassId, record }: { onSaved?: () => void, gatePassId?: string, record?: GatePassMaintenanceRecord }) {
    const [form, setForm] = useState<Partial<GatePassMaintenanceRecord>>(() => {
      if (record) return { ...record };
      return { date: new Date().toISOString(), gatePassId } as Partial<GatePassMaintenanceRecord>;
    });
    const isEdit = !!record;
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-10 bg-background border-b py-3">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={() => {
              if (!form.gatePassId || !form.date || !form.type || !form.detail) {
                toast({ title: "Missing required fields", description: "Gate Pass, Date, Type, and Detail are required." });
                return;
              }
              if (isEdit && record) {
                const updated: GatePassMaintenanceRecord = {
                  id: record.id,
                  gatePassId: form.gatePassId!,
                  date: form.date!,
                  type: form.type!,
                  detail: form.detail!,
                  vendor: form.vendor || null,
                  cost: form.cost || null,
                  remarks: form.remarks || null,
                  attachmentUrl: form.attachmentUrl || null,
                };
                setGatePassMaintenances(prev => prev.map(r => r.id === record.id ? updated : r));
                toast({ title: "Maintenance updated", description: updated.type });
                onSaved?.();
              } else {
                const newRec: GatePassMaintenanceRecord = {
                  id: String(Date.now()),
                  gatePassId: form.gatePassId!,
                  date: form.date!,
                  type: form.type!,
                  detail: form.detail!,
                  vendor: form.vendor || null,
                  cost: form.cost || null,
                  remarks: form.remarks || null,
                  attachmentUrl: form.attachmentUrl || null,
                };
                setGatePassMaintenances(prev => [newRec, ...prev]);
                toast({ title: "Maintenance saved", description: newRec.type });
                onSaved?.();
              }
            }}>
              <Plus className="h-4 w-4 mr-2" /> {isEdit ? "Update Maintenance" : "Save Maintenance"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1"><Label htmlFor="gpmm-date">Date<span className="text-destructive"> *</span></Label><Input id="gpmm-date" type="date" value={(form.date || "").split("T")[0]} onChange={e => setForm(f => ({ ...f, date: new Date(e.target.value).toISOString() }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="gpmm-type">Type<span className="text-destructive"> *</span></Label><Input id="gpmm-type" placeholder="Renewal / Suspension / Note" value={form.type || ""} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} /></div>
          <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="gpmm-detail">Detail<span className="text-destructive"> *</span></Label><Input id="gpmm-detail" placeholder="Description" value={form.detail || ""} onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="gpmm-vendor">Vendor</Label><Input id="gpmm-vendor" placeholder="Optional" value={form.vendor || ""} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="gpmm-cost">Cost</Label><Input id="gpmm-cost" type="number" placeholder="Optional" value={(form.cost || 0) as any} onChange={e => setForm(f => ({ ...f, cost: Number(e.target.value || 0) }))} /></div>
          <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="gpmm-remarks">Remarks</Label><Input id="gpmm-remarks" placeholder="Optional" value={form.remarks || ""} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
          <div className="flex flex-col gap-1 md:col-span-2"><Label htmlFor="gpmm-attachment">Attachment</Label><Input id="gpmm-attachment" type="file" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0] || null; setAttachmentFile(f); }} />
            {(attachmentFile || form.attachmentUrl) && (
              <div className="mt-3">
                {attachmentFile ? (
                  attachmentFile.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(attachmentFile)} alt="Attachment preview" className="w-full max-h-64 rounded object-contain" />
                  ) : (
                    <iframe src={URL.createObjectURL(attachmentFile)} title="Attachment preview" className="w-full h-64 rounded" />
                  )
                ) : (
                  (String(form.attachmentUrl).toLowerCase().endsWith('.pdf')) ? (
                    <iframe src={String(form.attachmentUrl)} title="Attachment" className="w-full h-64 rounded" />
                  ) : (
                    <img src={String(form.attachmentUrl)} alt="Attachment" className="w-full max-h-64 rounded object-contain" />
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="vehicle">
        <div className="flex items-center">
          <TabsList>
            <TabsTrigger value="vehicle" className={vehicleAlert ? "text-destructive" : undefined} aria-label={vehicleAlert ? "Vehicle has expiries" : undefined}>Vehicle ({filteredVehicles.length})</TabsTrigger>
            <TabsTrigger value="mhe" className={mheAlert ? "text-destructive" : undefined} aria-label={mheAlert ? "MHE has expiries" : undefined}>MHE ({filteredMhes.length})</TabsTrigger>
            <TabsTrigger value="gatepass" className={gatePassAlert ? "text-destructive" : undefined} aria-label={gatePassAlert ? "Gate Passes have expiries" : undefined}>Gate Passes ({filteredGatePasses.length})</TabsTrigger>
            
          </TabsList>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search..." className="pl-8 sm:w-[300px]" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-1">
                  <ListFilter className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Filter</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={branchFilter} onValueChange={setBranchFilter}>
                  <DropdownMenuRadioItem value="all">All Branches</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Riffa">Riffa</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Sitra">Sitra</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={ownershipFilter} onValueChange={setOwnershipFilter}>
                  <DropdownMenuRadioItem value="all">All Ownership</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Owned">Owned</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Hired">Hired</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                  <DropdownMenuRadioItem value="all">All Status</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="active">Active</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="soon">Expiring Soon</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="expired">Expired</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <TabsContent value="vehicle">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">Vehicle Maintenance</CardTitle>
                  <CardDescription>Manage vehicle details, service, and expiry alerts.</CardDescription>
                </div>
                <Dialog open={addVehicleOpen} onOpenChange={setAddVehicleOpen}>
                  <DialogTrigger asChild>
                    {/* Permission: maintenance:add or Admin */}
                    <MaintenanceActionButton action="add" size="sm" label="Add Vehicle">
                      <Plus className="h-4 w-4 mr-2" /> Add Vehicle
                    </MaintenanceActionButton>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-[1400px] h-[90vh] overflow-y-auto p-4">
                    <DialogHeader>
                      <DialogTitle>Add Vehicle</DialogTitle>
                    </DialogHeader>
            <VehicleFormPro onSaved={() => { setAddVehicleOpen(false); }} />
                  </DialogContent>
                </Dialog>
                {/* Removed global Add Maintenance; moved to per-vehicle actions */}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Plate No</TableHead>
                    <TableHead>Vehicle Details</TableHead>
                    <TableHead>Driver Name</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Insurance</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Next Service</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.map(v => {
                    const ins = expiryStatus(v.insuranceExpiry);
                    const reg = expiryStatus(v.registrationExpiry);
                    const insDays = daysUntil(v.insuranceExpiry);
                    const regDays = daysUntil(v.registrationExpiry);
                    const svcDays = daysUntil(v.nextServiceDueDate);
                    const svcSoon = svcDays != null && svcDays >= 0 && svcDays <= 60;
                    const expiringSoon = ins.label === 'Expiring Soon' || reg.label === 'Expiring Soon' || svcSoon;
                    return (
                      <TableRow
                        key={v.id}
                        className={cn(
                          ((v.status || "Active") !== "Active") ? "bg-orange-50 hover:bg-orange-100" : undefined,
                          expiringSoon ? "bg-yellow-50 hover:bg-yellow-100" : undefined
                        )}
                        onClick={() => setSelectedVehicleId(v.id)}
                      >
                        <TableCell>
                          {v.imageUrl ? (
                            <img src={v.imageUrl} alt={v.plateNo || v.vehicleType || "Vehicle"} className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs">No</div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{v.plateNo || '-'}</TableCell>
                        <TableCell>{[v.make, v.model, v.year ? String(v.year) : undefined].filter(Boolean).join(' ') || '-'}</TableCell>
                        <TableCell>{v.driverName || '-'}</TableCell>
                        <TableCell>{v.branch || '-'}</TableCell>
                        <TableCell className={((v.status || "Active") !== "Active") ? "text-orange-700 font-medium" : undefined}>{v.status || "Active"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant={ins.variant} aria-label={`Insurance ${ins.label}`}>{ins.label}</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {v.insuranceExpiry ? `Insurance expiry: ${new Date(v.insuranceExpiry).toLocaleDateString()}` : 'No insurance expiry date'}
                              </TooltipContent>
                            </Tooltip>
                            {insDays != null && insDays >= 0 && insDays <= 60 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="destructive" aria-label={`Insurance due in ${insDays} days`}>{insDays}d</Badge>
                                </TooltipTrigger>
                                <TooltipContent>{`Insurance due in ${insDays} day${insDays === 1 ? '' : 's'}`}</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant={reg.variant} aria-label={`Registration ${reg.label}`}>{reg.label}</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {v.registrationExpiry ? `Registration expiry: ${new Date(v.registrationExpiry).toLocaleDateString()}` : 'No registration expiry date'}
                              </TooltipContent>
                            </Tooltip>
                            {regDays != null && regDays >= 0 && regDays <= 60 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="destructive" aria-label={`Registration due in ${regDays} days`}>{regDays}d</Badge>
                                </TooltipTrigger>
                                <TooltipContent>{`Registration due in ${regDays} day${regDays === 1 ? '' : 's'}`}</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  {(v.nextServiceDueKm ?? '-') + ' km' }{' • '}{v.nextServiceDueDate ? new Date(v.nextServiceDueDate).toLocaleDateString() : '-'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {v.nextServiceDueDate ? `Next service: ${new Date(v.nextServiceDueDate).toLocaleDateString()}` : 'No next service date'}
                              </TooltipContent>
                            </Tooltip>
                            {svcDays != null && (
                              svcDays < 0
                                ? (<Badge variant="destructive" aria-label="Service expired">Expired</Badge>)
                                : (svcDays <= 60 ? (<Badge variant="destructive" aria-label={`Service due in ${svcDays} days`}>{svcDays}d</Badge>) : null)
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="Open actions">
                                      <MoreHorizontal className="h-5 w-5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Vehicle actions</TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => { setEditingVehicleId(v.id); }} aria-label="Edit Vehicle">
                                  <Edit className="mr-2 h-4 w-4 text-blue-600" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { setMaintenanceVehicleId(v.id); }} aria-label="Open Maintenance">
                                  <Wrench className="mr-2 h-4 w-4 text-orange-600" />
                                  Maintenance
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => { setDeleteVehicleId(v.id); }} className="text-red-600" aria-label="Delete Vehicle">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Edit Vehicle Dialog (controlled) */}
                            <Dialog open={editingVehicleId === v.id} onOpenChange={(open) => setEditingVehicleId(open ? v.id : null)}>
                              <DialogContent className="w-[95vw] max-w-[1400px] h-[90vh] overflow-y-auto p-4">
                                <DialogHeader>
                                  <DialogTitle>Edit Vehicle</DialogTitle>
                                </DialogHeader>
                                <VehicleFormPro vehicle={v} onSaved={() => { setEditingVehicleId(null); }} />
                              </DialogContent>
                            </Dialog>

                            {/* Maintenance Dialog (controlled) */}
                            <Dialog open={maintenanceVehicleId === v.id} onOpenChange={(open) => setMaintenanceVehicleId(open ? v.id : null)}>
                              <DialogContent className="w-[95vw] max-w-[1400px] h-[90vh] overflow-y-auto p-4">
                                <DialogHeader>
                                  <DialogTitle>Maintenance — {v.plateNo || v.vehicleType || v.id}</DialogTitle>
                                </DialogHeader>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="md:sticky md:top-0">
                                    <Card>
                                      <CardHeader>
                                        <CardTitle>Add Maintenance</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <VehicleMaintenanceForm vehicleId={v.id} onSaved={() => { /* form clears via internal reset; list will reflect updated state */ }} />
                                      </CardContent>
                                    </Card>
                                  </div>
                                  <div>
                                    <Card>
                                      <CardHeader>
                                        <CardTitle>Records</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Date</TableHead>
                                              <TableHead>Type</TableHead>
                                              <TableHead>Vendor</TableHead>
                                              <TableHead>Cost</TableHead>
                                              <TableHead>Next (Km)</TableHead>
                                              <TableHead>Next (Date)</TableHead>
                                              <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {vehicleMaintenances.filter(r => r.vehicleId === v.id).map(rec => (
                                              <TableRow key={rec.id}>
                                                <TableCell>{rec.date ? new Date(rec.date).toLocaleDateString() : '-'}</TableCell>
                                                <TableCell>{rec.type}</TableCell>
                                                <TableCell>{rec.vendor || '-'}</TableCell>
                                                <TableCell>{rec.cost ?? '-'}</TableCell>
                                                <TableCell>{rec.nextServiceDueKm ?? '-'}</TableCell>
                                                <TableCell>{rec.nextServiceDueDate ? new Date(rec.nextServiceDueDate).toLocaleDateString() : '-'}</TableCell>
                                                <TableCell className="text-right">
                                                  <div className="flex justify-end gap-2">
                                                    <Dialog>
                                                      <DialogTrigger asChild>
                                                        <Button variant="outline" size="icon" aria-label="Edit" title="Edit">
                                                          <Edit className="h-4 w-4" />
                                                        </Button>
                                                      </DialogTrigger>
                                                      <DialogContent className="w-[85vw] max-w-[900px] max-h-[80vh] overflow-y-auto">
                                                        <DialogHeader>
                                                          <DialogTitle>Edit Maintenance</DialogTitle>
                                                        </DialogHeader>
                                                        <VehicleMaintenanceForm vehicleId={v.id} record={rec} onSaved={() => { /* auto close by Dialog */ }} />
                                                      </DialogContent>
                                                    </Dialog>
                                                    <AlertDialog>
                                                      <AlertDialogTrigger asChild>
                                                        {/* Permission: maintenance:delete or Admin */}
                                                        <MaintenanceActionButton action="delete" variant="destructive" size="icon" aria-label="Delete" title="Delete">
                                                          <Trash2 className="h-4 w-4" />
                                                        </MaintenanceActionButton>
                                                      </AlertDialogTrigger>
                                                      <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                          <AlertDialogTitle>Delete Maintenance</AlertDialogTitle>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                          <AlertDialogAction onClick={() => {
                                                            setVehicleMaintenances(prev => prev.filter(x => x.id !== rec.id));
                                                            toast({ title: "Maintenance deleted", description: `${v.plateNo || v.vehicleType || v.id} • ${rec.type}` });
                                                          }}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                      </AlertDialogContent>
                                                    </AlertDialog>
                                                  </div>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </CardContent>
                                    </Card>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            {/* Delete Vehicle Dialog (controlled) */}
                            <AlertDialog open={deleteVehicleId === v.id} onOpenChange={(open) => setDeleteVehicleId(open ? v.id : null)}>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/vehicles/${v.id}`, { method: 'DELETE' });
                                      if (!res.ok) {
                                        const j = await res.json().catch(() => ({}));
                                        throw new Error(String(j?.error || res.statusText));
                                      }
                                      setVehicles(prev => prev.filter(x => x.id !== v.id));
                                      toast({ title: "Vehicle deleted", description: v.plateNo || v.vehicleType || v.id });
                                    } catch (e: any) {
                                      toast({ title: "Delete failed", description: e?.message || "Server error", variant: "destructive" as any });
                                    }
                                  }}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          <DetailedModal
                            open={selectedVehicleId === v.id}
                            onOpenChange={(open) => setSelectedVehicleId(open ? v.id : null)}
                            title={`${v.plateNo || v.vehicleType || v.id}`}
                            footer={(
                              <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setEditingVehicleId(v.id)}>
                                  <Edit className="h-4 w-4 mr-2" /> Edit
                                </Button>
                                <Button variant="outline" onClick={() => setMaintenanceVehicleId(v.id)}>
                                  <Wrench className="h-4 w-4 mr-2" /> Maintenance
                                </Button>
                              </div>
                            )}
                          >
                            <div className="mb-4 rounded overflow-hidden">
                              {v.imageUrl ? (
                                <img
                                  src={v.imageUrl}
                                  alt="Vehicle"
                                  className="block w-full h-auto max-h-[55vh] object-contain"
                                />
                              ) : (
                                <div className="h-32 md:h-40 w-full bg-muted flex items-center justify-center text-sm text-muted-foreground">No image</div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                              <div className="rounded border p-3">
                                <div className="text-xs text-muted-foreground">Status</div>
                                <div className="font-medium">{v.status || 'Active'}</div>
                              </div>
                              <div className="rounded border p-3">
                                <div className="text-xs text-muted-foreground">Insurance</div>
                                <div><Badge variant={expiryStatus(v.insuranceExpiry).variant}>{expiryStatus(v.insuranceExpiry).label}</Badge></div>
                              </div>
                              <div className="rounded border p-3">
                                <div className="text-xs text-muted-foreground">Registration</div>
                                <div><Badge variant={expiryStatus(v.registrationExpiry).variant}>{expiryStatus(v.registrationExpiry).label}</Badge></div>
                              </div>
                              <div className="rounded border p-3">
                                <div className="text-xs text-muted-foreground">Next Service</div>
                                <div className="font-medium">{(v.nextServiceDueKm ?? '-') + ' km'} • {v.nextServiceDueDate ? new Date(v.nextServiceDueDate).toLocaleDateString() : '-'}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="font-medium">Identification</div>
                                <div>Plate: {v.plateNo || '-'}</div>
                                <div>Type: {v.vehicleType || '-'}</div>
                                <div>Make/Model/Year: {[v.make, v.model, v.year ? String(v.year) : undefined].filter(Boolean).join(' ') || '-'}</div>
                                <div>Branch: {v.branch || '-'}</div>
                                <div>Ownership: {v.ownership}</div>
                              </div>
                              <div className="space-y-2">
                                <div className="font-medium">Details</div>
                                <div>Insurance Expiry: {v.insuranceExpiry ? new Date(v.insuranceExpiry).toLocaleDateString() : '-'}</div>
                                <div>Registration Expiry: {v.registrationExpiry ? new Date(v.registrationExpiry).toLocaleDateString() : '-'}</div>
                                <div>Last Odometer: {v.lastOdometerReading ?? '-'}</div>
                                <div>Fuel Type: {v.fuelType || '-'}</div>
                              </div>
                              
                              <div className="md:col-span-2 space-y-2">
                                <div className="font-medium">Personnel</div>
                                <div>Driver: {v.driverName || '-'}</div>
                                <div>Driver Contact: {v.driverContact || '-'}</div>
                              </div>
                              {Array.isArray(v.attachments) && v.attachments.length > 0 && (
                                <div className="md:col-span-2 space-y-2">
                                  <div className="font-medium">Vehicle Attachments</div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {v.attachments.map((url, idx) => (
                                      String(url).toLowerCase().endsWith('.pdf') ? (
                                        <div key={idx} className="space-y-2">
                                          <iframe src={String(url)} title="Attachment" className="w-full h-40 rounded" />
                                          <a href={String(url)} download className="text-xs underline">Download</a>
                                        </div>
                                      ) : (
                                        <div key={idx} className="space-y-2">
                                          <img src={String(url)} alt="Attachment" className="w-full h-40 rounded object-contain bg-muted" />
                                          <a href={String(url)} download className="text-xs underline">Download</a>
                                        </div>
                                      )
                                    ))}
                                  </div>
                                </div>
                              )}
          <div className="md:col-span-2 space-y-2">
            <div className="font-medium">Maintenance History</div>
            <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Date</TableHead>
                                      <TableHead>Type</TableHead>
                                      <TableHead>Vendor</TableHead>
                                      <TableHead>Cost</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {vehicleMaintenances.filter(r => r.vehicleId === v.id).map(rec => (
                                      <TableRow key={rec.id}>
                                        <TableCell>{rec.date ? new Date(rec.date).toLocaleDateString() : '-'}</TableCell>
                                        <TableCell>{rec.type}</TableCell>
                                        <TableCell>{rec.vendor || '-'}</TableCell>
                                        <TableCell>{rec.cost ?? '-'}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
            </Table>
          </div>
          <div className="md:col-span-2 space-y-2">
            <div className="font-medium">Maintenance Attachments</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {vehicleMaintenances.filter(r => r.vehicleId === v.id && r.attachmentUrl).map(rec => (
                String(rec.attachmentUrl).toLowerCase().endsWith('.pdf') ? (
                  <iframe key={rec.id} src={String(rec.attachmentUrl)} title="Attachment" className="w-full h-40 rounded" />
                ) : (
                  <img key={rec.id} src={String(rec.attachmentUrl)} alt="Attachment" className="w-full h-40 rounded object-contain bg-muted" />
                )
              ))}
              {vehicleMaintenances.filter(r => r.vehicleId === v.id && r.attachmentUrl).length === 0 && (
                <div className="text-sm text-muted-foreground">No attachments</div>
              )}
            </div>
          </div>
                            </div>
                          </DetailedModal>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Removed standalone Maintenance Records section; handled per-vehicle in Actions */}
        </TabsContent>

        <TabsContent value="mhe">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>MHE (Material Handling Equipment)</CardTitle>
                  <CardDescription>Track certifications, batteries, and repairs.</CardDescription>
                </div>
                <Dialog open={addMheOpen} onOpenChange={setAddMheOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" /> Add MHE
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-[1400px] h-[90vh] overflow-y-auto p-4">
                    <DialogHeader>
                      <DialogTitle>Add MHE</DialogTitle>
                    </DialogHeader>
                    <MheFormPro onSaved={() => { setAddMheOpen(false); }} />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cert Type</TableHead>
                    <TableHead>Cert Vendor</TableHead>
                    <TableHead>Cert Status</TableHead>
                    <TableHead>Battery</TableHead>
                    <TableHead>Voltage</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMhes.map(m => {
                    const cert = m.certification;
                    const stat = expiryStatus(cert?.expiry);
                    return (
                      <TableRow
                        key={m.id}
                        className={((m.status || "Active") !== "Active") ? "bg-orange-50 hover:bg-orange-100" : undefined}
                        onClick={() => setSelectedMheId(m.id)}
                      >
                        <TableCell>
                          {m.imageUrl ? (
                            <img src={m.imageUrl} alt={m.equipmentInfo} className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs">No</div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{m.equipmentInfo}</TableCell>
                        <TableCell className={((m.status || "Active") !== "Active") ? "text-orange-700 font-medium" : undefined}>{m.status || "Active"}</TableCell>
                        <TableCell>{cert?.type || '-'}</TableCell>
                        <TableCell>{cert?.vendor || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={stat.variant}>{stat.label}</Badge>
                        </TableCell>
                        <TableCell>{m.battery?.type || '-'}</TableCell>
                        <TableCell>{m.battery?.voltage || '-'}</TableCell>
                        <TableCell>{m.battery?.size || '-'}</TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="Open actions">
                                      <MoreHorizontal className="h-5 w-5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>MHE actions</TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => { setEditingMheId(m.id); }} aria-label="Edit MHE">
                                  <Edit className="mr-2 h-4 w-4 text-blue-600" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { setMaintenanceMheId(m.id); }} aria-label="Open Maintenance">
                                  <Wrench className="mr-2 h-4 w-4 text-orange-600" />
                                  Maintenance
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => { setDeleteMheId(m.id); }} className="text-red-600" aria-label="Delete MHE">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <Dialog open={editingMheId === m.id} onOpenChange={(open) => setEditingMheId(open ? m.id : null)}>
                              <DialogContent className="w-[95vw] max-w-[1400px] h-[90vh] overflow-y-auto p-4">
                                <DialogHeader>
                                  <DialogTitle>Edit MHE</DialogTitle>
                                </DialogHeader>
                                <MheFormPro mhe={m} onSaved={() => { setEditingMheId(null); }} />
                              </DialogContent>
                            </Dialog>

                            <Dialog open={maintenanceMheId === m.id} onOpenChange={(open) => setMaintenanceMheId(open ? m.id : null)}>
                              <DialogContent className="w-[95vw] max-w-[1400px] h-[90vh] overflow-y-auto p-4">
                                <DialogHeader>
                                  <DialogTitle>Maintenance — {m.equipmentInfo || m.id}</DialogTitle>
                                </DialogHeader>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="md:sticky md:top-0">
                                    <Card>
                                      <CardHeader>
                                        <CardTitle>Add Maintenance</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <MheMaintenanceForm mheId={m.id} onSaved={() => { /* updates list via state */ }} />
                                      </CardContent>
                                    </Card>
                                  </div>
                                  <div>
                                    <Card>
                                      <CardHeader>
                                        <CardTitle>Records</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Date</TableHead>
                                              <TableHead>Type</TableHead>
                                              <TableHead>Vendor</TableHead>
                                              <TableHead>Cost</TableHead>
                                              <TableHead>Next (Date)</TableHead>
                                              <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {mheMaintenances.filter(r => r.mheId === m.id).map(rec => (
                                              <TableRow key={rec.id}>
                                                <TableCell>{rec.date ? new Date(rec.date).toLocaleDateString() : '-'}</TableCell>
                                                <TableCell>{rec.type}</TableCell>
                                                <TableCell>{rec.vendor || '-'}</TableCell>
                                                <TableCell>{rec.cost ?? '-'}</TableCell>
                                                <TableCell>{rec.nextServiceDueDate ? new Date(rec.nextServiceDueDate).toLocaleDateString() : '-'}</TableCell>
                                                <TableCell className="text-right">
                                                  <div className="flex justify-end gap-2">
                                                    <Dialog>
                                                      <DialogTrigger asChild>
                                                        <Button variant="outline" size="icon" aria-label="Edit" title="Edit">
                                                          <Edit className="h-4 w-4" />
                                                        </Button>
                                                      </DialogTrigger>
                                                      <DialogContent className="w-[85vw] max-w-[900px] max-h-[80vh] overflow-y-auto">
                                                        <DialogHeader>
                                                          <DialogTitle>Edit Maintenance</DialogTitle>
                                                        </DialogHeader>
                                                        <MheMaintenanceForm mheId={m.id} record={rec} onSaved={() => { /* auto close by Dialog */ }} />
                                                      </DialogContent>
                                                    </Dialog>
                                                    <AlertDialog>
                                                      <AlertDialogTrigger asChild>
                                                        {/* Permission: maintenance:delete or Admin */}
                                                        <MaintenanceActionButton action="delete" variant="destructive" size="icon" aria-label="Delete" title="Delete">
                                                          <Trash2 className="h-4 w-4" />
                                                        </MaintenanceActionButton>
                                                      </AlertDialogTrigger>
                                                      <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                          <AlertDialogTitle>Delete Maintenance</AlertDialogTitle>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                          <AlertDialogAction onClick={() => {
                                                            setMheMaintenances(prev => prev.filter(x => x.id !== rec.id));
                                                            toast({ title: "Maintenance deleted", description: `${m.equipmentInfo || m.id} • ${rec.type}` });
                                                          }}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                      </AlertDialogContent>
                                                    </AlertDialog>
                                                  </div>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </CardContent>
                                    </Card>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <AlertDialog open={deleteMheId === m.id} onOpenChange={(open) => setDeleteMheId(open ? m.id : null)}>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete MHE</AlertDialogTitle>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/mhes/${m.id}`, { method: 'DELETE' });
                                      if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
                                      setMhes(prev => prev.filter(x => x.id !== m.id));
                                      toast({ title: "MHE deleted", description: m.equipmentInfo });
                                    } catch (e) {
                                      console.warn(e);
                                      toast({ title: 'Delete failed', description: 'Could not delete MHE.', variant: 'destructive' as any });
                                    }
                                  }}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <DetailedModal
                              open={selectedMheId === m.id}
                              onOpenChange={(open) => setSelectedMheId(open ? m.id : null)}
                              title={`${m.equipmentInfo || m.id}`}
                              footer={(
                                <div className="flex gap-2">
                                  <Button variant="outline" onClick={() => setEditingMheId(m.id)}>
                                    <Edit className="h-4 w-4 mr-2" /> Edit
                                  </Button>
                                  <Button variant="outline" onClick={() => setMaintenanceMheId(m.id)}>
                                    <Wrench className="h-4 w-4 mr-2" /> Maintenance
                                  </Button>
                                </div>
                              )}
                            >
                              {m.imageUrl ? (
                                <img src={m.imageUrl} alt="MHE" className="w-full h-56 md:h-72 rounded object-cover mb-4" />
                              ) : (
                                <div className="mb-4 h-32 md:h-40 w-full rounded bg-muted flex items-center justify-center text-sm text-muted-foreground">No image</div>
                              )}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                <div className="rounded border p-3">
                                  <div className="text-xs text-muted-foreground">Status</div>
                                  <div className="font-medium">{m.status || 'Active'}</div>
                                </div>
                                <div className="rounded border p-3">
                                  <div className="text-xs text-muted-foreground">Cert Status</div>
                                  <div><Badge variant={expiryStatus(m.certification?.expiry).variant}>{expiryStatus(m.certification?.expiry).label}</Badge></div>
                                </div>
                                <div className="rounded border p-3">
                                  <div className="text-xs text-muted-foreground">Cert Expiry</div>
                                  <div className="font-medium">{m.certification?.expiry ? new Date(m.certification.expiry).toLocaleDateString() : '-'}</div>
                                </div>
                                <div className="rounded border p-3">
                                  <div className="text-xs text-muted-foreground">Battery</div>
                                  <div className="font-medium">{[m.battery?.type, m.battery?.voltage, m.battery?.size].filter(Boolean).join(' • ') || '-'}</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <div className="font-medium">Identification</div>
                                  <div>Equipment: {m.equipmentInfo}</div>
                                  <div>Model: {m.modelNo || '-'}</div>
                                  <div>Serial: {m.serialNo || '-'}</div>
                                </div>
                                <div className="space-y-2">
                                  <div className="font-medium">Certification</div>
                                  <div>Type: {m.certification?.type || '-'}</div>
                                  <div>Vendor: {m.certification?.vendor || '-'}</div>
                                  <div>Certificate No: {m.certification?.certificateNo || '-'}</div>
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                  <div className="font-medium">Battery</div>
                                  <div>{[m.battery?.type, m.battery?.voltage, m.battery?.size].filter(Boolean).join(' • ') || '-'}</div>
                                </div>
                                
                                <div className="md:col-span-2 space-y-2">
                                  <div className="font-medium">Maintenance History</div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>Cost</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {mheMaintenances.filter(r => r.mheId === m.id).map(rec => (
                                        <TableRow key={rec.id}>
                                          <TableCell>{rec.date ? new Date(rec.date).toLocaleDateString() : '-'}</TableCell>
                                          <TableCell>{rec.type}</TableCell>
                                          <TableCell>{rec.vendor || '-'}</TableCell>
                                          <TableCell>{rec.cost ?? '-'}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </DetailedModal>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      <TabsContent value="gatepass">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Customer Gate Pass Tracker</CardTitle>
                  <CardDescription>Track passes and expiry alerts.</CardDescription>
                </div>
                <Dialog open={addGatePassOpen} onOpenChange={setAddGatePassOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" /> Add Gate Pass
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-[1400px] h-[90vh] overflow-y-auto p-4">
                    <DialogHeader>
                      <DialogTitle>Add Gate Pass</DialogTitle>
                    </DialogHeader>
                    <GatePassFormPro onSaved={() => { setAddGatePassOpen(false); }} />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Pass No</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGatePasses.map(g => {
                    const st = expiryStatus(g.expiryDate);
                    return (
                      <TableRow
                        key={g.id}
                        className={((g.status || "Active") !== "Active") ? "bg-orange-50 hover:bg-orange-100" : undefined}
                        onClick={(e) => { if ((e as any).defaultPrevented) return; setSelectedGatePassId(g.id); }}
                      >
                        <TableCell className="font-medium">{g.customerName}</TableCell>
                        <TableCell>{g.location}</TableCell>
                        <TableCell>{g.passNumber}</TableCell>
                        <TableCell className={((g.status || "Active") !== "Active") ? "text-orange-700 font-medium" : undefined}>{g.status || "Active"}</TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="Open actions">
                                      <MoreHorizontal className="h-5 w-5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Gate Pass actions</TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => { setEditingGatePassId(g.id); }} aria-label="Edit Gate Pass">
                                  <Edit className="mr-2 h-4 w-4 text-blue-600" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { setMaintenanceGatePassId(g.id); }} aria-label="Open Maintenance">
                                  <Wrench className="mr-2 h-4 w-4 text-orange-600" />
                                  Maintenance
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => { setDeleteGatePassId(g.id); }} className="text-red-600" aria-label="Delete Gate Pass">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Dialog open={editingGatePassId === g.id} onOpenChange={(open) => setEditingGatePassId(open ? g.id : null)}>
                            <DialogContent className="w-[95vw] max-w-[1400px] h-[90vh] overflow-y-auto p-4">
                              <DialogHeader>
                                <DialogTitle>Edit Gate Pass</DialogTitle>
                              </DialogHeader>
                                <GatePassFormPro gatePass={g} onSaved={() => { setEditingGatePassId(null); }} />
                              </DialogContent>
                            </Dialog>
                            <Dialog open={maintenanceGatePassId === g.id} onOpenChange={(open) => setMaintenanceGatePassId(open ? g.id : null)}>
                              <DialogContent className="w-[95vw] max-w-[1400px] h-[90vh] overflow-y-auto p-4">
                                <DialogHeader>
                                  <DialogTitle>Maintenance — {g.passNumber}</DialogTitle>
                                </DialogHeader>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="md:sticky md:top-0">
                                    <Card>
                                      <CardHeader>
                                        <CardTitle>Add Maintenance</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <GatePassMaintenanceForm gatePassId={g.id} onSaved={() => { setMaintenanceGatePassId(null); }} />
                                      </CardContent>
                                    </Card>
                                  </div>
                                  <div>
                                    <Card>
                                      <CardHeader>
                                        <CardTitle>Records</CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Date</TableHead>
                                              <TableHead>Type</TableHead>
                                              <TableHead>Vendor</TableHead>
                                              <TableHead>Cost</TableHead>
                                              <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {gatePassMaintenances.filter(r => r.gatePassId === g.id).map(rec => (
                                              <TableRow key={rec.id}>
                                                <TableCell>{rec.date ? new Date(rec.date).toLocaleDateString() : '-'}</TableCell>
                                                <TableCell>{rec.type}</TableCell>
                                                <TableCell>{rec.vendor || '-'}</TableCell>
                                                <TableCell>{rec.cost ?? '-'}</TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                                                    <Dialog>
                                                      <DialogTrigger asChild>
                                                        <Button variant="outline" size="icon" aria-label="Edit" title="Edit">
                                                          <Edit className="h-4 w-4" />
                                                        </Button>
                                                      </DialogTrigger>
                                                      <DialogContent className="w-[85vw] max-w-[900px] max-h-[80vh] overflow-y-auto">
                                                        <DialogHeader>
                                                          <DialogTitle>Edit Maintenance</DialogTitle>
                                                        </DialogHeader>
                                                        <GatePassMaintenanceForm gatePassId={g.id} record={rec} onSaved={() => { setMaintenanceGatePassId(null); }} />
                                                      </DialogContent>
                                                    </Dialog>
                                                    <AlertDialog>
                                                      <AlertDialogTrigger asChild>
                                                        {/* Permission: maintenance:delete or Admin */}
                                                        <MaintenanceActionButton action="delete" variant="destructive" size="icon" aria-label="Delete" title="Delete">
                                                          <Trash2 className="h-4 w-4" />
                                                        </MaintenanceActionButton>
                                                      </AlertDialogTrigger>
                                                      <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                          <AlertDialogTitle>Delete Maintenance</AlertDialogTitle>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                          <AlertDialogAction onClick={() => {
                                                            setGatePassMaintenances(prev => prev.filter(x => x.id !== rec.id));
                                                            toast({ title: "Maintenance deleted", description: `${g.passNumber} • ${rec.type}` });
                                                          }}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                      </AlertDialogContent>
                                                    </AlertDialog>
                                                  </div>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </CardContent>
                                    </Card>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <AlertDialog open={deleteGatePassId === g.id} onOpenChange={(open) => setDeleteGatePassId(open ? g.id : null)}>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Gate Pass</AlertDialogTitle>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/gatepasses/${g.id}`, { method: 'DELETE' });
                                      if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
                                      setGatePasses(prev => prev.filter(x => x.id !== g.id));
                                      toast({ title: "Gate Pass deleted", description: g.passNumber });
                                    } catch (e) {
                                      console.warn(e);
                                      toast({ title: 'Delete failed', description: 'Could not delete Gate Pass.', variant: 'destructive' as any });
                                    }
                                  }}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <DetailedModal
                              open={selectedGatePassId === g.id}
                              onOpenChange={(open) => setSelectedGatePassId(open ? g.id : null)}
                              title={`${g.passNumber}`}
                              footer={(
                                <div className="flex gap-2">
                                  <Button variant="outline" onClick={() => setEditingGatePassId(g.id)}>
                                    <Edit className="h-4 w-4 mr-2" /> Edit
                                  </Button>
                                  <Button variant="outline" onClick={() => setMaintenanceGatePassId(g.id)}>
                                    <Wrench className="h-4 w-4 mr-2" /> Maintenance
                                  </Button>
                                </div>
                              )}
                            >
                              {g.attachment ? (
                                <img src={g.attachment} alt="Attachment" className="w-full h-56 md:h-72 rounded object-cover mb-4" />
                              ) : (
                                <div className="mb-4 h-32 md:h-40 w-full rounded bg-muted flex items-center justify-center text-sm text-muted-foreground">No attachment</div>
                              )}
                              {Array.isArray((g as any).attachments) && (g as any).attachments.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                  {(g as any).attachments.map((url: string, idx: number) => (
                                    String(url).toLowerCase().endsWith('.pdf') ? (
                                      <iframe key={idx} src={String(url)} title="Attachment" className="w-full h-40 rounded" />
                                    ) : (
                                      <img key={idx} src={String(url)} alt="Attachment" className="w-full h-40 rounded object-contain bg-muted" />
                                    )
                                  ))}
                                </div>
                              )}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                <div className="rounded border p-3">
                                  <div className="text-xs text-muted-foreground">Status</div>
                                  <div className="font-medium">{g.status || 'Active'}</div>
                                </div>
                                <div className="rounded border p-3">
                                  <div className="text-xs text-muted-foreground">Expiry</div>
                                  <div><Badge variant={expiryStatus(g.expiryDate).variant}>{expiryStatus(g.expiryDate).label}</Badge></div>
                                </div>
                                <div className="rounded border p-3">
                                  <div className="text-xs text-muted-foreground">Vehicle</div>
                                  <div className="font-medium">{vehicles.find(v => v.id === g.vehicleId)?.plateNo || vehicles.find(v => v.id === g.vehicleId)?.vehicleType || g.vehicleId || '-'}</div>
                                </div>
                                <div className="rounded border p-3">
                                  <div className="text-xs text-muted-foreground">Driver</div>
                                  <div className="font-medium">{g.driverName || '-'}</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <div className="font-medium">Identification</div>
                                  <div>Customer: {g.customerName}</div>
                                  <div>Location: {g.location}</div>
                                  <div>Pass Number: {g.passNumber}</div>
                                </div>
                                <div className="space-y-2">
                                  <div className="font-medium">Dates</div>
                                  <div>Issue Date: {g.issueDate ? new Date(g.issueDate).toLocaleDateString() : '-'}</div>
                                  <div>Expiry Date: {g.expiryDate ? new Date(g.expiryDate).toLocaleDateString() : '-'}</div>
                                </div>
                                
                                <div className="md:col-span-2 space-y-2">
                                  <div className="font-medium">Associated</div>
                                  <div>Vehicle: {vehicles.find(v => v.id === g.vehicleId)?.plateNo || vehicles.find(v => v.id === g.vehicleId)?.vehicleType || g.vehicleId || '-'}</div>
                                  <div>Driver: {g.driverName || '-'}</div>
                                </div>
          <div className="md:col-span-2 space-y-2">
            <div className="font-medium">History</div>
            <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>Cost</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {gatePassMaintenances.filter(r => r.gatePassId === g.id).map(rec => (
                                        <TableRow key={rec.id}>
                                          <TableCell>{rec.date ? new Date(rec.date).toLocaleDateString() : '-'}</TableCell>
                                          <TableCell>{rec.type}</TableCell>
                                          <TableCell>{rec.vendor || '-'}</TableCell>
                                          <TableCell>{rec.cost ?? '-'}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
            </Table>
          </div>
          <div className="md:col-span-2 space-y-2">
            <div className="font-medium">Maintenance Attachments</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {gatePassMaintenances.filter(r => r.gatePassId === g.id && r.attachmentUrl).map(rec => (
                /\.pdf(\?|$)/i.test(String(rec.attachmentUrl)) ? (
                  <iframe key={rec.id} src={String(rec.attachmentUrl)} title="Attachment" className="w-full h-40 rounded" />
                ) : (
                  <img key={rec.id} src={String(rec.attachmentUrl)} alt="Attachment" className="w-full h-40 rounded object-contain bg-muted" />
                )
              ))}
              {gatePassMaintenances.filter(r => r.gatePassId === g.id && r.attachmentUrl).length === 0 && (
                <div className="text-sm text-muted-foreground">No attachments</div>
              )}
            </div>
          </div>
                              </div>
                            </DetailedModal>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
      </TabsContent>
      
      </Tabs>
    </div>
  );
}
import DetailedModal from "./DetailedModal";