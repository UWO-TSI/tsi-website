import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin";
import { ORG_TYPES } from "@/lib/npo-applications";
import { npoSheetUrl } from "@/lib/npo-sheet";
import { PLAY_ORIGIN } from "@/lib/hosts";

export const metadata: Metadata = { title: "Nonprofit applications", robots: { index: false } };
export const dynamic = "force-dynamic";

const cell = { padding: "10px 12px", borderBottom: "1px solid rgba(241,255,255,0.1)", verticalAlign: "top" as const };

/** Nonprofit applications from /npo, for the admin whitelist (lib/supabase/admin.ts). */
export default async function NpoApplicationsAdmin() {
  const user = await createClient().then((s) => s.auth.getUser()).then((r) => r.data.user, () => null);
  const shell = (children: React.ReactNode) => (
    <main style={{ minHeight: "100vh", background: "#0f0f10", color: "#f1ffff", padding: "48px 24px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
    </main>
  );
  if (!user) return shell(<p>Sign in first: <a href={`${PLAY_ORIGIN}/?view=signin`} style={{ color: "#1d9bf0" }}>play.tethos.ca</a>, then reload this page.</p>);
  if (!isAdminEmail(user.email ?? "")) return shell(<p>This page is for the Tethos team. You&apos;re signed in as {user.email}.</p>);

  const admin = createAdminClient();
  const [{ data: rows, error }, sheet] = await Promise.all([
    admin.from("npo_applications").select("*").order("created_at", { ascending: false }).limit(500),
    npoSheetUrl().catch(() => null),
  ]);

  return shell(
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Nonprofit applications</h1>
      <p style={{ color: "rgba(241,255,255,0.6)", margin: "8px 0 24px" }}>
        {error ? "Couldn't load applications." : `${rows?.length ?? 0} applications, newest first.`}{" "}
        {sheet ? <a href={sheet} style={{ color: "#1d9bf0" }}>Open the Google Sheet</a> : "The Google Sheet is created with the first real application."}
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "rgba(241,255,255,0.55)" }}>
              {["Submitted", "Organization", "Contact", "What they need", "Can commit", "Cycle"].map((h) => <th key={h} style={cell}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td style={cell}>{new Date(r.created_at).toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" })}</td>
                <td style={cell}>
                  <strong>{r.org_name}</strong><br />
                  <span style={{ color: "rgba(241,255,255,0.6)" }}>{ORG_TYPES.find((t) => t.value === r.org_type)?.label}{r.city ? ` · ${r.city}` : ""}</span><br />
                  {r.website && <a href={r.website.startsWith("http") ? r.website : `https://${r.website}`} style={{ color: "#1d9bf0" }} rel="noopener noreferrer" target="_blank">{r.website}</a>}
                </td>
                <td style={cell}>{r.contact_name}{r.contact_role ? `, ${r.contact_role}` : ""}<br /><a href={`mailto:${r.contact_email}`} style={{ color: "#1d9bf0" }}>{r.contact_email}</a></td>
                <td style={{ ...cell, maxWidth: 420, whiteSpace: "pre-wrap" }}>{r.problem}{r.users ? `\n\nUsers: ${r.users}` : ""}{r.current_tools ? `\n\nNow using: ${r.current_tools}` : ""}</td>
                <td style={cell}>{r.can_commit ? "Yes" : "No"}</td>
                <td style={cell}>{r.cycle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
