"use client";

/** The event check-in page: checks the signed-in member in as soon as it opens, in the GUI sheet's paper notice. */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { Card, ErrorNote, Loading } from "@/components/gui";
import { buttonLinkCls } from "@/components/portal/ProgressionAdminShared";
import { checkIn, checkInPath, type CheckInResult } from "@/lib/portal/checkIn";

export default function CheckIn({ event, code }: { event: string | null; code: string | null }) {
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!event || !code) return;
    let cancelled = false;
    void checkIn(event, code).then((r) => { if (!cancelled) setResult(r); });
    return () => { cancelled = true; };
  }, [event, code, attempt]);

  const home = <Link href="/" className={buttonLinkCls} data-size="sm" data-variant="quiet">Back to tethos.ca</Link>;
  let body: ReactNode;
  if (!event || !code) {
    body = <Notice title="This link is missing its code" actions={home}>Scan the QR code at the door again.</Notice>;
  } else if (!result) {
    body = <Loading label="Checking you in…" />;
  } else if (result.kind === "done") {
    body = (
      <Notice
        title={result.already ? "Already checked in" : "You’re checked in"}
        actions={<><Link href="/student/dashboard" className={buttonLinkCls} data-size="sm">Go to the island</Link>{home}</>}
      >
        {result.already
          ? `You checked in to ${result.title} earlier, so there’s nothing more to do.`
          : `Welcome to ${result.title}.${result.irl ? " The event’s XP and coins are in your account." : ""}`}
      </Notice>
    );
  } else if (result.kind === "signed-out") {
    body = (
      <Notice
        title="Sign in to check in"
        actions={<Link href={`/student?next=${encodeURIComponent(checkInPath(event, code))}`} className={buttonLinkCls} data-size="sm">Sign in</Link>}
      >
        Use your club account. You’ll come straight back here and be checked in.
      </Notice>
    );
  } else if (result.kind === "refused") {
    body = <Notice title="Can’t check you in" actions={home}>{result.message}</Notice>;
  } else {
    body = <ErrorNote onRetry={() => { setResult(null); setAttempt((n) => n + 1); }}>Check-in didn’t go through.</ErrorNote>;
  }

  return (
    <main className="gui" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "96px 16px 48px", background: "var(--gui-confetti) var(--gui-page)" }}>
      <Card pinned style={{ width: "100%", maxWidth: 460, padding: "36px 30px 28px" }}>
        <p className="flex items-center gap-2" style={{ margin: 0, fontSize: "var(--gui-text-xs)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--gui-muted)" }}>
          <CalendarCheck size={16} aria-hidden /> Event check-in
        </p>
        <div style={{ marginTop: 12 }}>{body}</div>
      </Card>
    </main>
  );
}

function Notice({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <h1 style={{ margin: "0 0 10px", fontSize: "var(--gui-text-2xl)", fontWeight: 900, color: "var(--gui-ink-strong)" }}>{title}</h1>
      <p style={{ margin: 0, fontSize: "var(--gui-text-md)", lineHeight: 1.6, color: "var(--gui-ink)" }}>{children}</p>
      {actions && <div className="flex flex-wrap gap-2.5" style={{ marginTop: 22 }}>{actions}</div>}
    </>
  );
}
