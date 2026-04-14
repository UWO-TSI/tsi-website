"use client";

/**
 * Component Playground — Local-only test page for all UI/UX elements.
 * This page should NOT be deployed to production.
 * Access at: http://localhost:3000/dev/playground
 */

import { useState } from "react";
import PixelLogoCarousel from "@/components/ui/PixelLogoCarousel";
import Button from "@/components/ui/Button";

const testLogos = [
  { name: "World Vision" },
  { name: "Red Cross" },
  { name: "Tethos" },
  { name: "Plan International" },
  { name: "Childcan" },
];

const sections = [
  "Typography",
  "Colors",
  "Buttons",
  "Cards",
  "Pixel Carousel",
  "Spacing",
] as const;

export default function PlaygroundPage() {
  const [activeSection, setActiveSection] = useState<string>("Typography");

  return (
    <div className="min-h-screen bg-[#0F0F10] text-[#F1FFFF] p-8 pt-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#002FA7] mb-2">
            Dev Only
          </p>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Component Playground
          </h1>
          <p className="text-sm text-[#6B7280]">
            Test page for UI/UX elements. Not deployed to production.
          </p>
        </div>

        {/* Section nav */}
        <div className="flex gap-2 mb-12 flex-wrap">
          {sections.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-4 py-2 rounded-full text-xs font-mono transition-all border ${
                activeSection === s
                  ? "bg-[#002FA7]/15 text-[#002FA7] border-[#002FA7]/30"
                  : "text-[#6B7280] border-transparent hover:text-[#9CA3AF] hover:border-white/10"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ── Typography ── */}
        {activeSection === "Typography" && (
          <div className="space-y-8">
            <div>
              <p className="font-mono text-[10px] text-[#6B7280] mb-4 uppercase tracking-wider">
                Test Sohne (Headings)
              </p>
              <h1
                className="text-6xl font-bold tracking-tight mb-2"
                style={{ fontFamily: '"Test Sohne", sans-serif' }}
              >
                The quick brown fox
              </h1>
              <h2
                className="text-4xl font-semibold tracking-tight mb-2"
                style={{ fontFamily: '"Test Sohne", sans-serif' }}
              >
                jumps over the lazy dog
              </h2>
              <h3
                className="text-2xl font-semibold"
                style={{ fontFamily: '"Test Sohne", sans-serif' }}
              >
                ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789
              </h3>
            </div>

            <div>
              <p className="font-mono text-[10px] text-[#6B7280] mb-4 uppercase tracking-wider">
                Space Grotesk (Body)
              </p>
              <p className="text-lg leading-relaxed text-[#9CA3AF] max-w-xl">
                Tethos empowers students to deliver pro bono technology
                solutions for nonprofits, building real-world skills, ethical
                leadership, and community impact.
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] text-[#6B7280] mb-4 uppercase tracking-wider">
                IBM Plex Mono (Labels, Stats, Code)
              </p>
              <p className="font-mono text-sm text-[#002FA7] tracking-wider">
                PHASE 01 &middot; 2026-27 RECRUITMENT &middot; STATUS: READY
              </p>
              <p className="font-mono text-xs text-[#6B7280] mt-2">
                timestamp: 2026-04-13T05:00:00Z &middot; commits: 138 &middot;
                build: passing
              </p>
            </div>
          </div>
        )}

        {/* ── Colors ── */}
        {activeSection === "Colors" && (
          <div className="space-y-8">
            <div>
              <p className="font-mono text-[10px] text-[#6B7280] mb-4 uppercase tracking-wider">
                Core Palette
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: "Background", hex: "#0F0F10" },
                  { name: "IKB Blue", hex: "#002FA7" },
                  { name: "Yellow", hex: "#FFD166" },
                  { name: "Text Primary", hex: "#F1FFFF" },
                  { name: "Text Muted", hex: "#9CA3AF" },
                  { name: "Text Subtle", hex: "#6B7280" },
                  { name: "Green (Open)", hex: "#22C55E" },
                  { name: "Cyan (Accent)", hex: "#22D3EE" },
                ].map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg border border-white/10"
                      style={{ backgroundColor: c.hex }}
                    />
                    <div>
                      <p className="text-xs font-medium">{c.name}</p>
                      <p className="font-mono text-[10px] text-[#6B7280]">
                        {c.hex}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Buttons ── */}
        {activeSection === "Buttons" && (
          <div className="space-y-8">
            <div>
              <p className="font-mono text-[10px] text-[#6B7280] mb-4 uppercase tracking-wider">
                Button Variants
              </p>
              <div className="flex flex-wrap gap-4 items-center">
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary</Button>
                <a className="rounded-full px-6 py-3 text-sm font-medium text-[#FFD166] border border-[#FFD166]/20 hover:bg-[#FFD166]/5 transition-colors font-mono">
                  Yellow Accent
                </a>
                <a className="rounded-full px-6 py-3 text-sm font-medium text-[#9CA3AF] border border-white/10 hover:bg-white/5 transition-colors">
                  Ghost
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── Cards ── */}
        {activeSection === "Cards" && (
          <div className="space-y-8">
            <div>
              <p className="font-mono text-[10px] text-[#6B7280] mb-4 uppercase tracking-wider">
                Card Styles by Audience
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Student card - glass + hover effects */}
                <div className="rounded-2xl p-7 border border-white/10 bg-white/[0.04] hover:border-[#002FA7]/40 transition-all cursor-pointer">
                  <p className="font-mono text-[10px] text-[#6B7280] mb-3">
                    Student (Glass + Interactive)
                  </p>
                  <h3 className="text-lg font-semibold mb-2">VP Internal</h3>
                  <p className="text-sm text-[#9CA3AF]">
                    Lead internal operations and team culture.
                  </p>
                </div>

                {/* Company card - solid surface */}
                <div
                  className="rounded-2xl p-7"
                  style={{
                    background: "#1A1A1C",
                    border: "1px solid #2A2A2C",
                  }}
                >
                  <p className="font-mono text-[10px] text-[#6B7280] mb-3">
                    Company (Solid Surface)
                  </p>
                  <h3 className="text-lg font-semibold mb-2">Web Development</h3>
                  <p className="text-sm text-[#9CA3AF]">
                    Custom web applications built with modern frameworks.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Pixel Carousel ── */}
        {activeSection === "Pixel Carousel" && (
          <div className="space-y-8">
            <div>
              <p className="font-mono text-[10px] text-[#6B7280] mb-4 uppercase tracking-wider">
                Pixel Logo Carousel
              </p>
              <div className="flex flex-col items-center gap-8 py-12 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <PixelLogoCarousel
                  logos={testLogos}
                  pixelSize={6}
                  interval={2000}
                  transitionDuration={800}
                  width={360}
                  height={56}
                />
                <p className="text-xs text-[#6B7280] font-mono">
                  6px blocks &middot; 2s interval &middot; 800ms transition
                </p>
              </div>
            </div>

            <div>
              <p className="font-mono text-[10px] text-[#6B7280] mb-4 uppercase tracking-wider">
                Large variant (8px blocks)
              </p>
              <div className="flex flex-col items-center gap-8 py-12 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <PixelLogoCarousel
                  logos={testLogos}
                  pixelSize={8}
                  interval={3000}
                  transitionDuration={1000}
                  width={480}
                  height={72}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Spacing ── */}
        {activeSection === "Spacing" && (
          <div className="space-y-8">
            <p className="font-mono text-[10px] text-[#6B7280] mb-4 uppercase tracking-wider">
              Section Padding Reference
            </p>
            {[
              { name: "py-16 (64px)", cls: "py-16" },
              { name: "py-24 (96px) - Standard", cls: "py-24" },
              { name: "py-32 (128px) - Hero", cls: "py-32" },
            ].map((p) => (
              <div
                key={p.name}
                className={`${p.cls} rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center`}
              >
                <span className="font-mono text-xs text-[#6B7280]">
                  {p.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
