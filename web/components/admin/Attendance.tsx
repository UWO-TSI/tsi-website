"use client";

import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";

type Event = { id: string; title: string; start_time: string; end_time: string | null; location: string | null; attended: number };
type Detail = { event: Omit<Event, "attended">; url: string | null; attendees: { display_name: string; email: string }[] };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
const INPUT = "w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-[#F1FFFF] placeholder:text-white/30 focus:border-[#1D9BF0] outline-none";
const BTN = "rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50";

/**
 * Attendance: make an in-person event, put its QR on the door (or the projector), and watch the check-ins come in.
 * The QR opens play.tethos.ca's check-in page, which signs the member in and pays the event's XP and coins.
 */
export default function Attendance() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const res = await fetch("/api/admin/attendance", { cache: "no-store" }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (!live) return;
      if (!res?.ok || !body) setError(body?.error ?? "Couldn't load events.");
      else setEvents(body.events);
    })();
    return () => { live = false; };
  }, []);

  return (
    <>
      <div className="print:hidden">
        <h1 className="text-3xl font-semibold tracking-tight">Attendance</h1>
        <p className="mt-2 max-w-2xl text-[#9CA3AF]">
          Make an event, then show or print its QR code at the door. Members scan it with their phone, sign in, and get the
          event&apos;s XP and coins on play.tethos.ca. Scanning twice counts once.
        </p>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6 print:hidden">
          <SheetCard />
          <NewEventForm onMade={(e) => { setEvents((list) => [e, ...(list ?? [])]); setPicked(e.id); }} />
          <section>
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#9CA3AF]">Events</p>
            {error && <p className="mt-3 text-sm text-amber-300">{error}</p>}
            {!events && !error && <p className="mt-3 text-sm text-[#9CA3AF]">Loading…</p>}
            {events?.length === 0 && <p className="mt-3 text-sm text-[#9CA3AF]">No in-person events yet. Make the first one above.</p>}
            <ul className="mt-3 space-y-2">
              {events?.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setPicked(e.id)}
                    className={`w-full text-left rounded-lg border px-4 py-3 transition ${picked === e.id ? "border-[#1D9BF0] bg-[#1D9BF0]/10" : "border-white/10 hover:border-white/25"}`}>
                    <span className="block font-medium">{e.title}</span>
                    <span className="block text-xs text-[#9CA3AF] mt-1">{when(e.start_time)}{e.location ? ` · ${e.location}` : ""} · {e.attended} checked in</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
        {picked
          ? <EventPanel key={picked} id={picked} onCount={(n) => setEvents((list) => list?.map((e) => (e.id === picked ? { ...e, attended: n } : e)) ?? null)} />
          : <p className="text-sm text-[#9CA3AF] print:hidden">Pick an event to show its QR code.</p>}
      </div>
    </>
  );
}

/** The Google Sheet check-ins are copied to: paste a link to connect it, sync it, or swap it for another. */
function SheetCard() {
  const [state, setState] = useState<{ url: string | null; account: string | null } | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/attendance/sheet", { cache: "no-store" }).then((r) => r.json()).then((b) => { if (live && !b.error) setState(b); }, () => {});
    return () => { live = false; };
  }, []);

  const send = async (link?: string) => {
    setBusy(true); setNote(null);
    const res = await fetch("/api/admin/attendance/sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(link === undefined ? {} : { link }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !body?.url) { setNote({ ok: false, text: body?.error ?? "That didn't go through. Try again." }); return; }
    setState((s) => ({ account: s?.account ?? null, url: body.url }));
    setEditing(false);
    setNote({ ok: true, text: `The sheet has every check-in so far (${body.rows}). New ones are added as people scan.` });
  };

  const connected = !!state?.url && !editing;
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
      <p className="font-semibold">Google Sheet</p>
      {connected ? (
        <>
          <p className="text-sm text-[#9CA3AF]">Check-ins are copied to <a href={state!.url!} target="_blank" rel="noopener noreferrer" className="text-[#1D9BF0] underline underline-offset-4">the attendance sheet</a>, in its Attendance tab.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => send()} className={`${BTN} bg-white/5 border border-white/10 hover:bg-white/10`}>{busy ? "Syncing…" : "Sync now"}</button>
            <button type="button" onClick={() => { setEditing(true); setNote(null); }} className="text-sm text-[#9CA3AF] hover:text-[#F1FFFF] underline underline-offset-4">Use a different sheet</button>
          </div>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void send(String(new FormData(e.currentTarget).get("link") ?? "")); }} className="space-y-3">
          <p className="text-sm text-[#9CA3AF]">
            Paste a Google Sheet link and every check-in is copied into it. The site&apos;s Google account
            {state?.account ? <> (<span className="text-[#F1FFFF]">{state.account}</span>)</> : null} has to be able to edit the sheet:
            make it in that account&apos;s Drive, or share it with that account as an editor.
          </p>
          <input name="link" required placeholder="https://docs.google.com/spreadsheets/d/…" className={INPUT} aria-label="Google Sheet link" />
          <div className="flex flex-wrap gap-3 items-center">
            <button type="submit" disabled={busy} className={`${BTN} bg-[#1D9BF0] hover:bg-[#1a8cd8] text-white`}>{busy ? "Connecting…" : "Connect sheet"}</button>
            {state?.url && <button type="button" onClick={() => setEditing(false)} className="text-sm text-[#9CA3AF] hover:text-[#F1FFFF] underline underline-offset-4">Cancel</button>}
          </div>
        </form>
      )}
      {note && <p className={`text-sm ${note.ok ? "text-emerald-300" : "text-amber-300"}`}>{note.text}</p>}
    </section>
  );
}

function NewEventForm({ onMade }: { onMade: (e: Event) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget, data = new FormData(form);
    const start = new Date(String(data.get("start")));
    if (Number.isNaN(start.getTime())) { setError("Pick a start time."); return; }
    setBusy(true); setError("");
    const res = await fetch("/api/admin/attendance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: data.get("title"), start_time: start.toISOString(), location: data.get("location") || null }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !body?.event) { setError(body?.error ?? "Couldn't create the event."); return; }
    form.reset();
    onMade(body.event);
  };
  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
      <p className="font-semibold">New event</p>
      <input name="title" required maxLength={200} placeholder="General meeting" className={INPUT} aria-label="Event title" />
      <input name="start" type="datetime-local" required className={INPUT} aria-label="Starts" />
      <input name="location" maxLength={200} placeholder="Location (optional)" className={INPUT} aria-label="Location" />
      {error && <p className="text-sm text-amber-300">{error}</p>}
      <button type="submit" disabled={busy} className={`${BTN} bg-[#1D9BF0] hover:bg-[#1a8cd8] text-white`}>{busy ? "Creating…" : "Create event"}</button>
    </form>
  );
}

/** One event: its QR, the link, the printable poster and the check-ins, refreshed every few seconds. */
function EventPanel({ id, onCount }: { id: string; onCount: (n: number) => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      const res = await fetch(`/api/admin/attendance/${id}`, { cache: "no-store" }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (!live) return;
      if (!res?.ok || !body) { setError(body?.error ?? "Couldn't load the event."); return; }
      setError(""); setDetail(body); onCount(body.attendees.length);
    };
    void tick();
    const timer = setInterval(tick, 5000);
    return () => { live = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const url = detail?.url;
  useEffect(() => {
    if (!url) return;
    let live = true;
    QRCode.toDataURL(url, { width: 720, margin: 1 }).then((d) => { if (live) setQr(d); }, () => {});
    return () => { live = false; };
  }, [url]);

  if (!detail) return <p className="text-sm text-[#9CA3AF] print:hidden">{error || "Loading…"}</p>;
  const { event, attendees } = detail;
  return (
    <section>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 print:hidden">
        <p className="text-xl font-semibold">{event.title}</p>
        <p className="mt-1 text-sm text-[#9CA3AF]">{when(event.start_time)}{event.location ? ` · ${event.location}` : ""}</p>
        {qr
          ? <img src={qr} alt={`Check-in QR code for ${event.title}`} className="mt-5 w-full max-w-[320px] rounded-lg bg-white p-3" />
          : <p className="mt-5 text-sm text-amber-300">{url === null ? "This event has no check-in code." : "Drawing the QR code…"}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => window.print()} disabled={!qr} className={`${BTN} bg-[#1D9BF0] hover:bg-[#1a8cd8] text-white`}>Print poster</button>
          <button type="button" disabled={!url}
            onClick={() => { if (url) navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); }}
            className={`${BTN} bg-white/5 border border-white/10 hover:bg-white/10`}>{copied ? "Copied" : "Copy link"}</button>
        </div>
        {error && <p className="mt-3 text-sm text-amber-300">{error}</p>}
        <p className="mt-8 font-mono text-[11px] tracking-[0.2em] uppercase text-[#9CA3AF]">{attendees.length} checked in</p>
        {attendees.length === 0
          ? <p className="mt-3 text-sm text-[#9CA3AF]">Nobody yet. This list updates on its own.</p>
          : <ul className="mt-3 divide-y divide-white/10 text-sm">
              {attendees.map((a) => <li key={a.email} className="py-2 flex justify-between gap-4"><span>{a.display_name}</span><span className="text-[#9CA3AF] truncate">{a.email}</span></li>)}
            </ul>}
      </div>
      {/* The poster: only on paper. */}
      {qr && (
        <div className="hidden print:flex flex-col items-center text-center text-black bg-white pt-10">
          <p className="text-sm tracking-[0.3em] uppercase">Tethos</p>
          <p className="mt-4 text-5xl font-bold">{event.title}</p>
          <p className="mt-3 text-xl">{when(event.start_time)}{event.location ? ` · ${event.location}` : ""}</p>
          <img src={qr} alt="" className="mt-10 w-[11cm] h-[11cm]" />
          <p className="mt-8 text-3xl font-semibold">Scan to check in</p>
          <p className="mt-3 text-lg max-w-[16cm]">Sign in with your Tethos account. The event&apos;s XP and coins go straight to your play.tethos.ca account.</p>
        </div>
      )}
    </section>
  );
}
