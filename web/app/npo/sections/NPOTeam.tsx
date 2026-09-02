"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ─── Team member data with approximate positions in photos ─────────── */

type Member = {
  name: string;
  initials: string;
  year: string;
  role: string;
  project: string;
  /** Position within the photo as percentages (x%, y%) */
  x: number;
  y: number;
  /** Which photo this person appears in (0-indexed) */
  photo: number;
};

const teamMembers: Member[] = [
  // Photo 0 — TeamPhoto.png (large group with Western banner)
  { name: "Sarah Chen", initials: "SC", year: "4th Year CS", role: "Project Lead", project: "Donor Nexus", x: 42, y: 38, photo: 0 },
  { name: "James Okafor", initials: "JO", year: "3rd Year SE", role: "Full-Stack Developer", project: "Hearth", x: 52, y: 42, photo: 0 },
  { name: "Priya Sharma", initials: "PS", year: "3rd Year CS", role: "UI/UX Designer", project: "Green Routes", x: 58, y: 38, photo: 0 },
  { name: "Marcus Lee", initials: "ML", year: "4th Year CS", role: "Backend Engineer", project: "Grant Glass", x: 35, y: 72, photo: 0 },
  { name: "Anika Patel", initials: "AP", year: "2nd Year SE", role: "Frontend Developer", project: "Pathways", x: 48, y: 72, photo: 0 },
  { name: "David Kim", initials: "DK", year: "3rd Year CS", role: "DevOps Lead", project: "Pulse", x: 62, y: 72, photo: 0 },
  // Photo 1 — team.png (lecture hall working session)
  { name: "Emily Tran", initials: "ET", year: "4th Year DS", role: "Data Engineer", project: "Donor Nexus", x: 38, y: 40, photo: 1 },
  { name: "Ryan Costa", initials: "RC", year: "3rd Year CS", role: "Mobile Developer", project: "Green Routes", x: 55, y: 55, photo: 1 },
  { name: "Mia Johnson", initials: "MJ", year: "2nd Year CS", role: "QA Engineer", project: "Hearth", x: 72, y: 35, photo: 1 },
  { name: "Alex Rivera", initials: "AR", year: "4th Year SE", role: "Tech Lead", project: "Grant Glass", x: 25, y: 60, photo: 1 },
  // Photo 2 — flag_signing.png
  { name: "Noah Park", initials: "NP", year: "2nd Year CS", role: "Backend Dev", project: "Pathways", x: 55, y: 45, photo: 2 },
];

const photos = [
  { src: "/images/TeamPhoto.png", alt: "TSI team group photo with Western banner", caption: "Genesis 2025 — Full Team" },
  { src: "/images/team.png", alt: "TSI team working session in lecture hall", caption: "Sprint Planning — Morrissette" },
  { src: "/images/flag_signing.png", alt: "Team member signing the TSI flag", caption: "Flag Signing — Cohort Tradition" },
];

/* ─── Hover hotspot on a photo ──────────────────────────────────────── */

function PersonHotspot({ member }: { member: Member }) {
  const [hovered, setHovered] = useState(false);
  const [tapped, setTapped] = useState(false);
  const show = hovered || tapped;

  // Position the card above if hotspot is in the lower half, below if upper
  const cardAbove = member.y > 50;

  return (
    <div
      style={{
        position: "absolute",
        left: `${member.x}%`,
        top: `${member.y}%`,
        transform: "translate(-50%, -50%)",
        zIndex: show ? 40 : 10,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setTapped((p) => !p);
      }}
    >
      {/* Pulsing hotspot dot */}
      <div
        style={{
          width: show ? 20 : 14,
          height: show ? 20 : 14,
          borderRadius: "50%",
          background: show ? "#002FA7" : "rgba(0, 47, 167, 0.6)",
          border: "2px solid rgba(241, 255, 255, 0.7)",
          cursor: "pointer",
          transition: "all 0.25s ease",
          boxShadow: show
            ? "0 0 20px rgba(0, 47, 167, 0.6), 0 0 40px rgba(0, 47, 167, 0.3)"
            : "0 0 8px rgba(0, 47, 167, 0.4)",
        }}
      />

      {/* Info card */}
      {show && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            [cardAbove ? "bottom" : "top"]: "calc(100% + 12px)",
            transform: "translateX(-50%)",
            background: "rgba(15, 15, 16, 0.92)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "14px 18px",
            minWidth: 190,
            zIndex: 50,
            animation: "teamCardIn 0.2s ease-out",
            pointerEvents: "none",
          }}
        >
          <p className="font-heading text-sm font-semibold" style={{ color: "#F5F5F5", marginBottom: 3 }}>
            {member.name}
          </p>
          <p className="font-mono text-[10px] tracking-wider" style={{ color: "#71717A", marginBottom: 2 }}>
            {member.year}
          </p>
          <p className="font-mono text-[10px] tracking-wider" style={{ color: "#002FA7", marginBottom: 8 }}>
            {member.role}
          </p>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 8 }} />
          <p className="font-mono text-[9px] tracking-widest uppercase" style={{ color: "#555" }}>
            Project: {member.project}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Single photo slide ────────────────────────────────────────────── */

function PhotoSlide({
  photo,
  members,
}: {
  photo: (typeof photos)[number];
  members: Member[];
}) {
  return (
    <div
      className="photo-slide"
      style={{
        position: "relative",
        minWidth: "clamp(70vw, 75vw, 900px)",
        height: "clamp(400px, 55vh, 600px)",
        borderRadius: 12,
        overflow: "hidden",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes="80vw"
        style={{ objectFit: "cover", pointerEvents: "none" }}
        priority
      />

      {/* Subtle vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(15,15,16,0.4) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Bottom gradient for caption */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 100,
          background: "linear-gradient(to top, rgba(15,15,16,0.85), transparent)",
          pointerEvents: "none",
        }}
      />

      {/* Caption */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 20,
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <p className="font-mono text-[10px] tracking-widest uppercase" style={{ color: "#999" }}>
          {photo.caption}
        </p>
      </div>

      {/* Person hotspots */}
      {members.map((member) => (
        <PersonHotspot key={member.name} member={member} />
      ))}
    </div>
  );
}

/* ─── Main gallery component ────────────────────────────────────────── */

export default function NPOTeam() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelector(".team-header"),
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );

      gsap.fromTo(
        el.querySelectorAll(".photo-slide"),
        { opacity: 0, x: 60 },
        {
          opacity: 1,
          x: 0,
          duration: 1.0,
          ease: "power3.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: el,
            start: "top 70%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    return () => ctx.revert();
  }, []);

  /* ── Drag-to-scroll ──────────────────────────────────────────────── */

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const track = trackRef.current;
    if (!track) return;
    isDragging.current = true;
    startX.current = e.pageX - track.offsetLeft;
    scrollLeft.current = track.scrollLeft;
    track.style.cursor = "grabbing";
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const track = trackRef.current;
    if (!track) return;
    e.preventDefault();
    const x = e.pageX - track.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    track.scrollLeft = scrollLeft.current - walk;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (trackRef.current) trackRef.current.style.cursor = "grab";
  }, []);

  return (
    <>
      <style jsx global>{`
        @keyframes teamCardIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(6px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }
        .team-track::-webkit-scrollbar {
          display: none;
        }
        .team-track {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <section
        ref={sectionRef}
        data-navbar-theme="dark"
        style={{
          background: "#0F0F10",
          paddingTop: "clamp(80px, 10vw, 140px)",
          paddingBottom: "clamp(80px, 10vw, 140px)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          className="team-header"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            paddingInline: "clamp(24px, 6vw, 80px)",
            marginBottom: 48,
            opacity: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
            <div>
              <span
                className="font-mono text-[11px] tracking-[0.3em] uppercase block mb-5"
                style={{ color: "#555" }}
              >
                The Team
              </span>
              <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight">
                Built by students{" "}
                <span className="italic font-light" style={{ color: "#888" }}>
                  who ship.
                </span>
              </h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "#555" }}>
                Drag to explore
              </span>
              <span style={{ color: "#555" }}>→</span>
            </div>
          </div>
        </div>

        {/* Horizontal scroll track */}
        <div
          ref={trackRef}
          className="team-track"
          style={{
            display: "flex",
            gap: "clamp(16px, 2vw, 24px)",
            overflowX: "auto",
            paddingInline: "clamp(24px, 6vw, 80px)",
            cursor: "grab",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {photos.map((photo, photoIdx) => (
            <PhotoSlide
              key={photo.src}
              photo={photo}
              members={teamMembers.filter((m) => m.photo === photoIdx)}
            />
          ))}
        </div>

        {/* Bottom hint */}
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            paddingInline: "clamp(24px, 6vw, 80px)",
            marginTop: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "#555" }}>
            Hover on the blue dots to meet the team
          </p>
          <p className="font-mono text-[10px] tracking-wider uppercase" style={{ color: "#555" }}>
            {photos.length} photos · {teamMembers.length} members
          </p>
        </div>
      </section>
    </>
  );
}
