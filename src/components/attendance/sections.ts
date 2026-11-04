import type { ComponentType } from "react";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Inbox,
  LayoutDashboard,
  MapPin,
  QrCode,
  Settings2,
  Smartphone,
  Timer,
  Users,
} from "lucide-react";

/** Who may open a section (the API enforces the same rules). */
export type SectionAccess = "all" | "setup" | "admin";

export type AttendanceSection = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: "Daily" | "Approvals" | "Records" | "People" | "Administration";
  access: SectionAccess;
  /** Which pending count to show next to it in the sidebar. */
  badge?: "overtime" | "requests";
};

export const ATTENDANCE_BASE = "/dashboard/attendance";
export const DEFAULT_ATTENDANCE_SECTION = "overview";

export const ATTENDANCE_SECTIONS: AttendanceSection[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, group: "Daily", access: "all" },
  { key: "today", label: "Today", icon: CalendarCheck, group: "Daily", access: "all" },
  { key: "gate", label: "Gate screens", icon: QrCode, group: "Daily", access: "all" },
  { key: "overtime", label: "Overtime", icon: Timer, group: "Approvals", access: "all", badge: "overtime" },
  { key: "requests", label: "Requests", icon: Inbox, group: "Approvals", access: "all", badge: "requests" },
  { key: "records", label: "Records", icon: ClipboardList, group: "Records", access: "all" },
  { key: "reports", label: "Month report", icon: FileSpreadsheet, group: "Records", access: "all" },
  { key: "staff", label: "Staff", icon: Users, group: "People", access: "all" },
  { key: "companies", label: "Contract companies", icon: Building2, group: "Administration", access: "setup" },
  { key: "shifts", label: "Shifts", icon: Clock, group: "Administration", access: "setup" },
  { key: "sites", label: "Work sites", icon: MapPin, group: "Administration", access: "setup" },
  { key: "holidays", label: "Holidays", icon: CalendarDays, group: "Administration", access: "setup" },
  { key: "staff-app", label: "Staff app", icon: Smartphone, group: "Administration", access: "admin" },
  { key: "settings", label: "Rules & settings", icon: Settings2, group: "Administration", access: "all" },
];

export const ATTENDANCE_GROUPS = ["Daily", "Approvals", "Records", "People", "Administration"] as const;

export type AttendanceAccess = { isAdmin: boolean; canAdd: boolean; canEdit: boolean };

export function canOpenSection(section: AttendanceSection, me: AttendanceAccess | null) {
  if (!me) return false;
  if (section.access === "admin") return me.isAdmin;
  if (section.access === "setup") return me.isAdmin || me.canAdd || me.canEdit;
  return true;
}

export const sectionHref = (key: string) => (key === DEFAULT_ATTENDANCE_SECTION ? ATTENDANCE_BASE : `${ATTENDANCE_BASE}/${key}`);

export function sectionFromPath(pathname: string | null) {
  if (!pathname?.startsWith(ATTENDANCE_BASE)) return null;
  const key = pathname.slice(ATTENDANCE_BASE.length).replace(/^\//, "").split("/")[0] || DEFAULT_ATTENDANCE_SECTION;
  return ATTENDANCE_SECTIONS.find((s) => s.key === key)?.key ?? DEFAULT_ATTENDANCE_SECTION;
}
