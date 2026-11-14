import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ClubAdmin from "@/components/admin/ClubAdmin";
import { sheetSyncStatus } from "@/lib/google-sheets";
import { npoSheetUrl } from "@/lib/npo-sheet";

export const metadata: Metadata = { title: "Admin | Tethos", robots: { index: false } };
export const dynamic = "force-dynamic";

const TOOLS = [
  { href: "/admin/recruit", title: "Recruitment", line: "The applications board, archived rounds and the CSV export." },
  { href: "/admin/npo", title: "Nonprofit applications", line: "Every application from /npo, with its Google Sheet." },
  { href: "/admin/attendance", title: "Attendance", line: "A QR code for each club event. Members who scan it get the event's XP and coins on play.tethos.ca." },
];

const CARD = "rounded-xl border border-white/10 bg-white/[0.03] p-5";

/** The club admin home: the club's tools (game admin stays on play.tethos.ca) and the Google connection. */
export default function AdminHome() {
  return (
    <ClubAdmin path="/admin">
      <h1 className="text-3xl font-semibold tracking-tight">Club admin</h1>
      <p className="mt-2 text-[#9CA3AF]">Tools for running the club. Game tools stay in the game.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className={`${CARD} block hover:border-[#1D9BF0]/60 transition`}>
            <p className="font-semibold">{t.title} <span aria-hidden="true" className="text-[#1D9BF0]">→</span></p>
            <p className="mt-2 text-sm text-[#9CA3AF]">{t.line}</p>
          </Link>
        ))}
      </div>
      <Suspense fallback={<section className={`${CARD} mt-4 text-sm text-[#9CA3AF]`}>Checking Google…</section>}>
        <Google />
      </Suspense>
    </ClubAdmin>
  );
}

/** Google Drive and Sheets: where applications and resumes land, and whether the connection still works. */
async function Google() {
  const [status, npo] = await Promise.all([sheetSyncStatus().catch(() => null), npoSheetUrl().catch(() => null)]);
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const ok = status?.connection === "connected";
  const links = [
    { href: status?.url, label: "Applications sheet" },
    { href: npo, label: "Nonprofit applications sheet" },
    { href: folder ? `https://drive.google.com/drive/folders/${folder}` : null, label: "Resumes folder" },
  ].filter((l): l is { href: string; label: string } => !!l.href);
  return (
    <section className={`${CARD} mt-4`}>
      <p className="font-semibold">Google Drive and Sheets</p>
      <p className={`mt-2 text-sm ${ok ? "text-emerald-300" : "text-amber-300"}`}>
        {ok ? "Connected." : status?.connection_message ?? "Couldn't check the Google connection."}
      </p>
      {links.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {links.map((l) => <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="text-[#1D9BF0] underline underline-offset-4">{l.label}</a>)}
        </p>
      )}
    </section>
  );
}
