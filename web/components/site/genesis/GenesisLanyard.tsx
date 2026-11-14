"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// The physics engine is WebAssembly: loaded only in the browser, and only once the section is near.
const Lanyard = dynamic(() => import("@/components/ui/Lanyard"), { ssr: false });

/** The GENESIS pass on its lanyard: mounted when the section comes near (so it drops in and swings as you arrive), drawn only while on screen. */
export default function GenesisLanyard() {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = box.current!;
    const io = new IntersectionObserver(([e]) => {
      setOnScreen(e.isIntersecting);
      if (e.isIntersecting) setNear(true);
    }, { rootMargin: "0px 0px -20% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Phones get the camera further back, so the card's swing stays inside the narrower stage.
  const [z] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? 15 : 10.5));
  return <div ref={box} className="gx-lanyard__stage" aria-hidden="true">{near && <Lanyard position={[0, 0, z]} fov={25} gravity={[0, -40, 0]} active={onScreen} />}</div>;
}
