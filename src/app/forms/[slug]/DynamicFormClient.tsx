"use client";

import React from "react";
import type { FormTemplate, FormField } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import { useToast } from "@/hooks/use-toast";
import { submitFormAction } from "@/app/actions";

function FieldControl({ field, value, onChange }: { field: FormField; value: any; onChange: (v: any) => void }) {
  return (
    <div className="space-y-2">
      <Label>{field.label}{field.required ? " *" : ""}</Label>
      {field.type === "text" && (
        <Input value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
      )}
      {field.type === "textarea" && (
        <Textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
      )}
      {field.type === "number" && (
        <Input type="number" value={value ?? ""} onChange={e => onChange(e.target.value === "" ? undefined : Number(e.target.value))} placeholder={field.placeholder} />
      )}
      {field.type === "date" && (
        <Input type="date" value={value || ""} onChange={e => onChange(e.target.value)} />
      )}
      {field.type === "checkbox" && (
        <div className="flex items-center gap-2">
          <Switch checked={!!value} onCheckedChange={(v) => onChange(v)} />
          <span>Check to confirm</span>
        </div>
      )}
      {field.type === "dropdown" && (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder || "Select option"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function clientValidate(field: FormField, value: any): string | null {
  // Basic client-side validation for immediate feedback
  if (field.required) {
    if (field.type === "checkbox") {
      if (value !== true) return "Required";
    } else if (value === undefined || value === null || String(value).trim() === "") {
      return "Required";
    }
  }
  if (field.type === "number") {
    if (typeof field.min === "number" && typeof value === "number" && value < field.min) return `Min ${field.min}`;
    if (typeof field.max === "number" && typeof value === "number" && value > field.max) return `Max ${field.max}`;
  }
  if (field.type === "text" && field.pattern) {
    try {
      const re = new RegExp(field.pattern);
      if (!re.test(String(value || ""))) return "Invalid format";
    } catch {}
  }
  if (field.type === "dropdown" && field.options?.length) {
    if (value && !field.options.includes(value)) return "Invalid option";
  }
  if (field.type === "date") {
    if (value && isNaN(Date.parse(String(value)))) return "Invalid date";
  }
  return null;
}

export function DynamicFormClient({ template }: { template: FormTemplate }) {
  const { toast } = useToast();
  const [answers, setAnswers] = React.useState<Record<string, any>>({});
  const [errors, setErrors] = React.useState<Record<string, string | null>>({});

  const setValue = (fieldId: string, value: any, field: FormField) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
    const err = clientValidate(field, value);
    setErrors(prev => ({ ...prev, [fieldId]: err }));
  };

  const [message, formAction] = useActionState(async (_prev: any, fd: FormData) => {
    const formData = new FormData();
    formData.set("templateSlug", template.slug);
    formData.set("answersJson", JSON.stringify(answers));
    const res = await submitFormAction({}, formData);
    return res.success ? (res.message || "Submitted") : (res.error || "Failed");
  }, null);

  React.useEffect(() => {
    if (message) {
      if (message.includes("Submitted") || message.includes("success")) {
        toast({ title: "Success", description: "Form submitted successfully." });
        setAnswers({});
        setErrors({});
      } else {
        toast({ title: "Error", description: message, variant: "destructive" });
      }
    }
  }, [message]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Run client validation before submit
    const nextErrors: Record<string, string | null> = {};
    for (const f of template.fields) {
      nextErrors[f.id] = clientValidate(f, answers[f.id]);
    }
    setErrors(nextErrors);
    const hasError = Object.values(nextErrors).some(Boolean);
    if (hasError) {
      toast({ title: "Validation error", description: "Please fix highlighted fields.", variant: "destructive" });
      return;
    }
    // Trigger server action via hidden form submit
    const fd = new FormData();
    formAction(fd);
  };

  return (
    <div className="max-w-xl mx-auto w-full p-4">
      <Card>
        <CardHeader>
          <CardTitle>{template.displayName}</CardTitle>
          <CardDescription>Fill out the form and submit.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {template.fields.map((f) => (
              <div key={f.id} className="space-y-2">
                <FieldControl field={f} value={answers[f.id]} onChange={(v) => setValue(f.id, v, f)} />
                {errors[f.id] && <p className="text-red-600 text-sm">{errors[f.id]}</p>}
              </div>
            ))}
            <div className="flex justify-end">
              <Button type="submit" className="w-full sm:w-auto">Submit</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}