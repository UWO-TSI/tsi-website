"use client";

/** Admin merch fulfilment (T1/T2): hand over at HQ, or cancel with a Gems refund. */
import { useCallback, useEffect, useState } from "react";
import { PackageOpen } from "lucide-react";
import { GEMS } from "@/lib/economy";
import type { Reservation } from "@/lib/wallet/store";
import { ApiError } from "@/lib/apiClient";
import { httpEconomyTransport, type EconomyTransport } from "@/lib/wallet/transport";
import { Amount } from "@/components/economy/Amount";
import { Button, Card, Empty, Loading, Tabs } from "@/components/gui";
import { AdminMessage, thCls } from "@/components/portal/ProgressionAdminShared";

type Status = "reserved" | "fulfilled" | "cancelled";
const STATUS_TABS: { id: Status; label: string }[] = [
  { id: "reserved", label: "Waiting for pickup" },
  { id: "fulfilled", label: "Handed over" },
  { id: "cancelled", label: "Cancelled" },
];
const EMPTY: Record<Status, { title: string; text: string }> = {
  reserved: { title: "No pickups waiting", text: "When a member reserves merch, it shows up here with its pickup code." },
  fulfilled: { title: "Nothing handed over yet", text: "Merch you mark as handed over lands here." },
  cancelled: { title: "Nothing cancelled", text: "Cancelled reservations, refunded in Gems, land here." },
};
const reservedOn = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });
/** When a handed-over or cancelled reservation was closed (resolved_at); null while it waits. */
export const closedLabel = (r: Pick<Reservation, "resolved_at">) => (r.resolved_at ? `Closed ${reservedOn(r.resolved_at)}` : null);

export default function MerchFulfilment({ transport = httpEconomyTransport }: { transport?: EconomyTransport }) {
  const [status, setStatus] = useState<Status>("reserved");
  const [rows, setRows] = useState<Reservation[] | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try {
      setRows(await transport.adminReservations(status));
    } catch (err) {
      setRows([]);
      setMessage({ kind: "err", text: err instanceof ApiError ? err.message : "Couldn't load reservations." });
    }
  }, [transport, status]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    void load();
  }, [load]);
  const resolve = async (r: Reservation, action: "fulfil" | "cancel") => {
    if (action === "cancel" && typeof window !== "undefined" && !window.confirm(`Cancel ${r.member_name}'s ${r.item_name}? Their ${r.gems} ${GEMS.name} go back.`)) return;
    try {
      await transport.resolve(r.id, action, notes[r.id]);
      setMessage({ kind: "ok", text: action === "fulfil" ? `Handed over: ${r.item_name} to ${r.member_name}.` : `Cancelled and refunded ${r.gems} ${GEMS.name}.` });
      await load();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof ApiError ? err.message : "Couldn't update that reservation." });
    }
  };
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Merch pickups</h1>
      <p className="text-sm text-[var(--gui-muted)] mt-1 mb-4">Check the member’s pickup code, give them the item, then press Hand over. Cancelling refunds the Gems and returns the stock.</p>
      {/* A note belongs to the tab it happened on: switching tabs starts clean. */}
      <Tabs label="Reservations" value={status} onChange={(s) => { setMessage(null); setRows(null); setStatus(s); }} tabs={STATUS_TABS} className="mb-4" />
      <AdminMessage message={message} className="mb-4" />
      {rows === null ? (
        <Loading label="Loading the reservations…" />
      ) : rows.length === 0 ? (
        message?.kind === "err" ? null : <Empty icon={<PackageOpen size={32} />} title={EMPTY[status].title}>{EMPTY[status].text}</Empty>
      ) : (
        <Card className="overflow-x-auto" style={{ padding: 0 }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--gui-paper-warm)]">
                {["Code", "Member", "Item", "Gems", "Reserved", status === "reserved" ? "Note" : "Closed / note"].map((h) => <th key={h} className={thCls}>{h}</th>)}
                <th className={thCls}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t-2 border-dashed border-[var(--gui-paper-edge)]">
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-lg bg-[var(--gui-paper-deep)] px-2 py-0.5 font-extrabold tracking-[0.18em] text-[var(--gui-ink-strong)]">{r.pickup_code}</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-[var(--gui-ink)]">{r.member_name}</td>
                  <td className="px-4 py-3 text-[var(--gui-ink)]">{r.item_name}</td>
                  <td className="px-4 py-3 font-bold text-[var(--gui-ink)]"><Amount n={r.gems} currency="gems" /></td>
                  <td className="px-4 py-3 text-[13px] text-[var(--gui-ink-2)] whitespace-nowrap">{reservedOn(r.created_at)}</td>
                  <td className="px-4 py-3">
                    {r.status === "reserved" ? (
                      <input
                        className="w-full min-w-[10rem] min-h-[36px] px-3 py-1.5 rounded-[12px_10px_12px_11px] border-2 border-[var(--gui-paper-line)] bg-[var(--gui-paper-hi)] text-[13px] font-semibold text-[var(--gui-ink)] placeholder:text-[var(--gui-muted)] placeholder:font-normal focus:border-[var(--gui-sage)]"
                        placeholder="Optional note"
                        aria-label={`Note for ${r.member_name}'s ${r.item_name}`}
                        maxLength={200}
                        value={notes[r.id] ?? ""}
                        onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                      />
                    ) : (
                      <span className="text-[13px] text-[var(--gui-ink-2)]">
                        <span className="block whitespace-nowrap font-bold">{closedLabel(r) ?? "—"}</span>
                        {r.note && <span className="block">{r.note}</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.status === "reserved" ? (
                      <span className="inline-flex gap-2">
                        <Button size="sm" onClick={() => resolve(r, "fulfil")}>Hand over</Button>
                        <Button size="sm" variant="danger" onClick={() => resolve(r, "cancel")}>Cancel and refund</Button>
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
