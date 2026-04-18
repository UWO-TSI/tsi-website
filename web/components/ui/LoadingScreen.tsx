"use client";

import { useEffect, useState } from "react";

export default function LoadingScreen() {
  const [phase, setPhase] = useState<"enter" | "visible" | "logo-out" | "bg-out" | "gone">(
    "enter"
  );

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase("visible"), 80);

    const startExit = () => {
      // Step 1: fade logo out (0.6s)
      setPhase("logo-out");
      // Step 2: after logo is gone, fade background out (1s)
      setTimeout(() => setPhase("bg-out"), 650);
      // Step 3: remove from DOM
      setTimeout(() => setPhase("gone"), 1700);
    };

    const minTimer = setTimeout(() => {
      if (document.readyState === "complete") {
        startExit();
      } else {
        window.addEventListener("load", startExit, { once: true });
      }
    }, 1200);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(minTimer);
      window.removeEventListener("load", startExit);
    };
  }, []);

  if (phase === "gone") return null;

  const entering = phase === "enter";
  const logoOut = phase === "logo-out";
  const bgOut = phase === "bg-out";

  return (
    <div
      className="ld-overlay"
      style={{
        opacity: bgOut ? 0 : 1,
        transition: "opacity 1s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div className="ld-glow ld-glow--purple" />
      <div className="ld-glow ld-glow--cyan" />

      <div
        className="ld-center"
        style={{
          opacity: entering || logoOut || bgOut ? 0 : 1,
          transform: entering
            ? "scale(0.7)"
            : logoOut || bgOut
              ? "scale(1.08)"
              : "scale(1)",
          filter: entering ? "blur(8px)" : "blur(0px)",
          transition: logoOut
            ? "opacity 0.6s ease, transform 0.6s ease"
            : "opacity 0.6s ease 0.1s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s, filter 0.6s ease 0.1s",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-dark.svg"
          alt=""
          width={96}
          height={96}
          draggable={false}
          className="ld-logo"
        />
      </div>
    </div>
  );
}
