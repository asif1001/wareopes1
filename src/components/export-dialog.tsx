
"use client";

import { useEffect, useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, File, AlertCircle } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { exportShipmentsAction } from "@/app/dashboard/shipments/actions";

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                </>
            ) : "Download CSV"}
        </Button>
    )
}

export function ExportDialog() {
    const [open, setOpen] = useState(false);
    const [date, setDate] = useState<DateRange | undefined>();
    const [state, formAction] = useActionState(exportShipmentsAction, {});

    useEffect(() => {
        if (state.csv) {
            const blob = new Blob([state.csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            const from = date?.from ? format(date.from, 'yyyy-MM-dd') : '';
            const to = date?.to ? format(date.to, 'yyyy-MM-dd') : '';
            link.setAttribute('download', `shipments_${from}_to_${to}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Reset state and close dialog
            state.csv = undefined;
            setOpen(false);
            setDate(undefined);
        }
    }, [state, date]);

    useEffect(() => {
        if (open) {
            // Reset state when dialog opens
            state.error = undefined;
            state.csv = undefined;
            setDate(undefined);
        }
    }, [open, state]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-10 gap-1">
                    <File className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Export
                    </span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Export Shipments</DialogTitle>
                    <DialogDescription>
                        Select a date range to export shipment data as a CSV file. The range is based on the 'Bahrain ETA'.
                    </DialogDescription>
                </DialogHeader>
                <form action={formAction}>
                    <div className="grid gap-4 py-4">
                        {state.error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{state.error}</AlertDescription>
                            </Alert>
                        )}
                        <input type="hidden" name="from" value={date?.from?.toISOString()} />
                        <input type="hidden" name="to" value={date?.to?.toISOString()} />
                        <div className="grid grid-cols-1 items-center gap-4">
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                "justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                date.to ? (
                                    <>
                                    {format(date.from, "LLL dd, y")} -{" "}
                                    {format(date.to, "LLL dd, y")}
                                    </>
                                ) : (
                                    format(date.from, "LLL dd, y")
                                )
                                ) : (
                                <span>Pick a date range</span>
                                )}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                            />
                            </PopoverContent>
                        </Popover>
                        </div>
                    </div>
                    <DialogFooter>
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
