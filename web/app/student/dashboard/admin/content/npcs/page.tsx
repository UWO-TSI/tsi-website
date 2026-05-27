"use client";

import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import { useNPCPersonas } from "@/lib/game/contentLoader";

export default function AdminContentNPCsPage() {
  const { profile, loading } = useUser();
  const { data: npcs, isLoading } = useNPCPersonas();

  if (loading) {
    return (
      <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
        Loading...
      </p>
    );
  }

  const tier = profile?.tier ?? 5;
  if (tier > 2) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield
            size={48}
            className="mx-auto text-[var(--color-text-muted)]/20 mb-4"
          />
          <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)] mb-2">
            Access Denied
          </h2>
          <p className="text-sm font-mono text-[var(--color-text-muted)]">
            T1/T2 clearance required for content admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2">
        <Link
          href="/student/dashboard/admin"
          className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Admin
        </Link>
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          NPC Personas
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          {npcs.length} total · permanent + dynamic-filler characters
        </p>
      </div>

      <div className="mb-6 p-3 bg-[var(--color-brand-yellow)]/10 border border-[var(--color-brand-yellow)]/30 rounded-md">
        <p className="text-xs font-mono text-[var(--color-brand-yellow)]">
          Read-only this sprint. Editing lands in the admin-tooling sprint.
        </p>
      </div>

      {isLoading ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading personas...
        </p>
      ) : npcs.length === 0 ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)]">
          No NPC personas defined yet.
        </p>
      ) : (
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Slug
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Display Name
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Zone
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Permanent
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Active
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Sprite
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {npcs.map((npc) => (
                <tr
                  key={npc.id}
                  className="border-b border-[var(--glass-border)]/40 last:border-b-0"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-accent-cyan)]">
                    {npc.slug}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    {npc.display_name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                    {npc.spawn_zone}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded ${
                        npc.is_permanent
                          ? "text-[var(--color-brand-yellow)] bg-[var(--color-brand-yellow)]/10"
                          : "text-[var(--color-text-muted)] bg-[var(--color-text-muted)]/10"
                      }`}
                    >
                      {npc.is_permanent ? "permanent" : "dynamic"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded ${
                        npc.active
                          ? "text-green-400 bg-green-400/10"
                          : "text-[var(--color-text-muted)] bg-[var(--color-text-muted)]/10"
                      }`}
                    >
                      {npc.active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                    {npc.sprite_url ? (
                      <span className="text-[var(--color-text-soft)]">
                        {npc.sprite_url.split("/").pop()}
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]/50">
                        — pending —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[0.65rem] text-[var(--color-text-muted)]">
                    {new Date(npc.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
