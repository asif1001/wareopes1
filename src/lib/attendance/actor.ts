import type { OvertimeRequest, Staff } from "./types";

/** A signed-in WareOps user acting in the Attendance module. */
export type Actor = {
  userId: string;
  role: string;
  isAdmin: boolean;
};

/** Admins see everyone; other users see the staff they supervise or back up. */
export function canManageStaff(actor: Actor, staff: Pick<Staff, "supervisorId" | "backupApproverId">) {
  return actor.isAdmin || staff.supervisorId === actor.userId || staff.backupApproverId === actor.userId;
}

export function canApproveOvertime(actor: Actor, ot: Pick<OvertimeRequest, "supervisorId" | "backupApproverId">) {
  return canManageStaff(actor, ot);
}

export function scopeStaff<T extends Pick<Staff, "supervisorId" | "backupApproverId">>(actor: Actor, staff: T[]): T[] {
  return actor.isAdmin ? staff : staff.filter((s) => canManageStaff(actor, s));
}
