import { redirect } from "next/navigation";
import { AttendanceClientPage } from "@/components/attendance/attendance-client-page";
import { ATTENDANCE_SECTIONS, DEFAULT_ATTENDANCE_SECTION, sectionHref } from "@/components/attendance/sections";
import { requireActor } from "@/lib/attendance/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Props = { searchParams: Promise<{ section?: string }> };

export default async function AttendancePage({ searchParams }: Props) {
  try {
    await requireActor("view");
  } catch {
    redirect("/dashboard");
  }
  // Older links used ?section=…; every section now has its own address.
  const { section } = await searchParams;
  if (section && section !== DEFAULT_ATTENDANCE_SECTION && ATTENDANCE_SECTIONS.some((s) => s.key === section)) redirect(sectionHref(section));
  return <AttendanceClientPage section={DEFAULT_ATTENDANCE_SECTION} />;
}
