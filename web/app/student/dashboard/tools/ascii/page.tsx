"use client";

import { ArrowLeft, Terminal } from "lucide-react";
import Link from "next/link";

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

export default function AsciiConverterPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/student/dashboard/tools"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-brand-blue)] transition-colors mb-3"
        >
          <ArrowLeft size={12} />
          Back to Tools
        </Link>
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          ASCII Converter
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          Image and text to ASCII art conversion
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
          {/* Terminal Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--color-bg-main)]">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
            <span className="text-[0.65rem] font-mono text-[var(--color-text-muted)] ml-2 flex items-center gap-1.5">
              <Terminal size={12} />
              ascii-converter v0.1
            </span>
          </div>

          {/* Terminal Body */}
          <div className="p-6">
            <pre className="font-mono text-[0.55rem] leading-tight text-[var(--color-accent-cyan)] mb-6 overflow-x-auto">
              {asciiArt}
            </pre>

            <div className="border border-dashed border-[var(--glass-border)] rounded-md p-8 text-center">
              <Terminal size={32} className="text-[var(--color-text-muted)] mx-auto mb-3" />
              <p className="font-mono text-sm text-[var(--color-text-secondary)] mb-1">
                Tool integration coming soon.
              </p>
              <p className="font-mono text-xs text-[var(--color-text-muted)]">
                The ASCII converter will be embedded here.
              </p>
            </div>

            <div className="mt-6 space-y-1">
              <p className="font-mono text-[0.65rem] text-[var(--color-text-muted)]">
                <span className="text-[var(--color-accent-cyan)]">$</span> ascii-convert --help
              </p>
              <p className="font-mono text-[0.65rem] text-[var(--color-text-muted)]">
                Usage: ascii-convert [OPTIONS] &lt;input&gt;
              </p>
              <p className="font-mono text-[0.65rem] text-[var(--color-text-muted)]">
                &nbsp;&nbsp;--width &lt;cols&gt;&nbsp;&nbsp;&nbsp;Output width (default: 80)
              </p>
              <p className="font-mono text-[0.65rem] text-[var(--color-text-muted)]">
                &nbsp;&nbsp;--charset &lt;set&gt;&nbsp;&nbsp;Character set: standard, blocks, braille
              </p>
              <p className="font-mono text-[0.65rem] text-[var(--color-text-muted)]">
                &nbsp;&nbsp;--invert&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Invert brightness
              </p>
              <p className="font-mono text-[0.65rem] text-[var(--color-brand-yellow)] mt-2">
                <span className="text-[var(--color-accent-cyan)]">$</span> _<span className="animate-pulse">|</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
