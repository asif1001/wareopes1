"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDropzone } from "react-dropzone";
import { format, isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { usePagePermissions } from "@/hooks/use-page-permissions";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit, CalendarIcon, Loader2, UploadCloud, X, Check, ChevronsUpDown, Eye, Download, Pencil } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DispatchService } from "@/lib/firebase/firestore";
import { uploadDispatchContainerPhotos } from "@/lib/firebase/storage";
import { cn } from "@/lib/utils";
import type { SerializableDispatch, SerializableDispatchContainerPhoto, User, ContainerSize } from "@/lib/types";

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const dispatchContainerSchema = z.object({
    containerId: z.string().min(1),
    containerNumber: z.string().min(1, "Container number is required"),
    containerSize: z.string().min(1, "Container size is required"),
    bookingNumber: z.string().min(1, "Booking number is required"),
    bookingDate: z.date({ required_error: "Booking date is required." }),
    numberOfCases: z.coerce.number().min(1, "Number of cases must be at least 1"),
    status: z.enum(["Pending", "Loaded", "Dispatched"]),
    inspectionRemark: z.string().optional(),
    modeOfTransport: z.enum(["Sea", "Road", "Air"]),
    trailerNumber: z.string().min(1, "Trailer number is required"),
    driverCPR: z.string().min(1, "Driver CPR is required"),
    driverPhone: z.string().regex(phoneRegex, 'Invalid phone number'),
    driverName: z.string().min(1, "Driver name is required"),
    loaderName: z.string().min(1, "Loader name is required"),
    checkerName: z.string().min(1, "Checker name is required"),
});

const dispatchSchema = z.object({
    invoiceNo: z.string().min(1, "Invoice No is required"),
    customerName: z.string().min(1, "Customer name is required"),
    customerCode: z.string().min(1, "Customer Code is required"),
    numberOfCases: z.coerce.number().int().min(1, "Number of cases must be at least 1"),
    containers: z.array(dispatchContainerSchema).min(1, "At least one container is required"),
});

type DispatchFormValues = z.infer<typeof dispatchSchema>;
type ContainerFormValues = z.infer<typeof dispatchContainerSchema>;

function ContainerPhotoDropzone({ containerId, onFilesAdded }: { containerId: string; onFilesAdded: (containerId: string, files: File[]) => void }) {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: (acceptedFiles) => {
            if (acceptedFiles.length > 0) {
                onFilesAdded(containerId, acceptedFiles);
            }
        },
        accept: { "image/*": [] }
    });

    return (
        <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400">
            <input {...getInputProps()} />
            <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
            {isDragActive ? <p>Drop the files here ...</p> : <p>Drag &apos;n&apos; drop photos here, or click to select files</p>}
        </div>
    );
}

export function DispatchForm({ dispatch, isEditMode = false, users, containerSizes, onCreated, onUpdated, hidden }: {
    dispatch?: SerializableDispatch;
    isEditMode?: boolean;
    users: User[];
    containerSizes: ContainerSize[];
    onCreated?: (dispatch: SerializableDispatch) => void;
    onUpdated?: (dispatch: SerializableDispatch) => void;
    hidden?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [containerFiles, setContainerFiles] = useState<Record<string, File[]>>({});
    const { canAdd, canEdit } = usePagePermissions('dispatches');
    const [uploadProgressByContainer, setUploadProgressByContainer] = useState<Record<string, number>>({});
    const [existingPhotosByContainer, setExistingPhotosByContainer] = useState<Record<string, SerializableDispatchContainerPhoto[]>>({});
    const [containerDialogOpen, setContainerDialogOpen] = useState(false);
    const [editingContainerIndex, setEditingContainerIndex] = useState<number | null>(null);
    const [containerDraftId, setContainerDraftId] = useState<string | null>(null);
    const [containerLoaderOpen, setContainerLoaderOpen] = useState(false);
    const [containerCheckerOpen, setContainerCheckerOpen] = useState(false);
    const [containerBookingDateOpen, setContainerBookingDateOpen] = useState(false);
    const [containerViewOnly, setContainerViewOnly] = useState(false);

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

    const defaultContainerSize = useMemo(() => {
        return containerSizes.find((size) => size.size === "40ft")?.size || containerSizes[0]?.size || "40ft";
    }, [containerSizes]);

    const { toast } = useToast();

    const toValidDate = (value: unknown, fallback = new Date()) => {
        if (value instanceof Date) {
            return isValid(value) ? value : fallback;
        }
        if (typeof value === "string" || typeof value === "number") {
            const parsed = new Date(value);
            return isValid(parsed) ? parsed : fallback;
        }
        return fallback;
    };

    const getErrorMessage = (error: unknown) => {
        if (error instanceof Error) return error.message;
        if (typeof error === "string") return error;
        return "Something went wrong.";
    };

    const getErrorCode = (error: unknown) => {
        if (typeof error !== "object" || error === null) return undefined;
        const maybeCode = (error as { code?: unknown }).code;
        return typeof maybeCode === "string" ? maybeCode : undefined;
    };

    const buildContainerId = () => {
        if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.round(Math.random() * 100000)}`;
    };

    const legacyContainerIdRef = useRef<string | null>(null);

    const initialContainers = useMemo(() => {
        if (!dispatch) return [];
        if (dispatch.containers && dispatch.containers.length > 0) {
            return dispatch.containers.map((container) => ({
                containerId: container.containerId || buildContainerId(),
                containerNumber: container.containerNumber || "",
                containerSize: container.containerSize || defaultContainerSize,
                bookingNumber: container.bookingNumber || "",
                bookingDate: toValidDate(container.bookingDate),
                numberOfCases: container.numberOfCases || 0,
                status: container.status || dispatch.status || "Pending",
                inspectionRemark: container.inspectionRemark || "",
                modeOfTransport: container.transport?.modeOfTransport || "Road",
                trailerNumber: container.transport?.trailerNumber || "",
                driverCPR: container.transport?.driverCPR || "",
                driverPhone: container.transport?.driverPhone || "",
                driverName: container.transport?.driverName || "",
                loaderName: container.personnel?.loaderName || "",
                checkerName: container.personnel?.checkerName || "",
            }));
        }
        if (!legacyContainerIdRef.current) {
            legacyContainerIdRef.current = buildContainerId();
        }
        const containerId = legacyContainerIdRef.current;
        const containerNumber = dispatch.containerNo
            ? dispatch.containerNo.split(",")[0]?.trim() || ""
            : "";
        const containerSize = dispatch.containerSize || defaultContainerSize;
        const bookingDate = toValidDate(dispatch.dateTime);
        const numberOfCases = dispatch.noOfCases ?? 0;
        return [{
            containerId,
            containerNumber,
            containerSize,
            bookingNumber: "",
            bookingDate,
            numberOfCases,
            status: dispatch.status || "Pending",
            inspectionRemark: dispatch.containerInspectionRemark || "",
            modeOfTransport: dispatch.modeOfTransport || "Road",
            trailerNumber: dispatch.trailerNo || "",
            driverCPR: dispatch.driverCprNo || "",
            driverPhone: dispatch.driverPhoneNo || "",
            driverName: "",
            loaderName: dispatch.loaderName || "",
            checkerName: dispatch.checkerName || "",
        }];
    }, [dispatch, defaultContainerSize]);

    const initialNumberOfCases = useMemo(() => {
        if (!dispatch) return 1;
        const containers = dispatch.containers || [];
        const sum = containers.reduce((total, container) => total + Number(container.numberOfCases || 0), 0);
        if (sum > 0) return sum;
        return Math.max(1, Number(dispatch.noOfCases || 1));
    }, [dispatch]);

    const form = useForm<DispatchFormValues>({
        resolver: zodResolver(dispatchSchema),
        defaultValues: isEditMode && dispatch ? {
            invoiceNo: dispatch.invoiceNo,
            customerName: dispatch.customerName,
            customerCode: dispatch.customerCode,
            numberOfCases: initialNumberOfCases,
            containers: initialContainers,
        } : {
            invoiceNo: "",
            customerName: "",
            customerCode: "",
            numberOfCases: 1,
            containers: [],
        }
    });

    const { fields, append, update } = useFieldArray({
        control: form.control,
        name: "containers"
    });
    const watchedContainers = form.watch("containers") || [];

    const buildContainerDefaults = (containerId: string): ContainerFormValues => ({
        containerId,
        containerNumber: "",
        containerSize: defaultContainerSize,
        bookingNumber: "",
        bookingDate: new Date(),
        numberOfCases: 1,
        status: "Pending",
        inspectionRemark: "",
        modeOfTransport: "Road",
        trailerNumber: "",
        driverCPR: "",
        driverPhone: "",
        driverName: "",
        loaderName: "",
        checkerName: "",
    });

    const containerForm = useForm<ContainerFormValues>({
        resolver: zodResolver(dispatchContainerSchema),
        defaultValues: buildContainerDefaults(buildContainerId())
    });

    const addContainerFiles = (containerId: string, filesToAdd: File[]) => {
        setContainerFiles(prev => ({
            ...prev,
            [containerId]: [...(prev[containerId] || []), ...filesToAdd]
        }));
    };

    const removeContainerFile = (containerId: string, index: number) => {
        setContainerFiles(prev => ({
            ...prev,
            [containerId]: (prev[containerId] || []).filter((_, i) => i !== index)
        }));
    };

    const removeExistingPhoto = (containerId: string, photoUrl: string) => {
        setExistingPhotosByContainer(prev => ({
            ...prev,
            [containerId]: (prev[containerId] || []).filter((photo) => photo.downloadURL !== photoUrl)
        }));
    };

    const openAddContainerDialog = () => {
        const newId = buildContainerId();
        setEditingContainerIndex(null);
        setContainerDraftId(newId);
        setContainerViewOnly(false);
        setContainerBookingDateOpen(false);
        const numberOfCases = Math.max(1, Number(form.getValues("numberOfCases") || 1));
        containerForm.reset({ ...buildContainerDefaults(newId), numberOfCases });
        setContainerDialogOpen(true);
    };

    const openEditContainerDialog = (index: number) => {
        const values = form.getValues(`containers.${index}`);
        const containerId = values?.containerId || buildContainerId();
        setEditingContainerIndex(index);
        setContainerDraftId(containerId);
        setContainerViewOnly(false);
        setContainerBookingDateOpen(false);
        const numberOfCases = Math.max(1, Number(form.getValues("numberOfCases") || values?.numberOfCases || 1));
        containerForm.reset({ ...values, containerId, numberOfCases });
        setContainerDialogOpen(true);
    };

    const openViewContainerDialog = (index: number) => {
        const values = form.getValues(`containers.${index}`);
        const containerId = values?.containerId || buildContainerId();
        setEditingContainerIndex(index);
        setContainerDraftId(containerId);
        setContainerViewOnly(true);
        setContainerBookingDateOpen(false);
        const numberOfCases = Math.max(1, Number(form.getValues("numberOfCases") || values?.numberOfCases || 1));
        containerForm.reset({ ...values, containerId, numberOfCases });
        setContainerDialogOpen(true);
    };

    const handleContainerDialogOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            setContainerDialogOpen(true);
            return;
        }
        setContainerDialogOpen(false);
        setContainerLoaderOpen(false);
        setContainerCheckerOpen(false);
        setContainerBookingDateOpen(false);
        setContainerViewOnly(false);
        if (editingContainerIndex === null && containerDraftId) {
            setContainerFiles(prev => {
                const { [containerDraftId]: _, ...rest } = prev;
                return rest;
            });
            setExistingPhotosByContainer(prev => {
                const { [containerDraftId]: _, ...rest } = prev;
                return rest;
            });
        }
        setEditingContainerIndex(null);
        setContainerDraftId(null);
    };

    const saveContainer = containerForm.handleSubmit((values) => {
        const numberOfCases = Math.max(1, Number(form.getValues("numberOfCases") || values.numberOfCases || 1));
        const nextValues = { ...values, numberOfCases };
        
        console.log("Saving container:", nextValues);

        if (editingContainerIndex === null) {
            append(nextValues);
        } else {
            update(editingContainerIndex, nextValues);
        }
        setContainerDialogOpen(false);
        setEditingContainerIndex(null);
        setContainerDraftId(null);
        setContainerLoaderOpen(false);
        setContainerCheckerOpen(false);
        setContainerBookingDateOpen(false);
        setContainerViewOnly(false);
    }, (errors) => {
        console.error("Container form validation errors:", errors);
        const errorMessages = Object.entries(errors)
            .map(([key, error]) => `${key}: ${error?.message}`)
            .join(", ");
        
        toast({ 
            title: "Validation Error", 
            description: `Please fix the errors: ${errorMessages}`, 
            variant: "destructive" 
        });
    });

    const onSubmit = () => setShowConfirm(true);

    const handleConfirmSubmit = async (data: DispatchFormValues) => {
        setIsSubmitting(true);
        setShowConfirm(false);

        const handleSuccess = (saved?: SerializableDispatch) => {
            toast({ title: `Dispatch ${isEditMode ? 'updated' : 'created'} successfully!` });
            form.reset();
            setContainerFiles({});
            setUploadProgressByContainer({});
            setExistingPhotosByContainer({});
            setOpen(false);
            if (saved) {
                if (isEditMode) {
                    onUpdated?.(saved);
                } else {
                    onCreated?.(saved);
                }
            }
        };

        const handleError = (error: unknown) => {
            toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
        };

        try {
            const dateTime = isEditMode && dispatch ? dispatch.dateTime : new Date().toISOString();
            const baseContainers = data.containers.map((container) => ({
                containerId: container.containerId,
                containerNumber: container.containerNumber.trim(),
                containerSize: container.containerSize,
                bookingNumber: container.bookingNumber.trim(),
                bookingDate: toValidDate(container.bookingDate).toISOString(),
                numberOfCases: Number(data.numberOfCases || 0),
                status: container.status || "Pending",
                inspectionRemark: container.inspectionRemark || "",
                transport: {
                    modeOfTransport: container.modeOfTransport,
                    trailerNumber: container.trailerNumber.trim(),
                    driverCPR: container.driverCPR.trim(),
                    driverPhone: container.driverPhone.trim(),
                    driverName: container.driverName.trim(),
                },
                personnel: {
                    loaderName: container.loaderName.trim(),
                    checkerName: container.checkerName.trim(),
                },
                photos: [],
            }));

            const totalCases = Number(data.numberOfCases || 0);
            const containerNo = baseContainers.map((container) => container.containerNumber).filter(Boolean).join(", ");
            const primaryContainer = baseContainers[0];
            const derivedStatus = baseContainers.length === 0
                ? "Pending"
                : baseContainers.every((container) => container.status === "Dispatched")
                    ? "Dispatched"
                    : baseContainers.some((container) => container.status === "Loaded" || container.status === "Dispatched")
                        ? "Loaded"
                        : "Pending";

            const createPayload = {
                invoiceNo: data.invoiceNo,
                customerName: data.customerName,
                customerCode: data.customerCode,
                status: derivedStatus,
                dateTime,
                containers: baseContainers,
                noOfContainer: baseContainers.length,
                noOfCases: totalCases,
                containerNo,
                containerSize: primaryContainer?.containerSize,
                containerInspectionRemark: primaryContainer?.inspectionRemark,
                trailerNo: primaryContainer?.transport?.trailerNumber,
                driverCprNo: primaryContainer?.transport?.driverCPR,
                driverPhoneNo: primaryContainer?.transport?.driverPhone,
                loaderName: primaryContainer?.personnel?.loaderName,
                checkerName: primaryContainer?.personnel?.checkerName,
                modeOfTransport: primaryContainer?.transport?.modeOfTransport,
            } as Partial<SerializableDispatch>;

            const created = isEditMode && dispatch
                ? dispatch
                : await DispatchService.createDispatch(createPayload as SerializableDispatch);

            let uploadErrorMessage: string | null = null;
            const containersWithPhotos = await Promise.all(baseContainers.map(async (container) => {
                const existingPhotos = existingPhotosByContainer[container.containerId] || [];
                const filesToUpload = containerFiles[container.containerId] || [];
                let uploaded: { fileName: string; storagePath: string; downloadURL: string; uploadedAt: string }[] = [];

                if (filesToUpload.length > 0) {
                    try {
                        uploaded = await uploadDispatchContainerPhotos(
                            filesToUpload,
                            created.id,
                            container.containerId,
                            (progress) => setUploadProgressByContainer(prev => ({ ...prev, [container.containerId]: progress }))
                        );
                    } catch (error: unknown) {
                        if (!uploadErrorMessage) {
                            const message = getErrorMessage(error);
                            uploadErrorMessage = getErrorCode(error) === "storage/unauthorized"
                                ? "Photos were not uploaded due to permission. Dispatch was saved without photos."
                                : message === "Something went wrong."
                                    ? "Photo upload failed. Dispatch was saved without photos."
                                    : `Photo upload failed: ${message}`;
                        }
                    }
                }

                const photos = [
                    ...existingPhotos,
                    ...uploaded.map((photo) => ({
                        fileName: photo.fileName,
                        storagePath: photo.storagePath,
                        downloadURL: photo.downloadURL,
                        uploadedAt: photo.uploadedAt
                    }))
                ];

                return { ...container, photos };
            }));

            if (uploadErrorMessage) {
                toast({ title: "Photo Upload", description: uploadErrorMessage, variant: "destructive" });
            }

            const updatePayload = {
                ...createPayload,
                containers: containersWithPhotos,
            } as Partial<SerializableDispatch>;

            const saved = await DispatchService.updateDispatch(created.id, updatePayload);
            handleSuccess(saved);
        } catch (error: unknown) {
            handleError(error);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    useEffect(() => {
        if (open) {
            form.reset(isEditMode && dispatch ? {
                invoiceNo: dispatch.invoiceNo,
                customerName: dispatch.customerName,
                customerCode: dispatch.customerCode,
                numberOfCases: initialNumberOfCases,
                containers: initialContainers,
            } : {
                invoiceNo: "",
                customerName: "",
                customerCode: "",
                numberOfCases: 1,
                containers: [],
            });
            const nextPhotos: Record<string, SerializableDispatchContainerPhoto[]> = {};
            if (dispatch?.containers && dispatch.containers.length > 0) {
                dispatch.containers.forEach((container) => {
                    nextPhotos[container.containerId] = (container.photos || []).map((photo) => ({
                        fileName: photo.fileName,
                        storagePath: photo.storagePath,
                        downloadURL: photo.downloadURL,
                        uploadedAt: photo.uploadedAt
                    }));
                });
            } else if (dispatch?.photos && dispatch.photos.length > 0) {
                const legacyId = initialContainers[0]?.containerId || buildContainerId();
                nextPhotos[legacyId] = dispatch.photos.map((url) => ({
                    fileName: url.split("/").pop() || "photo",
                    storagePath: "",
                    downloadURL: url,
                    uploadedAt: dispatch.createdAt
                }));
            }
            setExistingPhotosByContainer(nextPhotos);
            setContainerFiles({});
            setUploadProgressByContainer({});
        }
    }, [open, dispatch, isEditMode, form, initialContainers, initialNumberOfCases, containerSizes]);

    const activeContainerId = containerForm.watch("containerId");
    const modalContainerId = activeContainerId || containerDraftId || "";
    const modalExistingPhotos = modalContainerId ? existingPhotosByContainer[modalContainerId] || [] : [];
    const modalContainerFiles = modalContainerId ? containerFiles[modalContainerId] || [] : [];
    const modalUploadProgress = modalContainerId ? uploadProgressByContainer[modalContainerId] || 0 : 0;
    const modalPrefix = modalContainerId || "container-modal";
    const modalContainerNumberId = `${modalPrefix}-number`;
    const modalBookingNumberId = `${modalPrefix}-booking-number`;
    const modalTrailerNumberId = `${modalPrefix}-trailer`;
    const modalDriverNameId = `${modalPrefix}-driver-name`;
    const modalDriverCprId = `${modalPrefix}-driver-cpr`;
    const modalDriverPhoneId = `${modalPrefix}-driver-phone`;

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                {isEditMode ? (
                    canEdit && !hidden && (
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                        </DialogTrigger>
                    )
                ) : (
                    canAdd && !hidden && (
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Dispatch
                            </Button>
                        </DialogTrigger>
                    )
                )}
                <DialogContent
                    className="max-w-5xl w-[96vw] max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden p-3"
                    onInteractOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    onClick={(event) => event.stopPropagation()}
                >
                    <DialogHeader className="pb-1">
                        <DialogTitle>{isEditMode ? "Edit Dispatch" : "Create New Dispatch"}</DialogTitle>
                        <DialogDescription>Fill in the details below. Fields with * are required.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
                        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] space-y-3 pr-3">
                            <div className="grid grid-cols-1 gap-3">
                                <Card>
                                    <CardHeader className="pb-1"><CardTitle>General Information</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                        <div className="space-y-2">
                                            <Label htmlFor="numberOfCases">Number of Cases*</Label>
                                            <Input id="numberOfCases" type="number" min={1} step={1} {...form.register("numberOfCases")} />
                                            {form.formState.errors.numberOfCases && <p className="text-red-500 text-xs">{form.formState.errors.numberOfCases.message}</p>}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Containers</CardTitle>
                                    <Button type="button" variant="outline" onClick={openAddContainerDialog}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Container
                                    </Button>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {watchedContainers.length === 0 ? (
                                        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                            No containers added yet.
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Container No</TableHead>
                                                        <TableHead>Booking Date</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {watchedContainers.map((container, index) => {
                                                        const bookingDate = toValidDate(container.bookingDate);
                                                        const bookingLabel = isValid(bookingDate) ? format(bookingDate, "PPP") : "—";
                                                        return (
                                                            <TableRow key={container.containerId || fields[index]?.id}>
                                                                <TableCell className="font-medium">
                                                                    {container.containerNumber || `Container ${index + 1}`}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {container.bookingDate ? bookingLabel : "—"}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => openViewContainerDialog(index)}
                                                                            aria-label="View container details"
                                                                        >
                                                                            <Eye className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => openEditContainerDialog(index)}
                                                                            aria-label="Edit container"
                                                                        >
                                                                            <Pencil className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                    {form.formState.errors.containers && typeof form.formState.errors.containers?.message === "string" && (
                                        <p className="text-red-500 text-xs">{form.formState.errors.containers?.message}</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                        <DialogFooter className="mt-auto border-t bg-background pt-4 pb-2 flex justify-end">
                            <div className="flex gap-2">
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

            <Dialog open={containerDialogOpen} onOpenChange={handleContainerDialogOpenChange}>
                <DialogContent
                    className="max-w-4xl w-[96vw] max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden p-3"
                    onInteractOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    onClick={(event) => event.stopPropagation()}
                >
                    <DialogHeader className="pb-1">
                        <DialogTitle>
                            {containerViewOnly ? "Container Details" : editingContainerIndex === null ? "Add Container" : "Edit Container"}
                        </DialogTitle>
                        <DialogDescription>
                            {containerViewOnly ? "Review container details below." : "Fill in container details, driver info, and photos."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={saveContainer} className="flex flex-col flex-1 min-h-0">
                        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] space-y-3 pr-3">
                            <input type="hidden" {...containerForm.register("containerId")} />
                            <input type="hidden" {...containerForm.register("numberOfCases")} />
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                <Card>
                                    <CardHeader className="pb-1"><CardTitle>Container Details</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label htmlFor={modalContainerNumberId}>Container Number*</Label>
                                            <Input id={modalContainerNumberId} {...containerForm.register("containerNumber")} disabled={containerViewOnly} />
                                            {containerForm.formState.errors.containerNumber && <p className="text-red-500 text-xs">{containerForm.formState.errors.containerNumber.message}</p>}
                                        </div>
                                        <Controller
                                            name="containerSize"
                                            control={containerForm.control}
                                            render={({ field }) => (
                                                <div className="space-y-2">
                                                    <Label>Container Size*</Label>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={containerViewOnly}>
                                                        <SelectTrigger><SelectValue placeholder="Select size..." /></SelectTrigger>
                                                        <SelectContent>
                                                            {containerSizes.map(s => <SelectItem key={s.id} value={s.size}>{s.size}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    {containerForm.formState.errors.containerSize && <p className="text-red-500 text-xs">{containerForm.formState.errors.containerSize.message}</p>}
                                                </div>
                                            )}
                                        />
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-1"><CardTitle>Booking Details</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label htmlFor={modalBookingNumberId}>Booking Number*</Label>
                                            <Input id={modalBookingNumberId} {...containerForm.register("bookingNumber")} disabled={containerViewOnly} />
                                            {containerForm.formState.errors.bookingNumber && <p className="text-red-500 text-xs">{containerForm.formState.errors.bookingNumber.message}</p>}
                                        </div>
                                        <Controller
                                            name="bookingDate"
                                            control={containerForm.control}
                                            render={({ field }) => (
                                                <div className="space-y-2">
                                                    <Label>Booking Date*</Label>
                                                    <Popover open={containerBookingDateOpen} onOpenChange={setContainerBookingDateOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                disabled={containerViewOnly}
                                                                className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                                                            >
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0">
                                                            <Calendar
                                                                mode="single"
                                                                selected={field.value}
                                                                onSelect={(date) => {
                                                                    if (!date) return;
                                                                    field.onChange(date);
                                                                    setContainerBookingDateOpen(false);
                                                                }}
                                                                initialFocus
                                                                disabled={containerViewOnly}
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                    {containerForm.formState.errors.bookingDate && <p className="text-red-500 text-xs">{containerForm.formState.errors.bookingDate.message}</p>}
                                                </div>
                                            )}
                                        />
                                        <Controller
                                            name="status"
                                            control={containerForm.control}
                                            render={({ field }) => (
                                                <div className="space-y-2">
                                                    <Label>Status*</Label>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={containerViewOnly}>
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
                            <Card>
                                <CardHeader className="pb-1"><CardTitle>Driver Details</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <Controller
                                        name="modeOfTransport"
                                        control={containerForm.control}
                                        render={({ field }) => (
                                            <div className="space-y-2">
                                                <Label>Mode of Transport*</Label>
                                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={containerViewOnly}>
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
                                        <Label htmlFor={modalTrailerNumberId}>Trailer Number*</Label>
                                        <Input id={modalTrailerNumberId} {...containerForm.register("trailerNumber")} disabled={containerViewOnly} />
                                        {containerForm.formState.errors.trailerNumber && <p className="text-red-500 text-xs">{containerForm.formState.errors.trailerNumber.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={modalDriverNameId}>Driver Name*</Label>
                                        <Input id={modalDriverNameId} {...containerForm.register("driverName")} disabled={containerViewOnly} />
                                        {containerForm.formState.errors.driverName && <p className="text-red-500 text-xs">{containerForm.formState.errors.driverName.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={modalDriverCprId}>Driver CPR*</Label>
                                        <Input id={modalDriverCprId} {...containerForm.register("driverCPR")} disabled={containerViewOnly} />
                                        {containerForm.formState.errors.driverCPR && <p className="text-red-500 text-xs">{containerForm.formState.errors.driverCPR.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={modalDriverPhoneId}>Driver Phone*</Label>
                                        <Input id={modalDriverPhoneId} {...containerForm.register("driverPhone")} disabled={containerViewOnly} />
                                        {containerForm.formState.errors.driverPhone && <p className="text-red-500 text-xs">{containerForm.formState.errors.driverPhone.message}</p>}
                                    </div>
                                </CardContent>
                            </Card>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="pb-1"><CardTitle>Personnel</CardTitle></CardHeader>
                                    <CardContent className="space-y-3">
                                        <Controller
                                            name="loaderName"
                                            control={containerForm.control}
                                            render={({ field }) => (
                                                <div className="space-y-2 flex flex-col">
                                                    <Label>Loader Name*</Label>
                                                    <Popover
                                                        open={containerViewOnly ? false : containerLoaderOpen}
                                                        onOpenChange={(nextOpen) => {
                                                            if (!containerViewOnly) {
                                                                setContainerLoaderOpen(nextOpen);
                                                            }
                                                        }}
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={containerLoaderOpen}
                                                                disabled={containerViewOnly}
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
                                                                                    setContainerLoaderOpen(false);
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
                                                    {containerForm.formState.errors.loaderName && <p className="text-red-500 text-xs">{containerForm.formState.errors.loaderName.message}</p>}
                                                </div>
                                            )}
                                        />
                                        <Controller
                                            name="checkerName"
                                            control={containerForm.control}
                                            render={({ field }) => (
                                                <div className="space-y-2 flex flex-col">
                                                    <Label>Checker Name*</Label>
                                                    <Popover
                                                        open={containerViewOnly ? false : containerCheckerOpen}
                                                        onOpenChange={(nextOpen) => {
                                                            if (!containerViewOnly) {
                                                                setContainerCheckerOpen(nextOpen);
                                                            }
                                                        }}
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={containerCheckerOpen}
                                                                disabled={containerViewOnly}
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
                                                                                    setContainerCheckerOpen(false);
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
                                                    {containerForm.formState.errors.checkerName && <p className="text-red-500 text-xs">{containerForm.formState.errors.checkerName.message}</p>}
                                                </div>
                                            )}
                                        />
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-1"><CardTitle>Inspection Remark</CardTitle></CardHeader>
                                    <CardContent>
                                        <Textarea {...containerForm.register("inspectionRemark")} disabled={containerViewOnly} />
                                    </CardContent>
                                </Card>
                            </div>
                            <Card>
                                <CardHeader className="pb-1"><CardTitle>Container Photos</CardTitle></CardHeader>
                                <CardContent className="space-y-3">
                                    {!containerViewOnly && (
                                        <ContainerPhotoDropzone containerId={modalContainerId} onFilesAdded={addContainerFiles} />
                                    )}
                                    {modalExistingPhotos.length > 0 && (
                                        <div className="space-y-2">
                                            {modalExistingPhotos.map((photo) => (
                                                <div key={photo.downloadURL} className="flex items-center justify-between gap-2 p-2 border rounded-lg">
                                                    <div className="flex-1 min-w-0">
                                                        <a href={photo.downloadURL} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">
                                                            {photo.fileName || photo.downloadURL}
                                                        </a>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button type="button" variant="ghost" size="icon" asChild>
                                                            <a href={photo.downloadURL} target="_blank" rel="noreferrer" aria-label="View photo">
                                                                <Eye className="h-4 w-4" />
                                                            </a>
                                                        </Button>
                                                        <Button type="button" variant="ghost" size="icon" asChild>
                                                            <a href={photo.downloadURL} download aria-label="Download photo">
                                                                <Download className="h-4 w-4" />
                                                            </a>
                                                        </Button>
                                                        {!containerViewOnly && (
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeExistingPhoto(modalContainerId, photo.downloadURL)} aria-label="Delete photo">
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {modalContainerFiles.length > 0 && (
                                        <div className="space-y-2">
                                            {modalContainerFiles.map((file, fileIndex) => {
                                                const previewUrl = URL.createObjectURL(file);
                                                return (
                                                    <div key={`${modalContainerId}-${fileIndex}`} className="flex items-center justify-between gap-2 p-2 border rounded-lg">
                                                        <span className="flex-1 min-w-0 truncate">{file.name}</span>
                                                        <div className="flex items-center gap-1">
                                                            <Button type="button" variant="ghost" size="icon" asChild>
                                                                <a href={previewUrl} target="_blank" rel="noreferrer" aria-label="View photo">
                                                                    <Eye className="h-4 w-4" />
                                                                </a>
                                                            </Button>
                                                            <Button type="button" variant="ghost" size="icon" asChild>
                                                                <a href={previewUrl} download={file.name} aria-label="Download photo">
                                                                    <Download className="h-4 w-4" />
                                                                </a>
                                                            </Button>
                                                            {!containerViewOnly && (
                                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeContainerFile(modalContainerId, fileIndex)} aria-label="Delete photo">
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {modalUploadProgress > 0 && <Progress value={modalUploadProgress} className="w-full" />}
                                </CardContent>
                            </Card>
                        </div>
                        <DialogFooter className="mt-auto border-t bg-background pt-4 pb-2 flex justify-end">
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => handleContainerDialogOpenChange(false)}>
                                    {containerViewOnly ? "Close" : "Cancel"}
                                </Button>
                                {!containerViewOnly && <Button type="submit">Save Container</Button>}
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
