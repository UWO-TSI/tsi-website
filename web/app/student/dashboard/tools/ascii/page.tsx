"use client";

import { ArrowLeft, Terminal } from "lucide-react";
import Link from "next/link";
import { Banner, Card, Empty } from "@/components/gui";

const asciiArt = `
    ╔══════════════════════════════════════╗
    ║                                      ║
    ║   ████████╗███████╗████████╗██╗  ██╗ ║
    ║   ╚══██╔══╝██╔════╝╚══██╔══╝██║  ██║ ║
    ║      ██║   █████╗     ██║   ███████║  ║
    ║      ██║   ██╔══╝     ██║   ██╔══██║  ║
    ║      ██║   ███████╗   ██║   ██║  ██║  ║
    ║      ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ║
    ║                                      ║
    ║         ░░░ ASCII ENGINE ░░░         ║
    ║                                      ║
    ╚══════════════════════════════════════╝
`;

const PLANNED = [
  "Set the output width (80 columns unless you change it)",
  "Pick a character set: standard, blocks or braille",
  "Invert the brightness",
];

export default function AsciiConverterPage() {
  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href="/student/dashboard/tools"
          className="inline-flex items-center gap-1.5 mb-3 text-sm transition-colors text-[var(--gui-ink-2)] hover:text-[var(--gui-sage)]"
          style={{ fontWeight: 800, minHeight: 32 }}
        >
          <ArrowLeft size={16} aria-hidden />
          Back to tools
        </Link>

        <Banner title="ASCII converter" icon={<Terminal size={26} />} tone="sage">Turn images and text into ASCII art.</Banner>

        <Card style={{ padding: 22 }}>
          <pre
            className="text-xs leading-tight mb-4 overflow-x-auto"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "var(--gui-teal-ink)", background: "var(--gui-paper-warm)", borderRadius: 14, padding: "4px 12px" }}
          >
            {asciiArt}
          </pre>

          <Empty icon={<Terminal size={32} />} title="Coming soon">
            The converter will be built right into this page.
          </Empty>

          <div style={{ borderTop: "2px dashed var(--gui-paper-edge)", paddingTop: 16 }}>
            <h2 className="mb-2" style={{ fontSize: 15, fontWeight: 800, color: "var(--gui-ink-strong)" }}>What it will do</h2>
            <ul className="space-y-1 text-sm" style={{ color: "var(--gui-ink-2)", listStyle: "disc", paddingLeft: 20 }}>
              {PLANNED.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
