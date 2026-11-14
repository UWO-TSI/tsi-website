import type { Metadata } from "next";
import ClubAdmin from "@/components/admin/ClubAdmin";

export const metadata: Metadata = { title: "Admin | Tethos", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The club admin dashboard: empty for now; the tools sit in the admin bar. */
export default function AdminHome() {
  return (
    <ClubAdmin path="/admin">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-[#9CA3AF]">Nothing here yet.</p>
    </ClubAdmin>
  );
}
