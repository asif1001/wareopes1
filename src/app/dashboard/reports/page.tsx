import { DashboardHeader } from "@/components/dashboard-header";
import { ReportGenerator } from "@/components/report-generator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetReports } from "@/components/reports/asset-reports";

export default function ReportsPage() {
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Reports" />
      <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
        <Tabs defaultValue="assets" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="assets">Operational Reports</TabsTrigger>
            <TabsTrigger value="generator">AI Generator</TabsTrigger>
          </TabsList>
          <TabsContent value="assets">
            <AssetReports />
          </TabsContent>
          <TabsContent value="generator">
            <ReportGenerator />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
