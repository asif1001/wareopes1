
"use client"
import { useEffect, useState, useActionState, useRef } from "react";
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
import { saveContainerBookingsAction } from "@/app/dashboard/shipments/actions";
import { cn } from "@/lib/utils";
import { useFormStatus } from "react-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

type BookingFormData = {
    bookings: {
        containerNo: string;
        bookingDate?: Date;
    }[];
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Bookings
        </Button>
    )
}

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
    const [actionState, formAction] = useActionState(saveContainerBookingsAction, { success: false, error: null });
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
        if (actionState.success) {
            setOpen(false);
            toast({ title: "Container bookings saved successfully!" });
        }
    }, [actionState, toast]);

    useEffect(() => {
        if (open) {
            actionState.error = null;
            actionState.success = false;
            form.reset(getDefaultValues());
        }
    }, [open, shipment, form, actionState]);

    const watchBookings = form.watch("bookings");

    const getISODateString = (date: Date | null | undefined) => {
        return date ? format(date, 'yyyy-MM-dd') : '';
    }
    const preparedBookings = watchBookings.map(b => ({
        ...b,
        bookingDate: getISODateString(b.bookingDate)
    }));
    
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
                <form action={formAction} className="flex-grow flex flex-col overflow-hidden">
                    <div className="px-6 space-y-2 flex-shrink-0">
                        {actionState.error && (
                            <Alert variant="destructive" className="mb-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{actionState.error}</AlertDescription>
                            </Alert>
                        )}
                        <input type="hidden" name="shipmentId" value={shipment.id} />
                        <input type="hidden" name="bookings" value={JSON.stringify(preparedBookings)} />
                        
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
                                                    ref={el => inputRefs.current[index] = el}
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
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
