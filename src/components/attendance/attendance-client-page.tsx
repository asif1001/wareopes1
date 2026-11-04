"use client";

import { type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DashboardHeader } from "@/components/dashboard-header";
import { AttendanceProvider, useAttendance } from "./context";
import { GateTab } from "./gate-tab";
import { OverviewTab } from "./overview-tab";
import { OvertimeTab } from "./overtime-tab";
import { RecordsTab } from "./records-tab";
import { ReminderSetupCard } from "./reminder-setup-card";
import { RequestsTab } from "./requests-tab";
import { ReportsTab } from "./reports-tab";
import { SectionHeader } from "./section-layout";
import { ATTENDANCE_SECTIONS, canOpenSection, sectionFromPath, sectionHref } from "./sections";
import { SettingsTab } from "./settings-tab";
import { CompaniesSection, HolidaysSection, ShiftsSection, SitesSection } from "./setup-tab";
import { StaffTab } from "./staff-tab";
import { TodayTab } from "./today-tab";

/** Shared by every Attendance page (navigation is in the WareOps sidebar), so data loads once. */
export function AttendanceLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const section = ATTENDANCE_SECTIONS.find((s) => s.key === sectionFromPath(pathname));
  return (
    // Exactly the screen height, so this area (not the window) scrolls and the page heading and
    // filter bars can stay fixed at its top.
    <div className="flex h-svh flex-col">
      <DashboardHeader title={section && section.key !== "overview" ? `Attendance · ${section.label}` : "Attendance"} />
      <main className="min-h-0 flex-1 overflow-auto px-4 pb-4 lg:px-6 lg:pb-6">
        <AttendanceProvider>
          <AttendanceGate>{children}</AttendanceGate>
        </AttendanceProvider>
      </main>
    </div>
  );
}

function AttendanceGate({ children }: { children: ReactNode }) {
  const { me, loading, error } = useAttendance();
  if (loading) {
    return (
      <div className="flex items-center gap-2 pt-4 text-muted-foreground lg:pt-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance…
      </div>
    );
  }
  if (error || !me) {
    return (
      <Alert variant="destructive" className="mt-4 lg:mt-6">
        <AlertTitle>Attendance is not available</AlertTitle>
        <AlertDescription>{error ?? "You do not have access to this module."}</AlertDescription>
      </Alert>
    );
  }
  return <>{children}</>;
}

type View = { title?: string; description?: ReactNode; render: (go: (key: string) => void) => ReactNode };

const VIEWS: Record<string, View> = {
  overview: {
    description: "Problems that need attention on the chosen day. Click a name to review or correct the day.",
    render: (go) => <OverviewTab onNavigate={go} />,
  },
  today: { title: "Today's attendance", description: "Every staff member's IN, OUT and hours for the chosen day.", render: () => <TodayTab /> },
  gate: {
    description: "The check-in station for each site: a rotating site QR, and a reader for staff members' own QR.",
    render: () => <GateTab />,
  },
  overtime: {
    description: "Overtime from late check-outs and days off is approved automatically. Review, change or reject it here.",
    render: () => <OvertimeTab />,
  },
  requests: { title: "Staff requests", description: "Time corrections, leave and reasons sent from the staff app.", render: () => <RequestsTab /> },
  records: {
    title: "Attendance records",
    description: "Day-by-day records for any period. Click a day to see the raw check-ins or correct it.",
    render: () => <RecordsTab />,
  },
  reports: { description: "Monthly totals per staff member and contract company, ready to export.", render: () => <ReportsTab /> },
  staff: {
    description: "Staff accounts, their supervisors, shift, sites and phone. Staff log in to the app with their CPR number.",
    render: () => <StaffTab />,
  },
  companies: { render: () => <CompaniesSection /> },
  shifts: { render: () => <ShiftsSection /> },
  sites: { render: () => <SitesSection /> },
  holidays: { render: () => <HolidaysSection /> },
  "staff-app": {
    title: "Staff app & reminders",
    description: "Links to give staff (Android download and iPhone page) and the reminder schedule for iPhones.",
    render: () => <ReminderSetupCard />,
  },
  settings: {
    title: "Rules & settings",
    description: "How days and overtime are calculated, alerts, report access and the staff app version.",
    render: () => <SettingsTab />,
  },
};

/** One Attendance section (chosen in the WareOps sidebar). */
export function AttendanceClientPage({ section }: { section: string }) {
  const { me } = useAttendance();
  const router = useRouter();
  const def = ATTENDANCE_SECTIONS.find((s) => s.key === section);
  const view = VIEWS[section];
  if (!def || !view) return null;
  if (!canOpenSection(def, me)) {
    return (
      <Alert className="mt-4 lg:mt-6">
        <AlertTitle>{def.label}</AlertTitle>
        <AlertDescription>You do not have access to this page.</AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="mx-auto max-w-[1600px]">
      {(view.title || view.description) && (
        <SectionHeader
          title={view.title ?? def.label}
          description={view.description}
          actions={me?.reportViewer && !me.isAdmin ? <Badge variant="outline">Read-only report access</Badge> : undefined}
        />
      )}
      {view.render((key) => router.push(sectionHref(key)))}
    </div>
  );
}
