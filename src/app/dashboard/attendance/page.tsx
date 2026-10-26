import { redirect } from "next/navigation";
import { AttendanceClientPage } from "@/components/attendance/attendance-client-page";
import { requireActor } from "@/lib/attendance/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AttendancePage() {
  try {
    await requireActor("view");
  } catch {
    redirect("/dashboard");
  }
  return <AttendanceClientPage />;
}
