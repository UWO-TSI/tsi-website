"use client";

import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className="max-w-md w-full rounded-2xl border p-8 text-center"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--glass-border-soft)",
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
          style={{ background: "rgba(255, 209, 102, 0.1)" }}
        >
          <Construction className="w-8 h-8" style={{ color: "#ffd166" }} />
        </div>

        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: "var(--color-text-main)" }}
        >
          {title}
        </h2>

        <p
          className="text-sm mb-6"
          style={{ color: "var(--color-text-muted)" }}
        >
          {description || "This building is under construction. Check back in Phase 2!"}
        </p>

        <div
          className="font-mono text-xs px-3 py-1.5 rounded-full inline-block"
          style={{
            background: "var(--surface-chip)",
            color: "var(--color-text-subtle)",
          }}
        >
          COMING SOON
        </div>

        {/* ASCII decoration */}
        <pre
          className="mt-6 font-mono text-[10px] leading-tight select-none"
          style={{ color: "var(--color-text-subtle)", opacity: 0.4 }}
        >
{`    ___________
   /           \\
  /  UNDER      \\
 / CONSTRUCTION  \\
/_____|____|______\\
      |    |
      |    |`}
        </pre>
      </div>
    </div>
  );
}
