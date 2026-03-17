"use client";

import Link from "next/link";
import { Terminal, Brain, ArrowRight } from "lucide-react";

const tools = [
  {
    title: "ASCII Converter",
    description: "Convert images and text to ASCII art for marketing",
    href: "/student/dashboard/tools/ascii",
    icon: Terminal,
    accentColor: "var(--color-accent-cyan)",
  },
  {
    title: "TETHOS RAG",
    description: "AI assistant with TSI knowledge base",
    href: "/student/dashboard/tools/rag",
    icon: Brain,
    accentColor: "var(--color-brand-blue)",
  },
];

export default function ToolsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          Tools
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          Internal utilities and integrations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.title}
              href={tool.href}
              className="group bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[0_0_16px_rgba(0,47,167,0.1)] transition-all"
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                style={{
                  backgroundColor: `color-mix(in srgb, ${tool.accentColor} 10%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${tool.accentColor} 20%, transparent)`,
                }}
              >
                <Icon size={24} style={{ color: tool.accentColor }} />
              </div>

              <h2 className="text-base font-heading font-bold text-[var(--color-text-primary)] mb-1">
                {tool.title}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                {tool.description}
              </p>

              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--color-brand-blue)] group-hover:gap-2.5 transition-all">
                Launch
                <ArrowRight size={12} />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
