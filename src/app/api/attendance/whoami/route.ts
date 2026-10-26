import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";
import { getRules } from "@/lib/attendance/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the signed-in user may do in the Attendance module (the UI hides the rest; the API enforces it). */
export async function GET() {
  try {
    const actor = await requireActor("view");
    const { getCurrentUserPermissions, hasPermission } = await import("@/lib/server-permissions");
    const { permissions } = await getCurrentUserPermissions();
    const can = (action: "add" | "edit" | "delete") => actor.isAdmin || hasPermission(permissions, "attendance", action);
    const rules = await getRules(await attendanceDb());
    return ok({
      me: {
        userId: actor.userId,
        role: actor.role,
        isAdmin: actor.isAdmin,
        reportViewer: !!actor.reportViewer,
        canAdd: can("add"),
        canEdit: can("edit"),
        canDelete: can("delete"),
        timezone: rules.timezone,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
