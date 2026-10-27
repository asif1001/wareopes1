"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AttendanceRules } from "@/lib/attendance/config";
import type { Contractor, DeviceHealth, Geofence, Holiday, Shift, StaffPublic } from "@/lib/attendance/types";
import { api } from "./api";

export type Me = {
  userId: string;
  role: string;
  isAdmin: boolean;
  reportViewer: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
  timezone: string;
};

export type StaffRow = StaffPublic & { deviceHealth: Partial<DeviceHealth> | null; deviceIssues: string[] };
export type Approver = { id: string; name: string; employeeNo: string; role: string };

type Refs = {
  me: Me | null;
  staff: StaffRow[];
  contractors: Contractor[];
  shifts: Shift[];
  geofences: Geofence[];
  holidays: (Holiday & { id: string })[];
  approvers: Approver[];
  rules: AttendanceRules | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** May this user change / approve records for this staff member? */
  manages: (staff: Pick<StaffPublic, "supervisorId" | "supervisor2Id"> | undefined) => boolean;
  staffById: Map<string, StaffRow>;
  userName: (id: string | null | undefined) => string;
  contractorName: (id: string) => string;
};

const AttendanceContext = createContext<Refs | null>(null);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<Refs, "reload" | "manages" | "staffById" | "userName" | "contractorName">>({
    me: null,
    staff: [],
    contractors: [],
    shifts: [],
    geofences: [],
    holidays: [],
    approvers: [],
    rules: null,
    loading: true,
    error: null,
  });

  const reload = useCallback(async () => {
    try {
      const [who, staff, contractors, shifts, geofences, holidays, approvers, settings] = await Promise.all([
        api<{ me: Me }>("/whoami"),
        api<{ items: StaffRow[] }>("/staff"),
        api<{ items: Contractor[] }>("/setup/contractors"),
        api<{ items: Shift[] }>("/setup/shifts"),
        api<{ items: Geofence[] }>("/setup/geofences"),
        api<{ items: (Holiday & { id: string })[] }>("/setup/holidays"),
        api<{ items: Approver[] }>("/approvers"),
        api<{ rules: AttendanceRules }>("/settings"),
      ]);
      setState({
        me: who.me,
        staff: staff.items,
        contractors: contractors.items,
        shifts: shifts.items,
        geofences: geofences.items,
        holidays: holidays.items.sort((a, b) => a.date.localeCompare(b.date)),
        approvers: approvers.items,
        rules: settings.rules,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error: error instanceof Error ? error.message : "Could not load attendance" }));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<Refs>(() => {
    const staffById = new Map(state.staff.map((s) => [s.id, s]));
    const names = new Map(state.approvers.map((a) => [a.id, a.name]));
    const contractors = new Map(state.contractors.map((c) => [c.id, c.name]));
    return {
      ...state,
      reload,
      staffById,
      manages: (staff) =>
        !!state.me &&
        !!staff &&
        (state.me.isAdmin || staff.supervisorId === state.me.userId || staff.supervisor2Id === state.me.userId),
      userName: (id) => (id ? names.get(id) ?? id : "—"),
      contractorName: (id) => contractors.get(id) ?? "—",
    };
  }, [state, reload]);

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error("useAttendance must be used inside AttendanceProvider");
  return ctx;
}
