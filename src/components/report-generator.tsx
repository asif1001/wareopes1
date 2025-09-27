"use client";

import { useFormStatus } from "react-dom";
import { generateReportAction } from "@/app/actions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Lightbulb, Loader2, BarChart, FileText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useActionState } from "react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        "Generate Report"
      )}
    </Button>
  );
}

export function ReportGenerator() {
  const initialState = { output: null, error: null };
  const [state, formAction] = useActionState(generateReportAction, initialState);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <form action={formAction}>
          <Card>
            <CardHeader>
              <CardTitle>Custom Report Generator</CardTitle>
              <CardDescription>
                Describe the data you want to visualize, and our AI will suggest the best way to present it.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="reportTitle">Report Title</Label>
                <Input id="reportTitle" name="reportTitle" placeholder="e.g., Q3 Inventory Turnover" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dataDescription">Data Description</Label>
                <Textarea id="dataDescription" name="dataDescription" placeholder="Describe the key metrics and dimensions, e.g., 'Monthly sales data for product categories X, Y, Z.'" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="userParameters">User Parameters</Label>
                <Textarea id="userParameters" name="userParameters" placeholder="Specify filters or focus areas, e.g., 'Focus on the US market for the last 6 months.'" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="preferredChartTypes">Preferred Chart Types (Optional)</Label>
                <Input id="preferredChartTypes" name="preferredChartTypes" placeholder="e.g., bar chart, line chart" />
              </div>
            </CardContent>
            <CardFooter>
              <SubmitButton />
            </CardFooter>
          </Card>
        </form>
      </div>

      <div className="lg:col-span-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Generated Report</CardTitle>
            <CardDescription>
              The AI-generated insights and chart suggestions will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            {!state.output && !state.error && (
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg h-full">
                <Lightbulb className="h-12 w-12 mb-4 text-primary" />
                <p className="text-lg font-medium">Your report is waiting to be created.</p>
                <p className="text-sm">Fill out the form to get started.</p>
              </div>
            )}
            {state.output && (
              <div className="space-y-6">
                <div className="p-4 border rounded-lg bg-background/50">
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-2"><FileText className="h-5 w-5 text-primary"/>Report Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{state.output.reportDescription}</p>
                </div>
                <div className="p-4 border rounded-lg bg-background/50">
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-2"><BarChart className="h-5 w-5 text-accent"/>Chart Suggestions</h3>
                   <p className="text-sm text-muted-foreground whitespace-pre-wrap">{state.output.chartSuggestions}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
