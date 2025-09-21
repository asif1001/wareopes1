import { DashboardHeader } from "@/components/dashboard-header";
import { ReportGenerator } from "@/components/report-generator";

export default function ReportsPage() {
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Data Visualization" />
      <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
        <ReportGenerator />
      </main>
    </div>
  )
}
