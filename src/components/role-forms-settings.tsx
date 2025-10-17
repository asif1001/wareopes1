"use client";
import { useEffect, useMemo, useState, useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Edit, PlusCircle } from "lucide-react";
import type { FormTemplate, FormField, FormFieldType } from "@/lib/types";
import { userRoles } from "@/lib/types";
import { createFormTemplateFromFormAction, deleteFormTemplateAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

function sanitizeSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function FieldEditor({ field, onChange, onDelete }: { field: FormField; onChange: (f: FormField) => void; onDelete: () => void }) {
  const set = (patch: Partial<FormField>) => onChange({ ...field, ...patch });
  return (
    <Card className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Label</Label>
          <Input value={field.label} onChange={e => set({ label: e.target.value, id: sanitizeSlug(e.target.value) })} placeholder="e.g., Operator Name" />
        </div>
        <div>
          <Label>Field Type</Label>
          <Select value={field.type} onValueChange={(v: FormFieldType) => set({ type: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="textarea">Textarea</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="dropdown">Dropdown</SelectItem>
              <SelectItem value="checkbox">Checkbox</SelectItem>
              <SelectItem value="date">Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Placeholder</Label>
          <Input value={field.placeholder || ""} onChange={e => set({ placeholder: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={!!field.required} onCheckedChange={(v) => set({ required: v })} />
          <Label>Required</Label>
        </div>

        {field.type === "number" && (
          <>
            <div>
              <Label>Min</Label>
              <Input type="number" value={field.min ?? ""} onChange={e => set({ min: e.target.value === "" ? undefined : Number(e.target.value) })} />
            </div>
            <div>
              <Label>Max</Label>
              <Input type="number" value={field.max ?? ""} onChange={e => set({ max: e.target.value === "" ? undefined : Number(e.target.value) })} />
            </div>
          </>
        )}

        {field.type === "text" && (
          <div className="md:col-span-2">
            <Label>Pattern (regex)</Label>
            <Input value={field.pattern || ""} onChange={e => set({ pattern: e.target.value })} placeholder="e.g., ^[A-Za-z ]+$" />
          </div>
        )}

        {field.type === "dropdown" && (
          <div className="md:col-span-2">
            <Label>Options (comma-separated)</Label>
            <Textarea value={(field.options || []).join(", ")} onChange={e => set({ options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
          </div>
        )}
      </div>
      <div className="flex justify-end mt-4">
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" /> Remove Field
        </Button>
      </div>
    </Card>
  );
}

function FormPreview({ fields }: { fields: FormField[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Preview</CardTitle>
        <CardDescription>This is how the form will look to users.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fields.map(f => (
            <div key={f.id} className="space-y-2">
              <Label>{f.label}{f.required ? " *" : ""}</Label>
              {f.type === "text" && <Input placeholder={f.placeholder} />}
              {f.type === "textarea" && <Textarea placeholder={f.placeholder} />}
              {f.type === "number" && <Input type="number" placeholder={f.placeholder} />}
              {f.type === "date" && <Input type="date" />}
              {f.type === "checkbox" && (
                <div className="flex items-center gap-2">
                  <Switch />
                  <span>Check to agree/confirm</span>
                </div>
              )}
              {f.type === "dropdown" && (
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder={f.placeholder || "Select option"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options || []).map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function RoleFormsSettings({ initialTemplates }: { initialTemplates: FormTemplate[] }) {
  const { toast } = useToast();

  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [autoRedirectForRoles, setAutoRedirectForRoles] = useState<string[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>(initialTemplates || []);

  const addField = () => {
    const newField: FormField = {
      id: `field_${fields.length + 1}`,
      label: "Untitled",
      type: "text",
      required: false,
    };
    setFields(prev => [...prev, newField]);
  };

  const updateField = (index: number, patch: FormField) => {
    setFields(prev => prev.map((f, i) => i === index ? patch : f));
  };
  const deleteField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  };

  const toggleRole = (list: string[], role: string) => (
    list.includes(role) ? list.filter(r => r !== role) : [...list, role]
  );

  const [message, formAction] = useActionState(async (_prev: any, formData: FormData) => {
    const fd = new FormData();
    const finalSlug = slug || sanitizeSlug(displayName);
    fd.set("slug", finalSlug);
    fd.set("displayName", displayName);
    fd.set("allowedRoles", allowedRoles.join(","));
    fd.set("autoRedirectForRoles", autoRedirectForRoles.join(","));
    fd.set("fieldsJson", JSON.stringify(fields));
    const res = await createFormTemplateFromFormAction({}, fd);
    if (res.message.includes("created")) {
      toast({ title: "Form template created", description: `${displayName} (${finalSlug})`, variant: "default" });
    } else {
      toast({ title: "Failed", description: res.message, variant: "destructive" });
    }
    return res.message;
  }, null);

  useEffect(() => {
    if (message) {
      // Optionally refresh list from server via API; here we optimistically append
      setTemplates(prev => {
        const finalSlug = slug || sanitizeSlug(displayName);
        const newTpl: FormTemplate = {
          id: `${finalSlug}-${Date.now()}`,
          slug: finalSlug,
          displayName,
          allowedRoles,
          autoRedirectForRoles,
          fields,
          createdAt: new Date().toISOString(),
          createdBy: "optimistic",
        };
        return [newTpl, ...prev];
      });
      setSlug(""); setDisplayName(""); setAllowedRoles([]); setAutoRedirectForRoles([]); setFields([]);
    }
  }, [message]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Role-Based Form Builder</CardTitle>
          <CardDescription>Create custom forms and assign allowed roles.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Display Name</Label>
                <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Forklift Operator" />
              </div>
              <div>
                <Label>Slug (auto from name if blank)</Label>
                <Input value={slug} onChange={e => setSlug(sanitizeSlug(e.target.value))} placeholder="forklift-operator" />
              </div>
            </div>

            <div>
              <Label>Allowed Roles</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {userRoles.map(role => (
                  <label key={role} className="flex items-center gap-2 p-2 border rounded">
                    <input type="checkbox" checked={allowedRoles.includes(role)} onChange={() => setAllowedRoles(toggleRole(allowedRoles, role))} />
                    <span>{role}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Auto-Redirect Roles</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {userRoles.map(role => (
                  <label key={role} className="flex items-center gap-2 p-2 border rounded">
                    <input type="checkbox" checked={autoRedirectForRoles.includes(role)} onChange={() => setAutoRedirectForRoles(toggleRole(autoRedirectForRoles, role))} />
                    <span>{role}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Fields</Label>
                <Button type="button" onClick={addField} size="sm"><PlusCircle className="h-4 w-4 mr-2" /> Add Field</Button>
              </div>
              <div className="space-y-3">
                {fields.map((f, i) => (
                  <FieldEditor key={f.id} field={f} onChange={nf => updateField(i, nf)} onDelete={() => deleteField(i)} />
                ))}
              </div>
            </div>

            <FormPreview fields={fields} />

            <div className="flex justify-end">
              <Button type="submit">Create Template</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Templates</CardTitle>
          <CardDescription>Manage or edit created templates.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Allowed Roles</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{t.displayName}</TableCell>
                  <TableCell>{t.slug}</TableCell>
                  <TableCell>{(t.allowedRoles || []).join(", ")}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => toast({ title: "Edit coming soon", description: "Use create for now." })}><Edit className="h-4 w-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={async () => {
                      await deleteFormTemplateAction(t.id);
                      setTemplates(prev => prev.filter(pt => pt.id !== t.id));
                      toast({ title: "Deleted", description: t.displayName });
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}