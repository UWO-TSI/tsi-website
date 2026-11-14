import type { Metadata } from "next";
import ClubAdmin from "@/components/admin/ClubAdmin";
import Attendance from "@/components/admin/Attendance";

export const metadata: Metadata = { title: "Attendance | Tethos admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function AttendancePage() {
  return <ClubAdmin path="/admin/attendance"><Attendance /></ClubAdmin>;
}
