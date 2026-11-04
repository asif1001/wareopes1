"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Inbox,
  LayoutDashboard,
  Loader2,
  MapPin,
  QrCode,
  Settings2,
  Smartphone,
  Timer,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DashboardHeader } from "@/components/dashboard-header";
import { api } from "./api";
import { AttendanceProvider, useAttendance } from "./context";
import { GateTab, useGateSites } from "./gate-tab";
import { OverviewTab } from "./overview-tab";
import { OvertimeTab } from "./overtime-tab";
import { RecordsTab } from "./records-tab";
import { ReminderSetupCard } from "./reminder-setup-card";
import { RequestsTab } from "./requests-tab";
import { ReportsTab } from "./reports-tab";
import { SectionHeader, SectionLayout, type SectionDef } from "./section-layout";
import { SettingsTab } from "./settings-tab";
import { CompaniesSection, HolidaysSection, ShiftsSection, SitesSection } from "./setup-tab";
import { StaffTab } from "./staff-tab";
import { TodayTab } from "./today-tab";

export function AttendanceClientPage() {
  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Attendance" />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <AttendanceProvider>
          <AttendanceSections />
        </AttendanceProvider>
      </main>
    </div>
  );
}

type Section = SectionDef & { title?: string; description?: ReactNode; render: () => ReactNode };

const DEFAULT_SECTION = "overview";
const COUNTS_REFRESH_MS = 2 * 60 * 1000;

/** The section is kept in the address (?section=…) so a refresh or a shared link opens the same screen. */
function useSectionParam() {
  const [section, setSection] = useState(DEFAULT_SECTION);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("section");
    if (fromUrl) setSection(fromUrl);
  }, []);
  const change = useCallback((key: string) => {
    setSection(key);
    const url = new URL(window.location.href);
    url.searchParams.set("section", key);
    window.history.replaceState(null, "", url);
  }, []);
  return [section, change] as const;
}

function AttendanceSections() {
  const { me, loading, error } = useAttendance();
  const [active, setActive] = useSectionParam();
  const [counts, setCounts] = useState<{ overtime: number; requests: number }>({ overtime: 0, requests: 0 });
  const showGate = useGateSites().length > 0;

  const loadCounts = useCallback(async () => {
    try {
      const res = await api<{ overtime?: number; requests?: number }>("/pending-count");
      setCounts({ overtime: res.overtime ?? 0, requests: res.requests ?? 0 });
    } catch {
      // badges are optional
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    void loadCounts();
    const timer = setInterval(() => void loadCounts(), COUNTS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [me, loadCounts, active]);

  const sections = useMemo<Section[]>(() => {
    if (!me) return [];
    const admin = me.canAdd || me.canEdit;
    return [
      {
        key: "overview",
        label: "Overview",
        icon: LayoutDashboard,
        group: "Daily",
        description: "Problems that need attention on the chosen day. Click a name to review or correct the day.",
        render: () => <OverviewTab onNavigate={setActive} />,
      },
      {
        key: "today",
        label: "Today",
        icon: CalendarCheck,
        group: "Daily",
        title: "Today's attendance",
        description: "Every staff member's IN, OUT and hours for the chosen day.",
        render: () => <TodayTab />,
      },
      {
        key: "gate",
        label: "Gate screens",
        icon: QrCode,
        group: "Daily",
        hidden: !showGate,
        description: "The check-in station for each site: a rotating site QR, and a reader for staff members' own QR.",
        render: () => <GateTab />,
      },
      {
        key: "overtime",
        label: "Overtime",
        icon: Timer,
        group: "Approvals",
        count: counts.overtime,
        description: "Overtime from late check-outs and days off is approved automatically. Review, change or reject it here.",
        render: () => <OvertimeTab />,
      },
      {
        key: "requests",
        label: "Requests",
        icon: Inbox,
        group: "Approvals",
        count: counts.requests,
        title: "Staff requests",
        description: "Time corrections, leave and reasons sent from the staff app.",
        render: () => <RequestsTab />,
      },
      {
        key: "records",
        label: "Records",
        icon: ClipboardList,
        group: "Records",
        title: "Attendance records",
        description: "Day-by-day records for any period. Click a day to see the raw check-ins or correct it.",
        render: () => <RecordsTab />,
      },
      {
        key: "reports",
        label: "Month report",
        icon: FileSpreadsheet,
        group: "Records",
        description: "Monthly totals per staff member and contract company, ready to export.",
        render: () => <ReportsTab />,
      },
      {
        key: "staff",
        label: "Staff",
        icon: Users,
        group: "People",
        description: "Staff accounts, their supervisors, shift, sites and phone. Staff log in to the app with their CPR number.",
        render: () => <StaffTab />,
      },
      {
        key: "companies",
        label: "Contract companies",
        icon: Building2,
        group: "Administration",
        hidden: !admin,
        render: () => <CompaniesSection />,
      },
      {
        key: "shifts",
        label: "Shifts",
        icon: Clock,
        group: "Administration",
        hidden: !admin,
        render: () => <ShiftsSection />,
      },
      {
        key: "sites",
        label: "Work sites",
        icon: MapPin,
        group: "Administration",
        hidden: !admin,
        render: () => <SitesSection />,
      },
      {
        key: "holidays",
        label: "Holidays",
        icon: CalendarDays,
        group: "Administration",
        hidden: !admin,
        render: () => <HolidaysSection />,
      },
      {
        key: "staff-app",
        label: "Staff app & reminders",
        icon: Smartphone,
        group: "Administration",
        hidden: !me.isAdmin,
        description: "Links to give staff (Android download and iPhone page) and the reminder schedule for iPhones.",
        render: () => <ReminderSetupCard />,
      },
      {
        key: "settings",
        label: "Rules & settings",
        icon: Settings2,
        group: "Administration",
        description: "How days and overtime are calculated, alerts, report access and the staff app version.",
        render: () => <SettingsTab />,
      },
    ];
  }, [me, showGate, counts, setActive]);

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

  const visible = sections.filter((s) => !s.hidden);
  const current = visible.find((s) => s.key === active) ?? visible[0];

  return (
    <SectionLayout sections={sections} active={current.key} onChange={setActive}>
      {(current.description || current.title) && (
        <SectionHeader
          title={current.title ?? current.label}
          description={current.description}
          actions={me.reportViewer && !me.isAdmin ? <Badge variant="outline">Read-only report access</Badge> : undefined}
        />
      )}
      <div key={current.key}>{current.render()}</div>
    </SectionLayout>
  );
}
