"use client";

import { useEffect, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "@/lib/game/useMediaQuery";
import IslandLoading from "@/components/game/IslandLoading";

// The island's own loading screen from the first byte: the world keeps it up through warm-up, then fades it.
const Loading = () => <IslandLoading />;

const DefaultIslandWorld = dynamic(() => import("@/components/game/DefaultIslandWorld"), { ssr: false, loading: Loading });

export default function DashboardHome() {
  // null until the client knows the pointer, so a phone never starts the 3D download.
  // Touch-first devices get the phone companion, the same test /student/companion uses.
  const coarse = useMediaQuery("(pointer: coarse)", null);
  const router = useRouter();
  useEffect(() => { if (coarse) router.replace("/student/companion"); }, [coarse, router]);
  if (coarse !== false) return <Loading />;
  return <div style={{ "--island-top": "0px" } as CSSProperties}><DefaultIslandWorld /></div>;
}
