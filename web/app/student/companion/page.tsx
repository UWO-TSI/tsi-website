"use client";

/**
 * /student/companion (specs/companion.md): the lightweight phone shell —
 * bottom tab bar (Study, Club, Me), sign-in gate reusing the existing auth,
 * a link out to the full game for desktop. Fixed-position full-screen
 * `.shell`, same as the standalone study companion page it wraps.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Flag, Smile, type LucideIcon } from "lucide-react";
import { Loading, useSignInHref } from "@/components/gui";
import { ApiError, apiCall } from "@/lib/apiClient";
import { useCoarsePointer, useSearch } from "@/lib/game/useMediaQuery";
import StudyTab from "@/components/companion/StudyTab";
import ClubTab from "@/components/companion/ClubTab";
import MeTab from "@/components/companion/MeTab";
import s from "@/components/study/companion.module.css";

type Tab = "study" | "club" | "me";
/** Each section a rounded tile in its colour, like the phone apps in David's kit (they were emoji). */
const TABS: { key: Tab; label: string; icon: LucideIcon; tile: string }[] = [
  { key: "study", label: "Study", icon: BookOpen, tile: "#82d5bb" },
  { key: "club", label: "Club", icon: Flag, tile: "#889df0" },
  { key: "me", label: "Me", icon: Smile, tile: "#f8a6b2" },
];

type Gate = "checking" | "signed_out" | "ok";

export default function CompanionPage() {
  const [gate, setGate] = useState<Gate>("checking");
  const [tab, setTab] = useState<Tab>("study");
  // useSyncExternalStore under the hood: matches the SSR/hydration snapshot
  // first, then reconciles to the real value before paint, so this never
  // flashes the desktop notice at a phone.
  const pointerCoarse = useCoarsePointer();
  // `?mobile=1` (dev only, same convention as the study page's `?demo=`):
  // previews the phone shell from a mouse-driven browser, where a headless
  // or desktop browser always reports a fine pointer.
  const search = useSearch();
  const forceMobile = process.env.NODE_ENV !== "production" && search ? new URLSearchParams(search).get("mobile") === "1" : false;
  const coarse = pointerCoarse || forceMobile;

  useEffect(() => {
    let cancelled = false;
    apiCall("/api/identity/me", "identity").then(
      () => !cancelled && setGate("ok"),
      // A non-401 failure (offline, 503) fails open to the tabs rather than
      // locking a signed-in member out over a flaky check.
      (err) => !cancelled && setGate(err instanceof ApiError && err.status === 401 ? "signed_out" : "ok"),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (!coarse) return <DesktopNotice />;

  return (
    <div className={`${s.shell} gui`}>
      <div className={s.wrap} style={{ paddingBottom: 96 }}>
        <header className={s.top}>
          <h1>Tethos</h1>
        </header>
        {gate === "checking" ? <Loading label="Opening the club…" /> : null}
        {gate === "signed_out" ? <SignInGate /> : null}
        {gate === "ok" ? (
          <>
            {tab === "study" ? <StudyTab /> : null}
            {tab === "club" ? <ClubTab /> : null}
            {tab === "me" ? <MeTab /> : null}
          </>
        ) : null}
      </div>
      {gate === "ok" ? (
        <nav className={s.tabbar} aria-label="Companion sections">
          {TABS.map((t) => (
            <button key={t.key} className={s.tabbtn} aria-current={tab === t.key} onClick={() => setTab(t.key)}>
              <span className={s.appTile} style={{ "--tile": t.tile } as React.CSSProperties} aria-hidden><t.icon size={20} strokeWidth={2.4} /></span>
              {t.label}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function SignInGate() {
  // Signing in comes back to the companion (reachability §3; it went to the island before).
  const href = useSignInHref();
  return (
    <section className={s.card}>
      <h2>Sign in to open the club</h2>
      <p className={s.muted}>Study with the table, check bounties and events, and see your profile from your phone.</p>
      <div className={s.row} style={{ marginTop: 12 }}>
        <a className={s.btn} href={href} style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
          Sign in
        </a>
      </div>
    </section>
  );
}

function DesktopNotice() {
  return (
    <div className={`${s.shell} gui`}>
      <div className={s.wrap}>
        <section className={s.card}>
          <h2>This is the phone companion</h2>
          <p className={s.muted}>You&apos;re on a desktop — open the full 3D world instead.</p>
          <div className={s.row} style={{ marginTop: 12 }}>
            <Link className={s.btn} href="/student/dashboard" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
              Open the full game
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
