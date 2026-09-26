"use client";

/** Admin merch fulfilment (T1/T2): hand over at HQ, or cancel with a Gems refund. */
import { useCallback, useEffect, useState } from "react";
import { GEMS } from "@/lib/economy";
import type { Reservation } from "@/lib/wallet/store";
import { EconomyRequestError, httpEconomyTransport, type EconomyTransport } from "@/lib/wallet/transport";

export default function MerchFulfilment({ transport = httpEconomyTransport }: { transport?: EconomyTransport }) {
  const [status, setStatus] = useState<"reserved" | "fulfilled" | "cancelled">("reserved");
  const [rows, setRows] = useState<Reservation[] | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try {
      setRows(await transport.adminReservations(status));
    } catch (err) {
      setRows([]);
      setMessage({ kind: "err", text: err instanceof EconomyRequestError ? err.message : "Couldn't load reservations." });
    }
  }, [transport, status]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    void load();
  }, [load]);
  const resolve = async (r: Reservation, action: "fulfil" | "cancel") => {
    if (action === "cancel" && typeof window !== "undefined" && !window.confirm(`Cancel ${r.member_name}'s ${r.item_name}? Their ${r.gems} ${GEMS.symbol} go back.`)) return;
    try {
      await transport.resolve(r.id, action, notes[r.id]);
      setMessage({ kind: "ok", text: action === "fulfil" ? `Handed over: ${r.item_name} to ${r.member_name}.` : `Cancelled and refunded ${r.gems} ${GEMS.symbol}.` });
      await load();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof EconomyRequestError ? err.message : "Couldn't update that reservation." });
    }
  };
  return (
    <div>
      <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">Merch pickups</h1>
      <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1 mb-4">Check the pickup code, hand it over, mark it fulfilled. Cancelling refunds the Gems and returns the stock.</p>
      <div className="flex gap-2 mb-4">
        {(["reserved", "fulfilled", "cancelled"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-md font-mono text-xs uppercase tracking-wider border ${status === s ? "bg-[var(--color-accent-cyan)] text-[var(--color-bg)] border-transparent" : "border-[var(--glass-border)] text-[var(--color-text-primary)]"}`}>{s}</button>
        ))}
      </div>
      {message ? <div className={`mb-4 p-3 rounded-md text-xs font-mono border ${message.kind === "ok" ? "bg-green-400/10 border-green-400/30 text-green-400" : "bg-red-400/10 border-red-400/30 text-red-400"}`}>{message.text}</div> : null}
      {rows === null ? <p className="font-mono text-sm text-[var(--color-text-muted)]">Loading…</p> : rows.length === 0 ? <p className="font-mono text-sm text-[var(--color-text-muted)]">Nothing here.</p> : null}
      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--glass-border)]">
              {["Code", "Member", "Item", "Gems", "Reserved", status === "reserved" ? "Note" : "Note / closed", ""].map((h) => <th key={h} className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-b border-[var(--glass-border)]/40 last:border-b-0">
                <td className="px-4 py-3 font-mono text-[var(--color-accent-cyan)] tracking-widest">{r.pickup_code}</td>
                <td className="px-4 py-3 text-[var(--color-text-primary)]">{r.member_name}</td>
                <td className="px-4 py-3 text-[var(--color-text-primary)]">{r.item_name}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.gems} {GEMS.symbol}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  {r.status === "reserved" ? (
                    <input className="w-full px-2 py-1 bg-[var(--color-bg)] border border-[var(--glass-border)] rounded text-xs font-mono text-[var(--color-text-primary)]" placeholder="optional note" maxLength={200} value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                  ) : (
                    <span className="font-mono text-xs text-[var(--color-text-muted)]">{r.note ?? "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {r.status === "reserved" ? (
                    <>
                      <button onClick={() => resolve(r, "fulfil")} className="mr-2 px-3 py-1.5 bg-green-500 text-white font-mono text-xs uppercase rounded-md">Fulfil</button>
                      <button onClick={() => resolve(r, "cancel")} className="px-3 py-1.5 border border-red-500/40 text-red-400 font-mono text-xs uppercase rounded-md">Cancel</button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
