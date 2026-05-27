"use client";

import { use, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import { createClient } from "@/lib/supabase/client";
import VersionHistory from "@/components/portal/VersionHistory";

export default function ShopItemHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { profile, loading } = useUser();
  const [displayName, setDisplayName] = useState<string>("");
  const [rowLoading, setRowLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("shop_items")
          .select("display_name")
          .eq("id", id)
          .single();
        if (!cancelled) {
          setDisplayName((data?.display_name as string) ?? "Shop Item");
        }
      } catch {
        if (!cancelled) setDisplayName("Shop Item");
      } finally {
        if (!cancelled) setRowLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading || rowLoading) {
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
    <VersionHistory
      tableName="shop_items"
      rowId={id}
      displayName={displayName}
    />
  );
}
