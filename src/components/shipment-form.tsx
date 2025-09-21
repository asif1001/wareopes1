
"use client"

import { useEffect, useState, useActionState, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from 'date-fns';
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Edit, CalendarIcon, Trash2, Loader2, AlertCircle } from "lucide-react";
import type { SerializableShipment, Source, ContainerSize } from "@/lib/types";
import { saveShipmentAction, deleteShipmentAction } from "@/app/dashboard/shipments/actions";
import { cn } from "@/lib/utils";
import { useFormStatus } from "react-dom";

type ShipmentFormData = {
    id?: string;
    source: string;
    invoice: string;
    billOfLading: string;
    containers: { id: string; size: string; quantity: number }[];
    bahrainEta?: Date;
    originalDocumentReceiptDate?: Date | null;
    actualBahrainEta?: Date | null;
    lastStorageDay?: Date | null;
    whEtaRequestedByParts?: Date | null;
    whEtaConfirmedByLogistics?: Date | null;
    cleared: boolean;
    actualClearedDate?: Date | null;
    totalCases: number | '';
    domLines: number | '';
    bulkLines: number | '';
    generalRemark: string;
    remark?: string;
}

function DatePickerField({ name, control, label, required }: { name: any, control: any, label: string, required?: boolean }) {
    const [open, setOpen] = useState(false);
    
    return (
        <div className="space-y-2">
            <Label>
                {label}
                {required && '*'}
            </Label>
            <Controller name={name} control={control} render={({ field }) => (
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                                field.onChange(date);
                                setOpen(false);
                            }}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            )} />
        </div>
    );
}

const parseShipmentData = (shipment?: SerializableShipment): ShipmentFormData | undefined => {
    if (!shipment) return undefined;
    
    const parseDate = (dateStr: string | null | undefined): Date | null | undefined => {
        return dateStr ? parseISO(dateStr) : null;
    }

    return {
        id: shipment.id,
        source: shipment.source,
        invoice: shipment.invoice,
        billOfLading: shipment.billOfLading,
        containers: shipment.containers.length > 0 ? shipment.containers : [{ id: '1', size: "", quantity: 1 }],
        bahrainEta: parseISO(shipment.bahrainEta),
        originalDocumentReceiptDate: parseDate(shipment.originalDocumentReceiptDate),
        actualBahrainEta: parseDate(shipment.actualBahrainEta),
        lastStorageDay: parseDate(shipment.lastStorageDay),
        whEtaRequestedByParts: parseDate(shipment.whEtaRequestedByParts),
        whEtaConfirmedByLogistics: parseDate(shipment.whEtaConfirmedByLogistics),
        cleared: shipment.cleared,
        actualClearedDate: parseDate(shipment.actualClearedDate),
        totalCases: shipment.totalCases,
        domLines: shipment.domLines,
        bulkLines: shipment.bulkLines,
        generalRemark: shipment.generalRemark,
        remark: shipment.remark || '',
    };
}

function SubmitButton({ isEditMode }: { isEditMode: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Create Shipment'}
        </Button>
    )
}

function DeleteButton({ shipmentId, onDeleted }: { shipmentId: string, onDeleted: () => void }) {
    const { toast } = useToast();
    const [pending, setPending] = useState(false);

    const handleDelete = async () => {
        setPending(true);
        const result = await deleteShipmentAction(shipmentId);
        setPending(false);
        if (result.success) {
            toast({ title: "Shipment deleted successfully!" });
            onDeleted();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    }

    return (
         <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="mr-auto">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Shipment
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the shipment
                        and remove its data from our servers.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={pending}>
                         {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Continue
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}


export function ShipmentForm({
    shipment, isEditMode = false, sources, containerSizes
}: {
    shipment?: SerializableShipment;
    isEditMode?: boolean;
    sources: Source[];
    containerSizes: ContainerSize[];
}) {
    const [open, setOpen] = useState(false);
    const [actionState, formAction] = useActionState(saveShipmentAction, { success: false, error: null });
    const { toast } = useToast();

    const form = useForm<ShipmentFormData>({
        defaultValues: parseShipmentData(shipment) || {
            source: '',
            invoice: '',
            billOfLading: '',
            containers: [{ id: '1', size: "", quantity: 1 }],
            cleared: false,
            totalCases: '',
            domLines: '',
            bulkLines: '',
            generalRemark: '',
            remark: '',
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "containers",
    });

    const watchContainers = form.watch("containers");
    const numContainers = watchContainers.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
    const watchDomLines = form.watch("domLines", 0);
    const watchBulkLines = form.watch("bulkLines", 0);
    const totalLines = (Number(watchDomLines) || 0) + (Number(watchBulkLines) || 0);
    const watchCleared = form.watch("cleared");

    useEffect(() => {
        if (actionState.success) {
            setOpen(false);
            form.reset();
            toast({
                title: `Shipment ${isEditMode ? 'updated' : 'created'} successfully!`,
                description: "The shipment has been saved.",
            });
        }
    }, [actionState, isEditMode, toast, form]);

     useEffect(() => {
        if (open) {
            actionState.error = null;
            actionState.success = false;
            const defaultValues = parseShipmentData(shipment) || {
                source: '',
                invoice: '',
                billOfLading: '',
                containers: [{ id: '1', size: "", quantity: 1 }],
                cleared: false,
                totalCases: '',
                domLines: '',
                bulkLines: '',
                generalRemark: '',
                remark: '',
            };
            form.reset(defaultValues);
        }
    }, [open, shipment, form, actionState]);
    
    const getISODateString = (date: Date | null | undefined) => {
        return date ? format(date, 'yyyy-MM-dd') : '';
    }

    const handleDeleted = () => {
        setOpen(false);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {isEditMode ? (
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                ) : (
                    <Button size="sm" className="h-8 gap-1">
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-rap">
                            Add Shipment
                        </span>
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? "Edit Shipment" : "Create New Shipment"}</DialogTitle>
                    <DialogDescription>
                        Fill in the details below. All fields with * are required.
                    </DialogDescription>
                </DialogHeader>
                <form 
                    action={formAction}
                    className="flex-grow overflow-y-auto space-y-4 pr-6"
                >
                 {actionState.error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{actionState.error}</AlertDescription>
                    </Alert>
                )}
                    <input type="hidden" name="id" value={form.getValues("id") || ""} />
                    <input type="hidden" name="containers" value={JSON.stringify(watchContainers)} />
                    <input type="hidden" name="cleared" value={String(watchCleared)} />
                    
                    <input type="hidden" name="bahrainEta" value={getISODateString(form.watch('bahrainEta'))} />
                    <input type="hidden" name="originalDocumentReceiptDate" value={getISODateString(form.watch('originalDocumentReceiptDate'))} />
                    <input type="hidden" name="actualBahrainEta" value={getISODateString(form.watch('actualBahrainEta'))} />
                    <input type="hidden" name="lastStorageDay" value={getISODateString(form.watch('lastStorageDay'))} />
                    <input type="hidden" name="whEtaRequestedByParts" value={getISODateString(form.watch('whEtaRequestedByParts'))} />
                    <input type="hidden" name="whEtaConfirmedByLogistics" value={getISODateString(form.watch('whEtaConfirmedByLogistics'))} />
                    <input type="hidden" name="actualClearedDate" value={getISODateString(form.watch('actualClearedDate'))} />


                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                        <div className="space-y-4">
                            <Card>
                                <CardHeader><CardTitle>Identifiers</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="source">Source*</Label>
                                        <Controller name="source" control={form.control} render={({ field }) => (
                                            <Select onValueChange={field.onChange} defaultValue={field.value} name={field.name}>
                                                <SelectTrigger><SelectValue placeholder="Select a source" /></SelectTrigger>
                                                <SelectContent>
                                                    {sources.map(s => <SelectItem key={s.id} value={s.shortName}>{s.shortName}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="invoice">Invoice*</Label>
                                            <Input id="invoice" {...form.register("invoice")} className="uppercase" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="billOfLading">Bill of Lading*</Label>
                                            <Input id="billOfLading" {...form.register("billOfLading")} className="uppercase" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Containers*</CardTitle>
                                    <CardDescription>Total Containers: {numContainers}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {fields.map((field, index) => (
                                            <div key={field.id} className="flex items-center gap-2">
                                                <Controller name={`containers.${index}.quantity`} control={form.control} render={({ field }) => (
                                                    <Input type="number" {...field} placeholder="Qty" className="w-24" min={1} />
                                                )} />
                                                <Controller name={`containers.${index}.size`} control={form.control} render={({ field }) => (
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <SelectTrigger><SelectValue placeholder="Select Size" /></SelectTrigger>
                                                        <SelectContent>
                                                            {containerSizes.map(s => <SelectItem key={s.id} value={s.size}>{s.size}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                )} />
                                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ id: (fields.length + 1).toString(), size: '', quantity: 1 })} className="mt-4">
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Container
                                    </Button>
                                </CardContent>
                            </Card>
                             <Card>
                                <CardHeader><CardTitle>Counts</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="totalCases">Total Cases*</Label>
                                        <Input id="totalCases" type="number" {...form.register("totalCases")} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="domLines">DOM Lines*</Label>
                                        <Input id="domLines" type="number" {...form.register("domLines")} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="bulkLines">Bulk Lines*</Label>
                                        <Input id="bulkLines" type="number" {...form.register("bulkLines")} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Total Lines</Label>
                                        <Input value={totalLines} readOnly disabled />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="space-y-4">
                            <Card>
                                <CardHeader><CardTitle>Key Dates & Status</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <DatePickerField name="bahrainEta" control={form.control} label="Bahrain ETA" required />
                                    <DatePickerField name="actualBahrainEta" control={form.control} label="Actual Bahrain ETA" />
                                    <DatePickerField name="originalDocumentReceiptDate" control={form.control} label="Original Doc Receipt Date" />
                                    <DatePickerField name="lastStorageDay" control={form.control} label="Last Storage Date" />
                                    <DatePickerField name="whEtaRequestedByParts" control={form.control} label="W/H ETA (Requested)" />
                                    <DatePickerField name="whEtaConfirmedByLogistics" control={form.control} label="W/H ETA (Confirmed)" />
                                    <div className="space-y-2">
                                        <Label>Cleared</Label>
                                        <Controller name="cleared" control={form.control} render={({ field }) => (
                                            <Select onValueChange={(value) => field.onChange(value === 'true')} defaultValue={String(field.value)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="true">Yes</SelectItem>
                                                    <SelectItem value="false">No</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                    <DatePickerField name="actualClearedDate" control={form.control} label="Actual Cleared Date" required={watchCleared} />
                                </CardContent>
                            </Card>
                             <Card>
                                <CardHeader><CardTitle>Remarks</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="generalRemark">General Remark*</Label>
                                        <Textarea id="generalRemark" {...form.register("generalRemark")} rows={3} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="remark">Internal Remark</Label>
                                        <Textarea id="remark" {...form.register("remark")} rows={3} />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                 <DialogFooter className="mt-4 sticky bottom-0 bg-background pt-4 flex justify-between w-full">
                    <div>
                         {isEditMode && shipment?.id && <DeleteButton shipmentId={shipment.id} onDeleted={handleDeleted} />}
                    </div>
                    <div className="flex gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <SubmitButton isEditMode={isEditMode} />
                    </div>
                </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
