import type { ReactNode } from "react";
import { AttendanceLayoutClient } from "@/components/attendance/attendance-client-page";

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return <AttendanceLayoutClient>{children}</AttendanceLayoutClient>;
}
