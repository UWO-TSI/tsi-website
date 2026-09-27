"use client";

import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

// Touch-first devices get the phone companion, the same test /student/companion uses.
const COARSE = "(pointer: coarse)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(COARSE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const Loading = () => <p style={{ padding: 32, color: "var(--color-text-muted)" }}>Preparing Tethos Island…</p>;

const DefaultIslandWorld = dynamic(() => import("@/components/game/DefaultIslandWorld"), { ssr: false, loading: Loading });

export default function DashboardHome() {
  // null until the client knows the pointer, so a phone never starts the 3D download.
  const coarse = useSyncExternalStore(subscribe, () => window.matchMedia(COARSE).matches, () => null);
  const router = useRouter();
  useEffect(() => { if (coarse) router.replace("/student/companion"); }, [coarse, router]);
  if (coarse !== false) return <Loading />;
  return <div style={{ "--island-top": "0px" } as CSSProperties}><DefaultIslandWorld /></div>;
}
