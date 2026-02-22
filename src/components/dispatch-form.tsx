"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDropzone } from "react-dropzone";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Edit, CalendarIcon, Trash2, Loader2, UploadCloud, X, Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DispatchService } from "@/lib/firebase/firestore";
import { uploadFiles } from "@/lib/firebase/storage";
import { cn } from "@/lib/utils";
import type { SerializableDispatch, User, ContainerSize } from "@/lib/types";

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const dispatchSchema = z.object({
    invoiceNo: z.string().min(1, "Invoice No is required"),
    customerName: z.string().min(1, "Customer name is required"),
    customerCode: z.string().min(1, "Customer Code is required"),
    loadingDate: z.date({ required_error: "Loading date is required." }),
    containerSize: z.enum(["20ft", "40ft", "Misc", "DHL"]),
    noOfContainer: z.coerce.number().min(1, "Number of containers must be at least 1"),
    noOfCases: z.coerce.number().min(1, "Number of cases must be at least 1"),
    containerInspectionRemark: z.string().optional(),
    trailerNo: z.string().min(1, "Trailer No is required"),
    driverCprNo: z.string().min(1, "Driver CPR No is required"),
    driverPhoneNo: z.string().regex(phoneRegex, 'Invalid phone number'),
    containerNos: z.array(z.object({ value: z.string().min(1, "Container No is required") })).min(1, "At least one container number is required"),
    loaderName: z.string().min(1, "Loader name is required"),
    checkerName: z.string().min(1, "Checker name is required"),
    modeOfTransport: z.enum(["Sea", "Road", "Air"]),
    status: z.enum(["Pending", "Loaded", "Dispatched"]),
});

type DispatchFormValues = z.infer<typeof dispatchSchema>;

export function DispatchForm({ dispatch, isEditMode = false, users, containerSizes, onCreated, onUpdated }: {
    dispatch?: SerializableDispatch;
    isEditMode?: boolean;
    users: User[];
    containerSizes: ContainerSize[];
    onCreated?: (dispatch: SerializableDispatch) => void;
    onUpdated?: (dispatch: SerializableDispatch) => void;
}) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [loaderOpen, setLoaderOpen] = useState(false);
    const [checkerOpen, setCheckerOpen] = useState(false);

    const uniqueUsers = useMemo(() => {
        const seen = new Set();
        return users.filter(u => {
            const name = u.fullName || u.name;
            if (!name) return false;
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
        }).map(u => ({ label: u.fullName || u.name || '', value: u.fullName || u.name || '' }));
    }, [users]);

    const { toast } = useToast();

    const initialContainerNos = Array.isArray((dispatch as any)?.containerNos)
        ? (dispatch as any).containerNos
            .map((item: any) => ({
                value: typeof item === "string" ? item : item?.value ?? ""
            }))
            .filter((item: { value: string }) => item.value.trim().length > 0)
        : dispatch?.containerNo
            ? dispatch.containerNo
                .split(",")
                .map((value) => ({ value: value.trim() }))
                .filter((item) => item.value.length > 0)
            : [{ value: "" }];

    const form = useForm<DispatchFormValues>({
        resolver: zodResolver(dispatchSchema),
        defaultValues: isEditMode && dispatch ? {
            ...dispatch,
            loadingDate: new Date(dispatch.loadingDate),
            containerNos: initialContainerNos.length > 0 ? initialContainerNos : [{ value: "" }],
        } : {
            invoiceNo: "",
            customerName: "",
            customerCode: "",
            loadingDate: new Date(),
            containerSize: "20ft",
            noOfContainer: 1,
            noOfCases: 0,
            containerInspectionRemark: "",
            trailerNo: "",
            driverCprNo: "",
            driverPhoneNo: "",
            containerNos: [{ value: "" }],
            loaderName: "",
            checkerName: "",
            modeOfTransport: "Road",
            status: "Pending",
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "containerNos"
    });

    const noOfContainer = form.watch("noOfContainer");

    useEffect(() => {
        const currentCount = fields.length;
        const newCount = noOfContainer || 0;
        if (newCount > currentCount) {
            for (let i = currentCount; i < newCount; i++) {
                append({ value: "" });
            }
        } else if (newCount < currentCount) {
            for (let i = currentCount; i > newCount; i--) {
                remove(i - 1);
            }
        }
    }, [noOfContainer, fields.length, append, remove]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: (acceptedFiles) => {
            setFiles(prev => [...prev, ...acceptedFiles]);
        },
        accept: { "image/*": [] }
    });

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const onSubmit = () => setShowConfirm(true);

    const handleConfirmSubmit = async (data: DispatchFormValues) => {
        setIsSubmitting(true);
        setShowConfirm(false);

        const handleSuccess = (saved?: SerializableDispatch) => {
            toast({ title: `Dispatch ${isEditMode ? 'updated' : 'created'} successfully!` });
            form.reset();
            setFiles([]);
            setUploadProgress(0);
            setOpen(false);
            if (saved) {
                if (isEditMode) {
                    onUpdated?.(saved);
                } else {
                    onCreated?.(saved);
                }
            }
        };

        const handleError = (error: any) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        };

        try {
            const { containerNos, ...rest } = data;
            const containerNo = containerNos
                .map((item) => item.value.trim())
                .filter((value) => value.length > 0)
                .join(", ");
            const dateTime = isEditMode && dispatch ? dispatch.dateTime : new Date().toISOString();
            const uploadPhotos = files.length > 0
                ? new Promise<string[]>((resolve, reject) => {
                    uploadFiles(
                        files,
                        "Cont_Dispatch_Photo",
                        (progress) => setUploadProgress(progress),
                        (urls) => resolve(urls),
                        (error) => reject(error)
                    );
                })
                : Promise.resolve(dispatch?.photos || []);

            const photos = await uploadPhotos;
            const payload = { ...rest, containerNo, loadingDate: data.loadingDate.toISOString(), photos, dateTime };
            const saved = isEditMode && dispatch
                ? await DispatchService.updateDispatch(dispatch.id, payload)
                : await DispatchService.createDispatch(payload as SerializableDispatch);
            handleSuccess(saved);
        } catch (error: any) {
            handleError(error);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    useEffect(() => {
        if (open) {
            form.reset(isEditMode && dispatch ? {
                ...dispatch,
                loadingDate: new Date(dispatch.loadingDate),
                containerNos: initialContainerNos.length > 0 ? initialContainerNos : [{ value: "" }],
            } : {
                invoiceNo: "",
                customerName: "",
                customerCode: "",
                containerSize: "20ft",
                noOfContainer: 1,
                noOfCases: 0,
                containerInspectionRemark: "",
                trailerNo: "",
                driverCprNo: "",
                driverPhoneNo: "",
                containerNos: [{ value: "" }],
                loaderName: "",
                checkerName: "",
                modeOfTransport: "Road",
                status: "Pending",
            });
            setFiles([]);
            setUploadProgress(0);
        }
    }, [open, dispatch, isEditMode, form]);

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    {isEditMode ? (
                        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                    ) : (
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Dispatch
                        </Button>
                    )}
                </DialogTrigger>
                <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Edit Dispatch" : "Create New Dispatch"}</DialogTitle>
                        <DialogDescription>Fill in the details below. Fields with * are required.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-grow overflow-y-auto space-y-4 pr-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                            {/* Left Column */}
                            <div className="space-y-4">
                                <Card>
                                    <CardHeader><CardTitle>Dispatch Details</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Date and Time</Label>
                                            <Input value={format(new Date(), "dd MMM yyyy, hh:mm a")} readOnly disabled />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="invoiceNo">Invoice No*</Label>
                                            <Input id="invoiceNo" {...form.register("invoiceNo")} />
                                            {form.formState.errors.invoiceNo && <p className="text-red-500 text-xs">{form.formState.errors.invoiceNo.message}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="customerName">Customer Name*</Label>
                                            <Input id="customerName" {...form.register("customerName")} />
                                            {form.formState.errors.customerName && <p className="text-red-500 text-xs">{form.formState.errors.customerName.message}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="customerCode">Customer Code*</Label>
                                            <Input id="customerCode" {...form.register("customerCode")} />
                                            {form.formState.errors.customerCode && <p className="text-red-500 text-xs">{form.formState.errors.customerCode.message}</p>}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader><CardTitle>Container Information</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Controller
                                            name="loadingDate"
                                            control={form.control}
                                            render={({ field }) => (
                                                <div className="space-y-2">
                                                    <Label>Loading Date*</Label>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                                    </Popover>
                                                    {form.formState.errors.loadingDate && <p className="text-red-500 text-xs">{form.formState.errors.loadingDate.message}</p>}
                                                </div>
                                            )}
                                        />
                                        <Controller
                                            name="containerSize"
                                            control={form.control}
                                            render={({ field }) => (
                                                <div className="space-y-2">
                                                    <Label>Container Size*</Label>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <SelectTrigger><SelectValue placeholder="Select size..." /></SelectTrigger>
                                                        <SelectContent>
                                                            {containerSizes.map(s => <SelectItem key={s.id} value={s.size}>{s.size}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    {form.formState.errors.containerSize && <p className="text-red-500 text-xs">{form.formState.errors.containerSize.message}</p>}
                                                </div>
                                            )}
                                        />
                                        <div className="space-y-2">
                                            <Label htmlFor="noOfContainer">No of Containers*</Label>
                                            <Input id="noOfContainer" type="number" {...form.register("noOfContainer")} />
                                            {form.formState.errors.noOfContainer && <p className="text-red-500 text-xs">{form.formState.errors.noOfContainer.message}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="noOfCases">No of Cases*</Label>
                                            <Input id="noOfCases" type="number" {...form.register("noOfCases")} />
                                            {form.formState.errors.noOfCases && <p className="text-red-500 text-xs">{form.formState.errors.noOfCases.message}</p>}
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label>Container Nos*</Label>
                                            {fields.map((field, index) => (
                                                <div key={field.id} className="flex items-center gap-2">
                                                    <Input
                                                        {...form.register(`containerNos.${index}.value`)}
                                                        placeholder={`Container No ${index + 1}`}
                                                    />
                                                </div>
                                            ))}
                                            {form.formState.errors.containerNos && <p className="text-red-500 text-xs">{form.formState.errors.containerNos.message}</p>}
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label htmlFor="containerInspectionRemark">Container Inspection Remark</Label>
                                            <Textarea id="containerInspectionRemark" {...form.register("containerInspectionRemark")} />
                                        </div>
                                    </CardContent>
                                </Card>
                                
                                <Card>
                                    <CardHeader><CardTitle>Photo Upload</CardTitle></CardHeader>
                                    <CardContent>
                                        <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400">
                                            <input {...getInputProps()} />
                                            <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                                            {isDragActive ? <p>Drop the files here ...</p> : <p>Drag &apos;n&apos; drop some files here, or click to select files</p>}
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            {files.map((file, index) => (
                                                <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                                                    <span className="truncate">{file.name}</span>
                                                    <Button variant="ghost" size="icon" onClick={() => removeFile(index)}><X className="h-4 w-4" /></Button>
                                                </div>
                                            ))}
                                        </div>
                                        {uploadProgress > 0 && <Progress value={uploadProgress} className="w-full mt-4" />}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-4">
                                <Card>
                                    <CardHeader><CardTitle>Transport & Personnel</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <Controller
                                            name="modeOfTransport"
                                            control={form.control}
                                            render={({ field }) => (
                                                <div className="space-y-2">
                                                    <Label>Mode of Transport*</Label>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Sea">Sea</SelectItem>
                                                            <SelectItem value="Road">Road</SelectItem>
                                                            <SelectItem value="Air">Air</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        />
                                        <div className="space-y-2">
                                            <Label htmlFor="trailerNo">Trailer No*</Label>
                                            <Input id="trailerNo" {...form.register("trailerNo")} />
                                            {form.formState.errors.trailerNo && <p className="text-red-500 text-xs">{form.formState.errors.trailerNo.message}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="driverCprNo">Driver CPR No*</Label>
                                            <Input id="driverCprNo" {...form.register("driverCprNo")} />
                                            {form.formState.errors.driverCprNo && <p className="text-red-500 text-xs">{form.formState.errors.driverCprNo.message}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="driverPhoneNo">Driver Phone No*</Label>
                                            <Input id="driverPhoneNo" {...form.register("driverPhoneNo")} />
                                            {form.formState.errors.driverPhoneNo && <p className="text-red-500 text-xs">{form.formState.errors.driverPhoneNo.message}</p>}
                                        </div>
                                        <Controller
                                            name="loaderName"
                                            control={form.control}
                                            render={({ field }) => (
                                                <div className="space-y-2 flex flex-col">
                                                    <Label>Loader Name*</Label>
                                                    <Popover open={loaderOpen} onOpenChange={setLoaderOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={loaderOpen}
                                                                className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                                            >
                                                                {field.value
                                                                    ? uniqueUsers.find((user) => user.value === field.value)?.label
                                                                    : "Select loader..."}
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[300px] p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Search loader..." />
                                                                <CommandList>
                                                                    <CommandEmpty>No loader found.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {uniqueUsers.map((user) => (
                                                                            <CommandItem
                                                                                key={user.value}
                                                                                value={user.value}
                                                                                onSelect={(currentValue) => {
                                                                                    field.onChange(currentValue === field.value ? "" : currentValue);
                                                                                    setLoaderOpen(false);
                                                                                }}
                                                                            >
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-4 w-4",
                                                                                        field.value === user.value ? "opacity-100" : "opacity-0"
                                                                                    )}
                                                                                />
                                                                                {user.label}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                    {form.formState.errors.loaderName && <p className="text-red-500 text-xs">{form.formState.errors.loaderName.message}</p>}
                                                </div>
                                            )}
                                        />
                                        <Controller
                                            name="checkerName"
                                            control={form.control}
                                            render={({ field }) => (
                                                <div className="space-y-2 flex flex-col">
                                                    <Label>Checker Name*</Label>
                                                    <Popover open={checkerOpen} onOpenChange={setCheckerOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={checkerOpen}
                                                                className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                                            >
                                                                {field.value
                                                                    ? uniqueUsers.find((user) => user.value === field.value)?.label
                                                                    : "Select checker..."}
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[300px] p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Search checker..." />
                                                                <CommandList>
                                                                    <CommandEmpty>No checker found.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {uniqueUsers.map((user) => (
                                                                            <CommandItem
                                                                                key={user.value}
                                                                                value={user.value}
                                                                                onSelect={(currentValue) => {
                                                                                    field.onChange(currentValue === field.value ? "" : currentValue);
                                                                                    setCheckerOpen(false);
                                                                                }}
                                                                            >
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-4 w-4",
                                                                                        field.value === user.value ? "opacity-100" : "opacity-0"
                                                                                    )}
                                                                                />
                                                                                {user.label}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                    {form.formState.errors.checkerName && <p className="text-red-500 text-xs">{form.formState.errors.checkerName.message}</p>}
                                                </div>
                                            )}
                                        />
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader><CardTitle>Status</CardTitle></CardHeader>
                                    <CardContent>
                                        <Controller
                                            name="status"
                                            control={form.control}
                                            render={({ field }) => (
                                                <div className="space-y-2">
                                                    <Label>Dispatch Status*</Label>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Pending">Pending</SelectItem>
                                                            <SelectItem value="Loaded">Loaded</SelectItem>
                                                            <SelectItem value="Dispatched">Dispatched</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                        <DialogFooter className="mt-4 sticky bottom-0 bg-background pt-4 flex justify-between w-full">
                            <div className="flex gap-2 ml-auto">
                                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isEditMode ? "Save Changes" : "Create Dispatch"}
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to submit this dispatch?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={form.handleSubmit(handleConfirmSubmit)}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
