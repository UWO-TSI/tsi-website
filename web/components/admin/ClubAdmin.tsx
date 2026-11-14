import Link from "next/link";
import type { ReactNode } from "react";
import { isAdminEmail } from "@/lib/supabase/admin";
import { signedInUser } from "@/lib/server/clubAdmin";
import AdminSignIn, { SignOutButton } from "./AdminSignIn";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/attendance", label: "Attendance" },
];

/** A club admin page (tethos.ca/admin): the sign-in gate, then the admin bar over the page. */
export default async function ClubAdmin({ path, children }: { path: string; children: ReactNode }) {
  const user = await signedInUser();
  if (!user) return <AdminSignIn path={path} />;
  if (!isAdminEmail(user.email ?? "")) return <AdminSignIn path={path} deniedEmail={user.email ?? ""} />;
  return (
    <div className="min-h-screen print:bg-white">
      <header className="border-b border-white/10 print:hidden">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-14 flex items-center gap-6 text-sm">
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#1D9BF0]">Tethos admin</span>
          <nav className="flex gap-4 overflow-x-auto">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={l.href === path ? "text-[#F1FFFF]" : "text-[#9CA3AF] hover:text-[#F1FFFF]"}>{l.label}</Link>
            ))}
          </nav>
          <span className="ml-auto hidden sm:inline text-[#9CA3AF] truncate">{user.email}</span>
          <SignOutButton className="text-[#9CA3AF] hover:text-[#F1FFFF] underline underline-offset-4" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 sm:px-8 py-10 print:p-0">{children}</main>
    </div>
  );
}
