import { redirect } from "next/navigation";
import { AttendanceClientPage } from "@/components/attendance/attendance-client-page";
import { ATTENDANCE_BASE, ATTENDANCE_SECTIONS, DEFAULT_ATTENDANCE_SECTION } from "@/components/attendance/sections";
import { requireActor } from "@/lib/attendance/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Props = { params: Promise<{ section: string }> };

export default async function AttendanceSectionPage({ params }: Props) {
  try {
    await requireActor("view");
  } catch {
    redirect("/dashboard");
  }
  const { section } = await params;
  if (section === DEFAULT_ATTENDANCE_SECTION || !ATTENDANCE_SECTIONS.some((s) => s.key === section)) redirect(ATTENDANCE_BASE);
  return <AttendanceClientPage section={section} />;
}
