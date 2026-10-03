"use client";

import { useCallback, useEffect, useState } from "react";
import { listLetters, markRead, reportLetter, sendLetter } from "@/lib/progression/client";
import { ApiError } from "@/lib/apiClient";
import { NOTE_MAX_LEN, SUBJECT_MAX_LEN } from "@/lib/progression/letters";
import { refreshProgression } from "@/lib/progression/useProgression";
import type { LetterView } from "@/lib/progression/types";
import ProgressionPanel, { type ProgressionSheetProps } from "./ProgressionPanel";
import { Button, Empty, ErrorNote, Loading, SignInLink } from "@/components/gui";
import { Mail } from "lucide-react";
import s from "./progression.module.css";

export interface MemberOption {
  id: string;
  display_name: string;
}

export interface LettersTransport {
  list(): Promise<LetterView[]>;
  send(to: string, subject: string, body: string): Promise<unknown>;
  markRead(id: string): Promise<unknown>;
  report(id: string, reason: string): Promise<unknown>;
  searchMembers(query: string): Promise<MemberOption[]>;
}

export const lettersTransport: LettersTransport = {
  list: listLetters,
  send: sendLetter,
  markRead,
  report: reportLetter,
  async searchMembers(query) {
    const res = await fetch(`/api/directory?search=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const body = (await res.json().catch(() => null)) as { members?: MemberOption[] } | null;
    return (body?.members ?? []).slice(0, 8).map((m) => ({ id: m.id, display_name: m.display_name }));
  },
};

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

type View = { mode: "list" } | { mode: "read"; letter: LetterView } | { mode: "compose"; to?: MemberOption };

export function LettersBody({ transport = lettersTransport, systemOnly = false }: { transport?: LettersTransport; systemOnly?: boolean }) {
  const [letters, setLetters] = useState<LetterView[] | null>(null);
  const [error, setError] = useState<"signed-out" | "failed" | null>(null);
  const [view, setView] = useState<View>({ mode: "list" });

  const load = useCallback(async () => {
    try {
      const rows = await transport.list();
      setError(null);
      setLetters(rows);
    } catch (err) {
      setLetters([]);
      // A failed load is said as one (it used to read "The mailbox is empty for now").
      setError(err instanceof ApiError && err.status === 401 ? "signed-out" : "failed");
    }
  }, [transport]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    void load();
  }, [load]);

  const open = async (letter: LetterView) => {
    setView({ mode: "read", letter });
    if (!letter.outgoing && !letter.read_at) {
      try {
        await transport.markRead(letter.id);
        setLetters((all) => all?.map((l) => (l.id === letter.id ? { ...l, read_at: new Date().toISOString() } : l)) ?? null);
        void refreshProgression();
      } catch {
        /* Unread state is cosmetic. */
      }
    }
  };

  if (view.mode === "read") return <LetterReader letter={view.letter} transport={transport} onBack={() => setView({ mode: "list" })} onReply={(to) => setView({ mode: "compose", to })} />;
  if (view.mode === "compose") return <LetterComposer transport={transport} to={view.to} onDone={() => { setView({ mode: "list" }); void load(); }} />;

  const shown = (letters ?? []).filter((l) => !systemOnly || l.kind === "system");
  return (
    <div>
      {!systemOnly ? (
        <div className={s.actions} style={{ marginTop: 0, marginBottom: 12 }}>
          <button className={s.btn} onClick={() => setView({ mode: "compose" })}>Write a note</button>
        </div>
      ) : null}
      {letters === null ? <Loading label="Checking the mailbox…" /> : null}
      {error === "failed" ? <ErrorNote onRetry={() => { setLetters(null); void load(); }}>Your mail didn’t load. The connection may have dropped.</ErrorNote> : null}
      {error === "signed-out" ? <Empty icon={<Mail size={32} />} title="Sign in to read your mail" action={<SignInLink button />}>Letters from members and HQ wait here.</Empty> : null}
      {letters !== null && !error && shown.length === 0 ? <Empty icon={<Mail size={32} />} title={systemOnly ? "No notices from HQ yet" : "No letters yet"}>{systemOnly ? "Club news and ceremony letters go up here." : "When someone writes, it arrives here. You can write first."}</Empty> : null}
      <ul className={s.letters}>
        {shown.map((l) => (
          <li key={l.id}>
            <button className={s.letter} data-unread={!l.outgoing && !l.read_at} onClick={() => open(l)}>
              <span className={s.row}>
                <span className={s.from}>{l.outgoing ? `To ${l.recipient_name}` : l.sender_name}</span>
                <span className={s.muted} style={{ margin: 0 }}>{when(l.created_at)}</span>
              </span>
              {l.subject ? <span style={{ fontSize: 13 }}>{l.subject}</span> : null}
              <span className={s.preview}>{l.body}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LetterReader({ letter, transport, onBack, onReply }: { letter: LetterView; transport: LettersTransport; onBack: () => void; onReply: (to: MemberOption) => void }) {
  const [reported, setReported] = useState(letter.reported);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canReport = letter.kind === "note" && !letter.outgoing;
  const report = async () => {
    try {
      await transport.report(letter.id, "reported from mailbox");
      setReported(true);
      setConfirming(false);
    } catch {
      setError("Couldn't send the report. Try again.");
    }
  };
  return (
    <div>
      <div className={s.row} style={{ marginBottom: 10 }}>
        <div>
          <div className={s.eyebrow}>{letter.kind === "system" ? "From HQ" : letter.outgoing ? `You wrote to ${letter.recipient_name}` : `From ${letter.sender_name}`}</div>
          <h3 style={{ margin: 0, fontSize: 16 }}>{letter.subject || "A note"}</h3>
        </div>
        <span className={s.muted}>{when(letter.created_at)}</span>
      </div>
      <div className={s.paper}>{letter.body}</div>
      {error ? <p className={`${s.note} ${s.err}`}>{error}</p> : null}
      {reported ? <p className={`${s.note} ${s.info}`}>Reported. An admin will take a look.</p> : null}
      <div className={s.actions}>
        <button className={s.ghost} onClick={onBack}>Back</button>
        {letter.kind === "note" && !letter.outgoing && letter.sender_id ? (
          <button className={s.btn} onClick={() => onReply({ id: letter.sender_id!, display_name: letter.sender_name })}>Reply</button>
        ) : null}
        {canReport && !reported ? (
          confirming ? (
            <>
              <Button variant="danger" size="sm" onClick={report}>Report this note</Button>
              <button className={s.ghost} onClick={() => setConfirming(false)}>Cancel</button>
            </>
          ) : (
            <button className={s.ghost} onClick={() => setConfirming(true)}>Report</button>
          )
        ) : null}
      </div>
    </div>
  );
}

function LetterComposer({ transport, to: initialTo, onDone }: { transport: LettersTransport; to?: MemberOption; onDone: () => void }) {
  const [to, setTo] = useState<MemberOption | null>(initialTo ?? null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MemberOption[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (to || query.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const found = await transport.searchMembers(query.trim()).catch(() => []);
      if (!cancelled) setMatches(found);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, to, transport]);

  const send = async () => {
    if (!to || !body.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await transport.send(to.id, subject.trim(), body.trim());
      setMessage({ kind: "ok", text: `Sent to ${to.display_name}.` });
      setTimeout(onDone, 700);
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof ApiError ? err.message : "Couldn't send. Your note is still here." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className={s.field}>
        <label className={s.label} htmlFor="letter-to">To</label>
        {to ? (
          <div className={s.row} style={{ justifyContent: "flex-start" }}>
            <span className={s.choice} aria-pressed="true" style={{ display: "inline-flex", alignItems: "center" }}>{to.display_name}</span>
            {!initialTo ? <button className={s.ghost} onClick={() => setTo(null)}>Change</button> : null}
          </div>
        ) : (
          <>
            <input id="letter-to" className={s.input} placeholder="Search members by name" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            {matches.length > 0 ? (
              <div className={s.choices}>
                {matches.map((m) => <button key={m.id} className={s.choice} onClick={() => setTo(m)}>{m.display_name}</button>)}
              </div>
            ) : null}
          </>
        )}
      </div>
      <div className={s.field}>
        <label className={s.label} htmlFor="letter-subject">Subject (optional)</label>
        <input id="letter-subject" className={s.input} maxLength={SUBJECT_MAX_LEN} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className={s.field}>
        <label className={s.label} htmlFor="letter-body">Note</label>
        <textarea id="letter-body" className={s.input} maxLength={NOTE_MAX_LEN} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Say hi, thank someone, plan a fishing trip…" />
        <span className={s.count}>{body.length}/{NOTE_MAX_LEN}</span>
      </div>
      <p className={s.muted}>Notes are text only. No items or TC travel by mail.</p>
      {message ? <p role="status" className={`${s.note} ${message.kind === "ok" ? s.ok : s.err}`}>{message.text}</p> : null}
      <div className={s.actions}>
        <button className={s.ghost} onClick={onDone}>Cancel</button>
        <button className={s.btn} onClick={send} disabled={!to || !body.trim() || busy}>{busy ? "Sending…" : "Send note"}</button>
      </div>
    </div>
  );
}

/** `keys`: the mail key, which closes the mailbox too. */
export default function LettersSheet({ open, onClose, transport, keys }: ProgressionSheetProps & { transport?: LettersTransport; keys?: string }) {
  return (
    <ProgressionPanel open={open} onClose={onClose} title="Mailbox" keys={keys}>
      <LettersBody transport={transport} />
    </ProgressionPanel>
  );
}
