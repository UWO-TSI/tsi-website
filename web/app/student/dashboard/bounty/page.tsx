"use client";

import { useEffect, useState } from "react";
import { Scroll, Clock, SearchX, Send } from "lucide-react";
import type { Bounty } from "@/lib/supabase/types";
import BountySubmitModal from "@/components/portal/BountySubmitModal";
import { Amount } from "@/components/economy/Amount";
import { Badge, Banner, Button, Card, Empty, Loading, Sheet, Tabs, type BadgeTone } from "@/components/gui";

type Tab = "all" | "available" | "my_claims" | "completed";

/** Difficulty 1-3 (the bounties table), as a tag. */
const DIFFICULTY: Record<number, { tone: BadgeTone; label: string }> = {
  1: { tone: "success", label: "Easy" },
  2: { tone: "warn", label: "Medium" },
  3: { tone: "danger", label: "Hard" },
};

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "my_claims", label: "My claims" },
  { key: "completed", label: "Completed" },
];

export default function BountyPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [myClaims, setMyClaims] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<Bounty | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [submitting, setSubmitting] = useState<Bounty | null>(null);

  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (tab === "available") params.set("status", "open");
    if (tab === "completed") params.set("status", "completed");
    fetch(`/api/bounties?${params}`)
      .then((r) => r.ok ? r.json() : { bounties: [], myClaimedBountyIds: [] })
      .then((data) => {
        if (cancelled) return;
        setBounties(data.bounties ?? data ?? []);
        setMyClaims(new Set<string>(data.myClaimedBountyIds ?? []));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, fetchKey]);

  const handleClaim = async (id: string) => {
    setClaiming(true);
    try {
      const res = await fetch(`/api/bounties/${id}/claim`, { method: "POST" });
      if (res.ok) {
        setFetchKey((k) => k + 1);
        setSelected(null);
      }
    } catch { /* ignore */ }
    setClaiming(false);
  };

  const filtered = bounties.filter((b) => {
    if (tab === "available") return b.status === "open";
    if (tab === "completed") return b.status === "completed";
    if (tab === "my_claims") return myClaims.has(b.id);
    return true;
  });

  const detail = selected;
  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <Banner title="Bounty board" icon={<Scroll size={26} />} tone="butter">Real projects for our partners. Claim one, deliver it, get paid in Gems.</Banner>

        <Tabs label="Bounties" value={tab} onChange={setTab} tabs={TABS.map(t => ({ id: t.key, label: t.label }))} className="mb-6" />

        {loading ? <Loading label="Pinning up the bounties…" />
          : filtered.length === 0 ? (
            <Empty icon={<SearchX size={32} />} title={tab === "my_claims" ? "No claims yet" : tab === "completed" ? "Nothing finished yet" : "No bounties open right now"}>
              {tab === "my_claims" ? "Claim an open bounty and it shows up here." : tab === "completed" ? "Delivered bounties land here once they’re approved." : "New ones go up as partners send them. Check back soon."}
            </Empty>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {filtered.map((b, i) => (
                <BountyCard key={b.id} bounty={b} mine={myClaims.has(b.id)} tilt={[-0.8, 0.6, -0.4, 0.9][i % 4]} onClick={() => setSelected(b)} />
              ))}
            </div>
          )}
      </div>

      {/* Detail sheet */}
      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={detail?.title ?? ""} eyebrow={detail?.client_name ?? "Bounty"} icon={<Scroll size={22} />} size="lg"
        footer={detail && <BountyActions bounty={detail} mine={myClaims.has(detail.id)} claiming={claiming} onClaim={() => handleClaim(detail.id)} onSubmit={() => setSubmitting(detail)} />}>
        {detail && <>
          <div className="flex flex-wrap gap-2 mb-4">
            {DIFFICULTY[detail.difficulty] && <Badge tone={DIFFICULTY[detail.difficulty].tone}>{DIFFICULTY[detail.difficulty].label}</Badge>}
            {detail.tech_stack?.map((t) => <Badge key={t}>{t}</Badge>)}
          </div>
          <div className="space-y-2 mb-5 text-sm" style={{ color: "var(--gui-ink)" }}>
            <div className="flex items-center gap-2"><b>Pays</b> <Amount n={detail.pay_tc ?? 0} currency="gems" /></div>
            {detail.deadline && <div className="flex items-center gap-2"><Clock className="w-4 h-4" aria-hidden /> Due {formatDate(detail.deadline)}</div>}
          </div>
          <h3 className="text-sm mb-1" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>What to do</h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--gui-ink)" }}>{detail.description}</p>
        </>}
      </Sheet>

      {/* Submission modal */}
      {submitting && (
        <BountySubmitModal
          bounty={submitting}
          onClose={() => setSubmitting(null)}
          onSubmitted={() => {
            setFetchKey((k) => k + 1);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

/** What you can do with a bounty, in the sheet's footer. */
function BountyActions({ bounty, mine, claiming, onClaim, onSubmit }: { bounty: Bounty; mine: boolean; claiming: boolean; onClaim: () => void; onSubmit: () => void }) {
  if (bounty.status === "open") return <Button size="sm" onClick={onClaim} disabled={claiming}>{claiming ? "Claiming…" : "Claim this bounty"}</Button>;
  if (mine && (bounty.status === "claimed" || bounty.status === "in_progress")) return <Button size="sm" onClick={onSubmit}><Send className="w-4 h-4" aria-hidden /> Submit deliverables</Button>;
  if (mine && bounty.status === "review") return <Button size="sm" variant="secondary" onClick={onSubmit}>See your submission</Button>;
  if (bounty.status === "completed") return <Badge tone="success">Completed</Badge>;
  return <Badge>{bounty.status === "claimed" ? "Claimed" : "In progress"}</Badge>;
}

function BountyCard({ bounty, mine, tilt, onClick }: { bounty: Bounty; mine?: boolean; tilt: number; onClick: () => void }) {
  const diff = DIFFICULTY[bounty.difficulty];
  const isPastDeadline = bounty.deadline && new Date(bounty.deadline) < new Date();
  const status = bounty.status === "open" ? { tone: "sage" as const, label: "Open: claim it" }
    : mine && (bounty.status === "claimed" || bounty.status === "in_progress") ? { tone: "info" as const, label: "Yours: deliver it" }
    : bounty.status === "review" ? { tone: "warn" as const, label: "Under review" }
    : bounty.status === "completed" ? { tone: "success" as const, label: "Completed" }
    : { tone: "neutral" as const, label: bounty.status === "claimed" ? "Claimed" : "In progress" };
  return (
    <button type="button" onClick={onClick} className="text-left block w-full rounded-[18px] transition-transform hover:-translate-y-1" aria-label={`${bounty.title}, ${status.label}`}>
      <Card pinned tilt={tilt} className="h-full">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base line-clamp-2" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>{bounty.title}</h3>
          {diff && <Badge tone={diff.tone}>{diff.label}</Badge>}
        </div>
        {bounty.client_name && <p className="text-sm mb-2" style={{ color: "var(--gui-muted)" }}>For {bounty.client_name}</p>}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {bounty.tech_stack?.slice(0, 3).map((t) => <Badge key={t}>{t}</Badge>)}
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm" style={{ color: "var(--gui-ink)" }}><Amount n={bounty.pay_tc ?? 0} currency="gems" /></span>
          {bounty.deadline && <span className="text-sm" style={{ color: isPastDeadline ? "var(--gui-danger)" : "var(--gui-muted)", fontWeight: 700 }}>{isPastDeadline ? "Overdue" : `Due ${formatDate(bounty.deadline)}`}</span>}
        </div>
        <div className="mt-3"><Badge tone={status.tone}>{status.label}</Badge></div>
      </Card>
    </button>
  );
}
