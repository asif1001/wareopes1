"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHeader } from "@/components/dashboard-header";
import { AttendanceProvider, useAttendance } from "./context";
import { OverviewTab } from "./overview-tab";
import { OvertimeTab } from "./overtime-tab";
import { RecordsTab } from "./records-tab";
import { ReportsTab } from "./reports-tab";
import { SettingsTab } from "./settings-tab";
import { SetupTab } from "./setup-tab";
import { StaffTab } from "./staff-tab";
import { TodayTab } from "./today-tab";

export function AttendanceClientPage() {
  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Attendance" />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <AttendanceProvider>
          <AttendanceTabs />
        </AttendanceProvider>
      </main>
    </div>
  );
}

function AttendanceTabs() {
  const { me, loading, error } = useAttendance();
  const [tab, setTab] = useState("overview");

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance…
      </div>
    );
  }
  if (error || !me) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Attendance is not available</AlertTitle>
        <AlertDescription>{error ?? "You do not have access to this module."}</AlertDescription>
      </Alert>
    );
  }

  const showSetup = me.canAdd || me.canEdit;

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="overtime">Overtime</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="reports">Month report</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          {showSetup && <TabsTrigger value="setup">Setup</TabsTrigger>}
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        {me.reportViewer && !me.isAdmin && <Badge variant="outline">Read-only report access</Badge>}
      </div>
      <TabsContent value="overview">
        <OverviewTab onOpenOvertime={() => setTab("overtime")} />
      </TabsContent>
      <TabsContent value="today">
        <TodayTab />
      </TabsContent>
      <TabsContent value="overtime">
        <OvertimeTab />
      </TabsContent>
      <TabsContent value="records">
        <RecordsTab />
      </TabsContent>
      <TabsContent value="reports">
        <ReportsTab />
      </TabsContent>
      <TabsContent value="staff">
        <StaffTab />
      </TabsContent>
      {showSetup && (
        <TabsContent value="setup">
          <SetupTab />
        </TabsContent>
      )}
      <TabsContent value="settings">
        <SettingsTab />
      </TabsContent>
    </Tabs>
  );
}
