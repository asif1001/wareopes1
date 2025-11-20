"use client"
import { useEffect, useMemo, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { MoreHorizontal, ListFilter, Search, Download, Plus, X, Edit, Trash2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

type User = { id: string; fullName?: string; name?: string }
type DriverLicense = { id: string; driverId: string; vehicleType: string; licenseNumber: string; issueDate?: string | null; expiryDate?: string | null; attachments?: string[]; attachmentUrl?: string | null; remarks?: string | null; branch?: string | null }
type Branch = { id: string; name: string; code: string }

function expiryStatus(expiry?: string | null) {
  if (!expiry) return { label: "Active", variant: "secondary" as const }
  const today = new Date()
  const exp = new Date(expiry)
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: "Expired", variant: "destructive" as const }
  if (diffDays <= 60) return { label: "Expiring Soon", variant: "default" as const }
  return { label: "Active", variant: "secondary" as const }
}

export function DriverLicenseClientPage({ initialUsers, initialLicenses }: { initialUsers?: User[]; initialLicenses?: DriverLicense[] }) {
  const { toast } = useToast()
  const { user, isAdmin, permissions } = useAuth() as any
  const [users, setUsers] = useState<User[]>(() => initialUsers || [])
  const [licenses, setLicenses] = useState<DriverLicense[]>(() => initialLicenses || [])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [thresholdDays, setThresholdDays] = useState<number>(60)
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(true)
  const [addOpen, setAddOpen] = useState<boolean>(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [newDriverId, setNewDriverId] = useState<string>("")
  const [newBranchId, setNewBranchId] = useState<string>("")
  const [newVehicleType, setNewVehicleType] = useState<string>("")
  const [newLicenseNo, setNewLicenseNo] = useState<string>("")
  const [newIssueDate, setNewIssueDate] = useState<string>("")
  const [newExpiryDate, setNewExpiryDate] = useState<string>("")
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [newRemarks, setNewRemarks] = useState<string>("")
  const p: any = permissions || {}
  const canAdd = !!(isAdmin || (Array.isArray(p?.licenses) && p.licenses.includes('add')) || (Array.isArray(p?.maintenance) && p.maintenance.includes('add')))
  const canEdit = !!(isAdmin || (Array.isArray(p?.licenses) && p.licenses.includes('edit')) || (Array.isArray(p?.maintenance) && p.maintenance.includes('edit')))
  const canDelete = !!(isAdmin || (Array.isArray(p?.licenses) && p.licenses.includes('delete')) || (Array.isArray(p?.maintenance) && p.maintenance.includes('delete')))

  const [editingId, setEditingId] = useState<string | null>(null)
  const editingLicense = useMemo(() => licenses.find(l => l.id === editingId) || null, [licenses, editingId])
  const [editLicenseNo, setEditLicenseNo] = useState<string>("")
  const [editIssueDate, setEditIssueDate] = useState<string>("")
  const [editExpiryDate, setEditExpiryDate] = useState<string>("")
  const [editRemarks, setEditRemarks] = useState<string>("")
  const [editFiles, setEditFiles] = useState<File[]>([])
  const [editExistingUrls, setEditExistingUrls] = useState<string[]>([])
  const [editRemoveUrls, setEditRemoveUrls] = useState<string[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/licenses?limit=100", { method: "GET" })
        if (!res.ok) return
        const data = await res.json()
        const list = (data?.items || []) as any[]
        const normalized = (list || []).map((l: any) => ({ id: l.id, driverId: l.driverId, vehicleType: l.vehicleType || "", licenseNumber: l.licenseNumber || "", issueDate: l.issueDate ?? null, expiryDate: l.expiryDate ?? null, attachments: Array.isArray(l.attachments) ? (l.attachments as string[]) : (l.attachmentUrl ? [String(l.attachmentUrl)] : []), attachmentUrl: l.attachmentUrl ?? null, remarks: l.remarks ?? null, branch: l.branch ?? null })) as DriverLicense[]
        if (active) setLicenses(normalized)
      } catch {}
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/branches', { method: 'GET' })
        if (!res.ok) return
        const data = await res.json()
        const items = (data?.items || []) as Branch[]
        if (active) setBranches(items)
      } catch {}
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!alertsEnabled) return
    const soon = licenses.filter(l => {
      const st = expiryStatus(l.expiryDate)
      if (st.label !== "Expiring Soon") return false
      if (!l.expiryDate) return false
      const d = Math.ceil((new Date(l.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return d >= 0 && d <= thresholdDays
    })
    if (soon.length) toast({ title: "Upcoming license expirations", description: `${soon.length} record(s) expiring within ${thresholdDays} days` })
  }, [licenses, thresholdDays, alertsEnabled])

  const filteredLicenses = useMemo(() => {
    return licenses.filter(l => {
      const q = searchQuery.toLowerCase()
      const driver = (users.find(u => u.id === l.driverId)?.name || users.find(u => u.id === l.driverId)?.fullName || "").toLowerCase()
      const type = (l.vehicleType || "").toLowerCase()
      const num = (l.licenseNumber || "").toLowerCase()
      const matches = driver.includes(q) || type.includes(q) || num.includes(q)
      const licStatus = expiryStatus(l.expiryDate).label.toLowerCase()
      const normalized = licStatus === "expiring soon" ? "soon" : licStatus
      const matchesStatus = statusFilter === "all" || statusFilter === normalized
      return matches && matchesStatus
    })
  }, [licenses, users, searchQuery, statusFilter])

  

  function exportCsv(items: DriverLicense[]) {
    const header = ['Driver','VehicleType','LicenseNumber','IssueDate','ExpiryDate','Remarks']
    const rows = items.map(l => {
      const driver = users.find(u => u.id === l.driverId) as any
      const driverName = (driver?.fullName || driver?.name || l.driverId)
      return [driverName, l.vehicleType, l.licenseNumber, l.issueDate || '', l.expiryDate || '', l.remarks || '']
    })
    const csv = [header.join(','), ...rows.map(r => r.map(x => `"${String(x).replace(/"/g,'""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `driver-licenses-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const soonCount = licenses.filter(l => { const st = expiryStatus(l.expiryDate).label; if (st !== 'Expiring Soon') return false; if (!l.expiryDate) return false; const d = Math.ceil((new Date(l.expiryDate).getTime() - Date.now()) / (1000*60*60*24)); return d >= 0 && d <= thresholdDays }).length

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Driver Licenses</CardTitle>
          <CardDescription>Manage records, expirations, notifications, and attachments.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search..." className="pl-8 sm:w-[300px]" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-1"><ListFilter className="h-3.5 w-3.5" /><span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Filter</span></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                  <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="active">Active</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="soon">Expiring Soon</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="expired">Expired</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" size="sm" onClick={() => exportCsv(filteredLicenses)}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant={soonCount > 0 ? 'default' as any : 'secondary' as any}>Expiring Soon: {soonCount}</Badge>
              <Select value={String(thresholdDays)} onValueChange={(v) => setThresholdDays(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue placeholder="Days" /></SelectTrigger>
                <SelectContent>
                  {[30,45,60,90].map(d => (<SelectItem key={d} value={String(d)}>{d}d</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={alertsEnabled ? 'on' : 'off'} onValueChange={(v) => setAlertsEnabled(v === 'on')}>
                <SelectTrigger className="w-28"><SelectValue placeholder="Alerts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">Alerts On</SelectItem>
                  <SelectItem value="off">Alerts Off</SelectItem>
                </SelectContent>
              </Select>
              {canAdd && (
              <Button size="sm" onClick={() => {
                setNewDriverId(users[0]?.id || '')
                setNewBranchId(branches[0]?.id || '')
                setNewVehicleType('')
                setNewLicenseNo('')
                setNewIssueDate('')
                setNewExpiryDate('')
                setNewFiles([])
                setNewRemarks('')
                setAddOpen(true)
              }}><Plus className="h-4 w-4 mr-2" /> Add License</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Table className="text-xs">
            <TableHeader className="bg-muted/40">
              <TableRow className="even:bg-transparent">
                <TableHead className="w-48 text-xs uppercase tracking-wide text-center">Driver</TableHead>
                <TableHead className="w-40 text-xs uppercase tracking-wide">Vehicle Type</TableHead>
                <TableHead className="w-40 text-xs uppercase tracking-wide">License No.</TableHead>
                <TableHead className="w-32 text-xs uppercase tracking-wide">Issue Date</TableHead>
                <TableHead className="w-32 text-xs uppercase tracking-wide">Expiry Date</TableHead>
                <TableHead className="w-28 text-xs uppercase tracking-wide">Status</TableHead>
                <TableHead className="text-right w-24 text-xs uppercase tracking-wide">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const byDriver = new Map<string, DriverLicense[]>()
                for (const item of filteredLicenses) {
                  const arr = byDriver.get(item.driverId) || []
                  arr.push(item)
                  byDriver.set(item.driverId, arr)
                }
                const groups = Array.from(byDriver.entries())
                return groups.flatMap(([driverId, items]) => {
                  const driver = users.find(u => u.id === driverId) as any
                  const driverName = (driver?.fullName || driver?.name || driverId)
                  return items.map((l, idx) => {
                    const st = expiryStatus(l.expiryDate)
                    return (
                      <TableRow key={l.id} className="even:bg-muted/30">
                        {idx === 0 ? (
                          <TableCell className="font-medium text-center align-middle" rowSpan={items.length}>{driverName}</TableCell>
                        ) : null}
                        <TableCell className="py-2 px-3 whitespace-nowrap truncate">{l.vehicleType}</TableCell>
                        <TableCell className="py-2 px-3 whitespace-nowrap truncate">{l.licenseNumber}</TableCell>
                        <TableCell className="py-2 px-3 whitespace-nowrap">{l.issueDate ? new Date(l.issueDate).toLocaleDateString() : '-'}</TableCell>
                        <TableCell className="py-2 px-3 whitespace-nowrap">{l.expiryDate ? new Date(l.expiryDate).toLocaleDateString() : '-'}</TableCell>
                        <TableCell className="py-2 px-3"><Badge className="text-[10px] px-2 py-0.5" variant={st.variant as any}>{st.label}</Badge></TableCell>
                        <TableCell className="text-right py-2 px-3">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Open actions"><MoreHorizontal className="h-5 w-5" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {canEdit && (
                                <DropdownMenuItem onSelect={() => {
                                  setEditingId(l.id)
                                  setEditLicenseNo(l.licenseNumber || '')
                                  setEditIssueDate(l.issueDate || '')
                                  setEditExpiryDate(l.expiryDate || '')
                                  setEditRemarks(l.remarks || '')
                                  setEditFiles([])
                                  setEditExistingUrls(Array.isArray(l.attachments) && l.attachments.length ? l.attachments : (l.attachmentUrl ? [l.attachmentUrl] : []))
                                  setEditRemoveUrls([])
                                }} aria-label="Edit License"><Edit className="mr-2 h-4 w-4 text-blue-600" /> Edit</DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {canDelete && (
                                <DropdownMenuItem onSelect={() => { setDeleteId(l.id) }} aria-label="Delete License"><Trash2 className="mr-2 h-4 w-4 text-red-600" /> Delete</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                })
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="w-[95vw] max-w-[800px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add License</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="branch" className="text-sm font-medium">Branch</label>
                <Select value={newBranchId} onValueChange={setNewBranchId}>
                  <SelectTrigger id="branch" className="w-full"><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="driver" className="text-sm font-medium">Driver Name</label>
                <Select value={newDriverId} onValueChange={setNewDriverId}>
                  <SelectTrigger id="driver" className="w-full"><SelectValue placeholder="Select driver" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (<SelectItem key={u.id} value={u.id}>{u.fullName || u.name || u.id}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="vehicleType" className="text-sm font-medium">Vehicle Type</label>
                <Input id="vehicleType" placeholder="e.g. Light Vehicle" value={newVehicleType} onChange={e => setNewVehicleType(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="licenseNo" className="text-sm font-medium">License No</label>
                <Input id="licenseNo" placeholder="e.g. 123456789" value={newLicenseNo} onChange={e => setNewLicenseNo(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="issueDate" className="text-sm font-medium">Issue Date</label>
                <Input id="issueDate" type="date" value={newIssueDate} onChange={e => setNewIssueDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="expiryDate" className="text-sm font-medium">Expire Date</label>
                <Input id="expiryDate" type="date" value={newExpiryDate} onChange={e => setNewExpiryDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <label htmlFor="new-remarks" className="text-sm font-medium">Remark</label>
                <Textarea id="new-remarks" className="bg-white" value={newRemarks} onChange={e => setNewRemarks(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <label htmlFor="attachments" className="text-sm font-medium">Multiple Attachments</label>
                <Input id="attachments" type="file" accept="image/*,application/pdf" multiple onChange={e => setNewFiles(Array.from(e.target.files || []))} />
                {newFiles.length > 0 && (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {newFiles.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                        <span className="truncate" title={f.name}>{f.name}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={() => setNewFiles(prev => prev.filter(x => x !== f))}><X className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={async () => {
                try {
                  if (!newDriverId || !newVehicleType || !newLicenseNo || !newIssueDate || !newExpiryDate) {
                    toast({ title: 'Missing required fields', description: 'Please fill all required fields.' })
                    return
                  }
                  const form = new FormData()
                  form.set('driverId', newDriverId)
                  form.set('vehicleType', newVehicleType)
                  form.set('licenseNumber', newLicenseNo)
                  form.set('issueDate', newIssueDate)
                  form.set('expiryDate', newExpiryDate)
                  if (newBranchId) form.set('branch', newBranchId)
                  if (newRemarks) form.set('remarks', newRemarks)
                  for (const f of newFiles) form.append('attachments', f)
                  const res = await fetch('/api/licenses', { method: 'POST', body: form })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}))
                    throw new Error(err?.error || 'Save failed')
                  }
                  const data = await res.json()
                  const item = data?.item as DriverLicense | undefined
                  if (!item) throw new Error('Invalid server response')
                  setLicenses(prev => [item, ...prev])
                  toast({ title: 'License added', description: item.licenseNumber })
                  setAddOpen(false)
                } catch (e: any) {
                  toast({ title: 'Add failed', description: e?.message || 'Could not add license', variant: 'destructive' as any })
                }
              }}>Save License</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editingId} onOpenChange={(o) => setEditingId(o ? (editingId || null) : null)}>
        <DialogContent className="w-[95vw] max-w-[800px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Edit License</DialogTitle>
              {(() => {
                if (!editingLicense) return null
                const u = (Array.isArray(editingLicense.attachments) && editingLicense.attachments[0]) || editingLicense.attachmentUrl || ''
                return u ? (
                  <a href={u} target="_blank" rel="noreferrer" aria-label="Open document">
                    <Button size="sm" variant="secondary">Open Document</Button>
                  </a>
                ) : null
              })()}
            </div>
          </DialogHeader>
          {editingLicense && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Branch</label>
                  <Input value={branches.find(b => b.id === (editingLicense.branch || ''))?.name || editingLicense.branch || ''} readOnly />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Driver Name</label>
                  <Input value={(users.find(u => u.id === editingLicense.driverId)?.fullName || users.find(u => u.id === editingLicense.driverId)?.name || editingLicense.driverId)} readOnly />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Vehicle Type</label>
                  <Input value={editingLicense.vehicleType} readOnly />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="edit-license-no" className="text-sm font-medium">License No</label>
                  <Input id="edit-license-no" value={editLicenseNo} onChange={e => setEditLicenseNo(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="edit-issue" className="text-sm font-medium">Issue Date</label>
                  <Input id="edit-issue" type="date" value={editIssueDate || ''} onChange={e => setEditIssueDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="edit-expiry" className="text-sm font-medium">Expire Date</label>
                  <Input id="edit-expiry" type="date" value={editExpiryDate || ''} onChange={e => setEditExpiryDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label htmlFor="edit-remarks" className="text-sm font-medium">Remark</label>
                  <Textarea id="edit-remarks" className="bg-white" value={editRemarks} onChange={e => setEditRemarks(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label htmlFor="edit-files" className="text-sm font-medium">Multiple Attachments</label>
                  <Input id="edit-files" type="file" accept="image/*,application/pdf" multiple onChange={e => setEditFiles(Array.from(e.target.files || []))} />
                  {editFiles.length > 0 && (
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {editFiles.map((f, i) => (
                        <div key={`${f.name}-${i}`} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                          <span className="truncate" title={f.name}>{f.name}</span>
                          <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={() => setEditFiles(prev => prev.filter(x => x !== f))}><X className="h-3 w-3" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {editExistingUrls.length > 0 && (
                  <div className="md:col-span-2">
                    <div className="text-sm text-muted-foreground mb-2">Existing Attachments</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {editExistingUrls.map((u, idx) => {
                        const isImage = /(png|jpg|jpeg|gif|webp)(\?|$)/i.test(u)
                        const isPdf = /(pdf)(\?|$)/i.test(u)
                        return (
                          <div key={idx} className="space-y-1 border rounded p-2">
                            {isImage ? (<img src={u} alt="Attachment" className="w-full h-20 rounded object-cover bg-muted" />) : (<div className="w-full h-20 rounded bg-muted flex items-center justify-center text-xs">{isPdf ? 'PDF' : 'FILE'}</div>)}
                            <div className="text-xs truncate" title={u}>{u.split('/').pop()?.split('?')[0] || 'Document'}</div>
                            <div className="flex items-center gap-3 text-xs">
                              <a href={u} download className="inline-flex items-center text-blue-600 hover:underline" aria-label="Download attachment">Download</a>
                              <a href={u} target="_blank" rel="noreferrer" className="inline-flex items-center text-muted-foreground hover:underline" aria-label="Open attachment">Open</a>
                              <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-red-600 hover:underline"
                                onClick={() => {
                                  setEditExistingUrls(prev => prev.filter(x => x !== u))
                                  setEditRemoveUrls(prev => prev.includes(u) ? prev : [...prev, u])
                                }}
                                aria-label="Delete attachment">Delete</Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button onClick={async () => {
                  try {
                    if (!editingLicense) return
                    if (!editLicenseNo || !editIssueDate || !editExpiryDate) {
                      toast({ title: 'Missing required fields', description: 'Please fill all required fields.' })
                      return
                    }
                    const form = new FormData()
                    form.set('licenseNumber', editLicenseNo)
                    form.set('issueDate', editIssueDate)
                    form.set('expiryDate', editExpiryDate)
                    if (editRemarks) form.set('remarks', editRemarks)
                    if (editRemoveUrls.length) form.set('removeAttachmentsUrls', JSON.stringify(editRemoveUrls))
                    for (const f of editFiles) form.append('attachments', f)
                    const res = await fetch(`/api/licenses/${editingLicense.id}`, { method: 'PUT', body: form })
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}))
                      throw new Error(err?.error || 'Update failed')
                    }
                    const data = await res.json()
                    const item = data?.item as DriverLicense | undefined
                    if (!item) throw new Error('Invalid server response')
                    setLicenses(prev => prev.map(x => x.id === item.id ? item : x))
                    toast({ title: 'License updated', description: item.licenseNumber })
                    setEditingId(null)
                  } catch (e: any) {
                    toast({ title: 'Update failed', description: e?.message || 'Could not update license', variant: 'destructive' as any })
                  }
                }}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteId} onOpenChange={(o) => setDeleteId(o ? (deleteId || null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete License</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                if (!deleteId) return
                const res = await fetch(`/api/licenses/${deleteId}`, { method: 'DELETE' })
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}))
                  throw new Error(err?.error || 'Delete failed')
                }
                setLicenses(prev => prev.filter(x => x.id !== deleteId))
                toast({ title: 'License deleted', description: deleteId })
                setDeleteId(null)
              } catch (e: any) {
                toast({ title: 'Delete failed', description: e?.message || 'Could not delete license', variant: 'destructive' as any })
              }
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}