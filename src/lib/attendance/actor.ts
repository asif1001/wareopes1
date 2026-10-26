import type { OvertimeRequest, Staff } from "./types";

/** A signed-in WareOps user acting in the Attendance module. */
export type Actor = {
  userId: string;
  role: string;
  isAdmin: boolean;
  /** Listed by an admin in Attendance settings: read-only access to every staff member's records and reports. */
  reportViewer?: boolean;
};

type Assigned = Pick<Staff, "supervisorId" | "supervisor2Id">;

/** Admins, or Supervisor 1 / Supervisor 2 of this staff member: view, edit, correct and approve. */
export function canManageStaff(actor: Actor, staff: Assigned) {
  return actor.isAdmin || staff.supervisorId === actor.userId || staff.supervisor2Id === actor.userId;
}

/** Managers of the staff member, plus read-only report viewers. */
export function canViewStaff(actor: Actor, staff: Assigned) {
  return canManageStaff(actor, staff) || !!actor.reportViewer;
}

export function canApproveOvertime(actor: Actor, ot: Pick<OvertimeRequest, "supervisorId" | "supervisor2Id">) {
  return canManageStaff(actor, ot);
}

/** Staff whose records the actor may read. */
export function scopeStaff<T extends Assigned>(actor: Actor, staff: T[]): T[] {
  return actor.isAdmin || actor.reportViewer ? staff : staff.filter((s) => canManageStaff(actor, s));
}

/** Staff the actor may change or approve. */
export function scopeManagedStaff<T extends Assigned>(actor: Actor, staff: T[]): T[] {
  return actor.isAdmin ? staff : staff.filter((s) => canManageStaff(actor, s));
}
