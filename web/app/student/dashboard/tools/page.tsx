"use client";

import Link from "next/link";
import { Brain, ArrowRight, Wrench } from "lucide-react";
import { Banner, Card } from "@/components/gui";

// The ASCII converter (/student/dashboard/tools/ascii) is still a "Coming soon" page, so it has no tile until it ships.
const tools = [
  {
    title: "Tethos RAG",
    description: "An AI assistant with the TSI knowledge base.",
    href: "/student/dashboard/tools/rag",
    icon: Brain,
    tint: "var(--gui-sage-soft)",
    ink: "var(--gui-sage)",
  },
];

export default function ToolsPage() {
  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Banner title="Tools" icon={<Wrench size={26} />} tone="sage">Internal utilities and integrations.</Banner>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.title}
                href={tool.href}
                className="group block rounded-[18px] transition-transform hover:-translate-y-1"
              >
                <Card className="h-full" style={{ padding: 22 }}>
                  <span
                    aria-hidden
                    className="grid place-items-center mb-4"
                    style={{ width: 52, height: 52, borderRadius: "var(--gui-r-blob)", background: tool.tint, color: tool.ink }}
                  >
                    <Icon size={26} />
                  </span>

                  <h2 className="text-base mb-1" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                    {tool.title}
                  </h2>
                  <p className="text-sm mb-4" style={{ color: "var(--gui-ink-2)" }}>
                    {tool.description}
                  </p>

                  <span className="inline-flex items-center gap-1.5 text-sm group-hover:gap-2.5 transition-all" style={{ color: "var(--gui-sage)", fontWeight: 800 }}>
                    Open
                    <ArrowRight size={16} aria-hidden />
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
