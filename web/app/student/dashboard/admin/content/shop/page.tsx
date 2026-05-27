"use client";

import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import { useShopItems } from "@/lib/game/contentLoader";

const rarityColors: Record<string, string> = {
  common: "text-[var(--color-text-muted)] bg-[var(--color-text-muted)]/10",
  rare: "text-[var(--color-brand-blue)] bg-[var(--color-brand-blue)]/10",
  epic: "text-[#a78bfa] bg-[#a78bfa]/10",
  legendary: "text-[var(--color-brand-yellow)] bg-[var(--color-brand-yellow)]/10",
};

export default function AdminContentShopPage() {
  const { profile, loading } = useUser();
  const { data: items, isLoading } = useShopItems();

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
          Shop Items
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          {items.length} total · content_pipeline.shop_items
        </p>
      </div>

      <div className="mb-6 p-3 bg-[var(--color-brand-yellow)]/10 border border-[var(--color-brand-yellow)]/30 rounded-md">
        <p className="text-xs font-mono text-[var(--color-brand-yellow)]">
          Read-only this sprint. Editing lands in the admin-tooling sprint.
        </p>
      </div>

      {isLoading ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading items...
        </p>
      ) : items.length === 0 ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)]">
          No shop items defined yet.
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
                  Category
                </th>
                <th className="text-right px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Price
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Rarity
                </th>
                <th className="text-right px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Stock
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Active
                </th>
                <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Released
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--glass-border)]/40 last:border-b-0"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-accent-cyan)]">
                    {item.slug}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    {item.display_name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                    {item.category}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--color-brand-yellow)]">
                    ₮{item.tc_price}
                  </td>
                  <td className="px-4 py-3">
                    {item.rarity ? (
                      <span
                        className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded ${
                          rarityColors[item.rarity] ?? rarityColors.common
                        }`}
                      >
                        {item.rarity}
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]/50 font-mono text-xs">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--color-text-muted)]">
                    {item.stock === null ? "∞" : item.stock}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[0.6rem] font-mono uppercase px-2 py-0.5 rounded ${
                        item.active
                          ? "text-green-400 bg-green-400/10"
                          : "text-[var(--color-text-muted)] bg-[var(--color-text-muted)]/10"
                      }`}
                    >
                      {item.active ? "live" : "retired"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[0.65rem] text-[var(--color-text-muted)]">
                    {new Date(item.released_at).toLocaleDateString()}
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
