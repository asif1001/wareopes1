
"use client";

import { useState, useActionState, useEffect } from "react";
import { saveAs } from "file-saver";
import { useFormStatus } from "react-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, Loader2 } from "lucide-react";
import { bulkAddShipmentsAction } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

const TEMPLATE_HEADERS = [
    "source", "invoice", "billOfLading", "containers", "bahrainEta",
    "originalDocumentReceiptDate", "actualBahrainEta", "lastStorageDay",
    "whEtaRequestedByParts", "whEtaConfirmedByLogistics", "cleared",
    "actualClearedDate", "totalCases", "domLines", "bulkLines",
    "generalRemark", "remark"
];

const TEMPLATE_EXAMPLE_ROW = {
    source: "US",
    invoice: "INV-123",
    billOfLading: "BL-456",
    containers: JSON.stringify([{ "size": "40FT", "quantity": 2 }]),
    bahrainEta: "2024-12-31",
    originalDocumentReceiptDate: "",
    actualBahrainEta: "",
    lastStorageDay: "",
    whEtaRequestedByParts: "",
    whEtaConfirmedByLogistics: "",
    cleared: "false",
    actualClearedDate: "",
    totalCases: "100",
    domLines: "50",
    bulkLines: "50",
    generalRemark: "Handle with care",
    remark: "Internal note"
};

function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={disabled || pending}>
            {pending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                </>
            ) : (
                <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Shipments
                </>
            )}
        </Button>
    )
}

export function BulkImport() {
    const [shipments, setShipments] = useState<any[]>([]);
    const [fileName, setFileName] = useState<string>("");
    const [actionState, formAction] = useActionState(bulkAddShipmentsAction, { error: null, success: null });
    const { toast } = useToast();

    useEffect(() => {
        if (actionState.success) {
            toast({
                title: "Import Successful",
                description: actionState.success,
            });
            setShipments([]);
            setFileName("");
        }
        if (actionState.error) {
            toast({
                title: "Import Error",
                description: actionState.error,
                variant: "destructive",
                duration: 10000, // Show error for longer
            });
        }
    }, [actionState, toast]);


    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const XLSX = await import("xlsx");
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: "array", cellDates: true });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, {
                         raw: false, // This will format dates as strings
                         dateNF: 'yyyy-mm-dd'
                    });
                    setShipments(json);
                } catch (error) {
                    console.error("Error parsing file:", error);
                    toast({
                        title: "File Read Error",
                        description: "Could not read or parse the selected file. Please ensure it is a valid Excel file.",
                        variant: "destructive"
                    });
                }
            };
            reader.readAsArrayBuffer(file);
        }
         event.target.value = ''; // Reset file input
    };

    const handleDownloadTemplate = async () => {
        const XLSX = await import("xlsx");
        const worksheet = XLSX.utils.json_to_sheet([TEMPLATE_EXAMPLE_ROW], { header: TEMPLATE_HEADERS });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Shipments");
        
        // This step is to ensure correct date formatting in Excel
        for (const cellAddress in worksheet) {
            if (cellAddress[0] === '!') continue;
            const cell = worksheet[cellAddress];
            if (cell.v instanceof Date) {
                cell.t = 'd';
                cell.z = 'yyyy-mm-dd';
            }
        }

        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
        saveAs(data, "shipment_template.xlsx");
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bulk Import Shipments</CardTitle>
                <CardDescription>
                    Upload an Excel file to add multiple shipments at once. Download the template to ensure the correct format.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>1. Download Template</Label>
                        <Button variant="outline" className="w-full" onClick={handleDownloadTemplate}>
                            <Download className="mr-2 h-4 w-4" />
                            Download Excel Template
                        </Button>
                        <p className="text-xs text-muted-foreground">The template includes required headers and an example row.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="file-upload">2. Upload File</Label>
                        <Input id="file-upload" type="file" onChange={handleFileChange} accept=".xlsx, .xls" />
                         {fileName && <p className="text-xs text-muted-foreground">Selected file: {fileName}</p>}
                    </div>
                </div>

                {shipments.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="font-medium">File Preview ({shipments.length} records)</h3>
                        <div className="rounded-md border max-h-64 overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice</TableHead>
                                        <TableHead>Source</TableHead>
                                        <TableHead>ETA</TableHead>
                                        <TableHead>Containers</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shipments.slice(0, 10).map((shipment, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{shipment.invoice}</TableCell>
                                            <TableCell>{shipment.source}</TableCell>
                                            <TableCell>{shipment.bahrainEta instanceof Date ? shipment.bahrainEta.toLocaleDateString() : shipment.bahrainEta}</TableCell>
                                            <TableCell className="text-xs">{typeof shipment.containers === 'string' ? shipment.containers : JSON.stringify(shipment.containers)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                             {shipments.length > 10 && <p className="text-center text-sm text-muted-foreground p-2">...and {shipments.length - 10} more rows.</p>}
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 <form action={formAction} className="w-full">
                    <input type="hidden" name="shipments" value={JSON.stringify(shipments)} />
                    <SubmitButton disabled={shipments.length === 0} />
                </form>
            </CardFooter>
        </Card>
    );
}
