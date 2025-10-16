
"use client"
import { useEffect, useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Ship, CalendarIcon, Loader2, AlertCircle } from "lucide-react";
import type { SerializableShipment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type BookingFormData = {
    bookings: {
        containerNo: string;
        bookingDate: Date | undefined;
    }[];
};

function DatePickerField({ name, control }: { name: any, control: any }) {
    const [open, setOpen] = useState(false);

    return (
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
    );
}

const expandContainers = (shipment: SerializableShipment) => {
    return shipment.containers.flatMap(c => Array.from({ length: c.quantity }, () => ({ size: c.size })));
}

export function ContainerBookingModal({ shipment }: { shipment: SerializableShipment }) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const { toast } = useToast();
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const expanded = expandContainers(shipment);
    
    const getDefaultValues = () => {
        const bookings = shipment.bookings || [];
        return {
            bookings: expanded.map((_, index) => ({
                containerNo: bookings[index]?.containerNo || '',
                bookingDate: bookings[index]?.bookingDate ? new Date(bookings[index].bookingDate) : undefined
            }))
        }
    }
    
    const form = useForm<BookingFormData>({ defaultValues: getDefaultValues() });
    
    useEffect(() => {
        inputRefs.current = inputRefs.current.slice(0, expanded.length);
    }, [expanded.length]);


    useEffect(() => {
        if (submitError) {
            toast({
                title: "Error",
                description: submitError,
                variant: "destructive",
            });
            setSubmitError(null);
        }
    }, [submitError, toast]);

    useEffect(() => {
        if (open) {
            setSubmitError(null);
            form.reset(getDefaultValues());
        }
    }, [open, shipment, form]);

    const watchBookings = form.watch("bookings");

    const getISODateString = (date: Date | null | undefined) => {
        return date ? format(date, 'yyyy-MM-dd') : '';
    }
    const preparedBookings = watchBookings.map(b => ({
        ...b,
        bookingDate: getISODateString(b.bookingDate)
    }));
    const handleSubmit = async (data: BookingFormData) => {
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            const formData = new FormData();
            formData.append('shipmentId', shipment.id);
            formData.append('bookings', JSON.stringify(preparedBookings));

            const response = await fetch('/api/container-bookings', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save container bookings');
            }

            const result = await response.json();
            toast({ title: "Container bookings saved successfully!" });
            setOpen(false);
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            const nextIndex = index + 1;
            if (nextIndex < expanded.length) {
                inputRefs.current[nextIndex]?.focus();
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prevIndex = index - 1;
            if (prevIndex >= 0) {
                inputRefs.current[prevIndex]?.focus();
            }
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Ship className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0">
                 <DialogHeader className="p-6 pb-2 flex-shrink-0">
                    <DialogTitle>Container Booking</DialogTitle>
                    <DialogDescription>
                        Enter container numbers and booking dates for each container in the shipment.
                    </DialogDescription>
                    <div className="flex justify-between text-sm pt-2 text-muted-foreground">
                        <span><strong>Invoice:</strong> {shipment.invoice}</span>
                        <span><strong>B/L:</strong> {shipment.billOfLading}</span>
                    </div>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-grow flex flex-col overflow-hidden">
                    <div className="px-6 space-y-2 flex-shrink-0">
                        {submitError && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{submitError}</AlertDescription>
                            </Alert>
                        )}
                        
                        <div className="grid grid-cols-2 gap-x-4 px-1 pb-1 font-medium text-sm text-muted-foreground">
                            <Label>Container No.</Label>
                            <Label>Booking Date</Label>
                        </div>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto px-6">
                        <div className="space-y-2 py-2">
                            {expanded.map((container, index) => (
                                <div key={index} className="grid grid-cols-2 gap-x-4 items-center p-2 border rounded-md">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-muted-foreground w-8">{index + 1}.</span>
                                        <Controller
                                            name={`bookings.${index}.containerNo`}
                                            control={form.control}
                                            render={({ field }) => (
                                                <Input 
                                                    {...field}
                                                    ref={el => { inputRefs.current[index] = el; }}
                                                    onKeyDown={(e) => handleKeyDown(e, index)} 
                                                    placeholder={`(${container.size})`} 
                                                    className="uppercase" 
                                                />
                                            )}
                                        />
                                    </div>
                                    <div>
                                        <DatePickerField name={`bookings.${index}.bookingDate`} control={form.control} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                     <DialogFooter className="p-6 pt-4 flex-shrink-0 bg-background border-t">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Bookings
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
