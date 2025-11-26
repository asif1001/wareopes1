
"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SerializableShipment, SerializableContainerBooking } from "@/lib/types";
import { format, parseISO, differenceInDays, isToday, startOfDay } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Fragment } from "react";

type UpcomingBooking = {
    shipmentId: string;
    invoice: string;
    containerNo: string;
    bookingDate: string;
    source?: string | null;
}

type GroupedBookings = {
    [date: string]: {
        [invoice: string]: UpcomingBooking[];
    };
};

const getRelativeDateLabel = (date: Date, today: Date) => {
    if (isToday(date)) {
        return "(Today)";
    }
    const diff = differenceInDays(date, today);
    if (diff === 1) {
        return "(ETA 1 DAY)";
    }
    if (diff > 0) {
        return `(ETA ${diff} DAYS)`;
    }
    if (diff === -1) {
        return `(1 day ago)`
    }
    if (diff < 0) {
        return `(${Math.abs(diff)} days ago)`
    }
    return "";
};

export function RecentShipments({ shipments }: { shipments: SerializableShipment[] }) {
    const today = startOfDay(new Date());

    const groupedBookings = shipments
        .flatMap(shipment =>
            (shipment.bookings || []).map(booking => ({
                shipmentId: shipment.id,
                invoice: shipment.invoice,
                containerNo: booking.containerNo,
                bookingDate: booking.bookingDate,
                source: shipment.source ?? null,
            }))
        )
        .filter(booking => !booking.bookingDate || new Date(booking.bookingDate) >= today)
        .sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime())
        .reduce((acc, booking) => {
            const dateKey = format(parseISO(booking.bookingDate), 'yyyy-MM-dd');
            if (!acc[dateKey]) {
                acc[dateKey] = {};
            }
            if (!acc[dateKey][booking.invoice]) {
                acc[dateKey][booking.invoice] = [];
            }
            acc[dateKey][booking.invoice].push(booking);
            return acc;
        }, {} as GroupedBookings);

    const sortedDates = Object.keys(groupedBookings).sort();

    return (
        <Card className="flex flex-col h-full">
            <CardHeader>
                <CardTitle>Upcoming Container Bookings</CardTitle>
                <CardDescription>
                    Container bookings for cleared shipments arriving soon.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-auto">
                {sortedDates.length > 0 ? (
                    <div className="space-y-4">
                        {sortedDates.map((dateStr) => {
                            const date = parseISO(dateStr);
                            const relativeLabel = getRelativeDateLabel(date, today);
                            return (
                                <div key={dateStr}>
                                    <h4 className="font-semibold text-sm mb-2">
                                        Arriving on - {format(date, 'dd MMM yyyy')}
                                        <span className="ml-2 text-muted-foreground font-normal">{relativeLabel}</span>
                                    </h4>
                                    <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                                        {Object.keys(groupedBookings[dateStr]).map(invoice => (
                                            <div key={invoice}>
                                                <p className="text-xs text-muted-foreground">Inv No - <span className="font-medium text-foreground">{invoice}</span></p>
                                                <div className="mt-1">
                                                    <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground">
                                                        <div>Container No</div>
                                                        <div>Source</div>
                                                    </div>
                                                    <div className="pl-4 text-sm">
                                                        {groupedBookings[dateStr][invoice].map((booking, index) => (
                                                            <div key={index} className="grid grid-cols-2 gap-2">
                                                                <div className="text-foreground">{booking.containerNo}</div>
                                                                <div className="text-foreground">{booking.source || ''}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        No upcoming container bookings.
                    </div>
                )}
            </CardContent>
            {shipments.length > 0 && (
                <div className="p-4 border-t">
                    <Button variant="outline" className="w-full" asChild>
                        <Link href="/dashboard/shipments">View all shipments</Link>
                    </Button>
                </div>
            )}
        </Card>
    )
}
