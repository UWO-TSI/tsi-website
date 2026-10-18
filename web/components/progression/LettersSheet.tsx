"use client";

import { useCallback, useEffect, useState } from "react";
import { listLetters, markRead, reportLetter, sendLetter } from "@/lib/progression/client";
import { ApiError } from "@/lib/apiClient";
import { NOTE_MAX_LEN, SUBJECT_MAX_LEN } from "@/lib/progression/letters";
import { refreshProgression } from "@/lib/progression/useProgression";
import type { LetterView } from "@/lib/progression/types";
import ProgressionPanel, { type ProgressionSheetProps } from "./ProgressionPanel";
import { Button, Empty, ErrorNote, Loading, SignInLink } from "@/components/gui";
import { BackLink, QuietButton } from "@/components/gui/cream";
import { Landmark, Mail, MailOpen, PenLine, Reply } from "lucide-react";
import m from "./menus.module.css";

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

export const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
/** Who a letter is from (or to, for one you sent). */
export const fromLine = (l: LetterView) => (l.outgoing ? `To ${l.recipient_name}` : l.kind === "system" ? "HQ" : l.sender_name);

type View = { mode: "list" } | { mode: "read"; letter: LetterView } | { mode: "compose"; to?: MemberOption };

/** The mailbox's letters: loaded once, reloaded on demand; `read` marks one read as it opens. */
export function useLetters(transport: LettersTransport) {
  const [letters, setLetters] = useState<LetterView[] | null>(null);
  const [error, setError] = useState<"signed-out" | "failed" | null>(null);
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
  const read = async (letter: LetterView) => {
    if (letter.outgoing || letter.read_at) return;
    try {
      await transport.markRead(letter.id);
      setLetters((all) => all?.map((l) => (l.id === letter.id ? { ...l, read_at: new Date().toISOString() } : l)) ?? null);
      void refreshProgression();
    } catch {
      /* Unread state is cosmetic. */
    }
  };
  return { letters, error, reload: () => { setLetters(null); void load(); }, load, read };
}

/**
 * The mailbox (David, round 2: "mailbox more subtle"): quiet rows on the sheet, each an envelope, who it's from, the
 * subject and a line of it; unread ones in bold with a small dot. Writing a note is a quiet button at the top; a letter
 * opens on paper.
 */
export function LettersBody({ transport = lettersTransport, systemOnly = false }: { transport?: LettersTransport; systemOnly?: boolean }) {
  const { letters, error, reload, load, read } = useLetters(transport);
  const [view, setView] = useState<View>({ mode: "list" });

  const open = (letter: LetterView) => { setView({ mode: "read", letter }); void read(letter); };
  if (view.mode === "read") return <LetterReader letter={view.letter} transport={transport} onBack={() => setView({ mode: "list" })} onReply={(to) => setView({ mode: "compose", to })} />;
  if (view.mode === "compose") return <LetterComposer transport={transport} to={view.to} onDone={() => { setView({ mode: "list" }); void load(); }} />;

  const shown = (letters ?? []).filter((l) => !systemOnly || l.kind === "system");
  const unread = shown.filter((l) => !l.outgoing && !l.read_at).length;
  return (
    <div className={m.menu}>
      {!systemOnly ? (
        <div className={m.mailHead}>
          <span className={m.mailCount} role="status">{letters === null || error ? null : unread ? <><b>{unread}</b> unread</> : shown.length ? "All read" : null}</span>
          <Button variant="quiet" size="sm" onClick={() => setView({ mode: "compose" })}><PenLine size={15} aria-hidden="true" /> Write a note</Button>
        </div>
      ) : null}
      {letters === null ? <Loading label="Checking the mailbox…" /> : null}
      {error === "failed" ? <ErrorNote onRetry={reload}>Your mail didn’t load. The connection may have dropped.</ErrorNote> : null}
      {error === "signed-out" ? <Empty icon={<Mail size={32} />} title="Sign in to read your mail" action={<SignInLink button />}>Letters from members and HQ wait here.</Empty> : null}
      {letters !== null && !error && shown.length === 0 ? <Empty icon={<Mail size={32} />} title={systemOnly ? "No notices from HQ yet" : "No letters yet"}>{systemOnly ? "Club news and ceremony letters go up here." : "When someone writes, it arrives here. You can write first."}</Empty> : null}
      {shown.length ? <ul className={m.mail} aria-label="Letters">
        {shown.map((l) => {
          const fresh = !l.outgoing && !l.read_at;
          return <li key={l.id}>
            <button type="button" className={m.mailRow} data-unread={fresh} onClick={() => open(l)}>
              <span className={m.mailIcon} aria-hidden="true">{l.kind === "system" ? <Landmark size={17} /> : fresh ? <Mail size={17} /> : <MailOpen size={17} />}</span>
              <span className={m.mailFrom}>{fresh ? <span className={m.srOnly}>Unread: </span> : null}{fromLine(l)}{l.subject ? <span> · {l.subject}</span> : null}</span>
              <span className={m.mailDate}>{when(l.created_at)}</span>
              <span className={m.mailPreview}>{l.body}</span>
            </button>
          </li>;
        })}
      </ul> : null}
    </div>
  );
}

/** One letter, on paper, with what you can do about it. `backLabel`: where Back goes ("All mail", "The board"). */
export function LetterReader({ letter, transport, onBack, onReply, backLabel = "All mail" }: {
  letter: LetterView; transport: LettersTransport; onBack: () => void; onReply?: (to: MemberOption) => void; backLabel?: string;
}) {
  const [reported, setReported] = useState(letter.reported);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canReport = letter.kind === "note" && !letter.outgoing;
  const canReply = !!onReply && letter.kind === "note" && !letter.outgoing && !!letter.sender_id;
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
    <div className={m.menu}>
      <span><BackLink onClick={onBack}>{backLabel}</BackLink></span>
      <div className={m.readHead}>
        <p className={m.byline}>{letter.kind === "system" ? "From HQ" : letter.outgoing ? `You wrote to ${letter.recipient_name}` : `From ${letter.sender_name}`} · {when(letter.created_at)}</p>
        <h3 className={m.readTitle}>{letter.subject || "A note"}</h3>
      </div>
      <div className={m.letter} data-gui-paper="">{letter.body}</div>
      {error ? <p className={m.note} data-tone="err">{error}</p> : null}
      {reported ? <p className={m.note}>Reported. An admin will take a look.</p> : null}
      {canReply || (canReport && !reported) ? <div className={m.actions}>
        {canReply ? <Button onClick={() => onReply!({ id: letter.sender_id!, display_name: letter.sender_name })}><Reply size={16} aria-hidden="true" /> Reply</Button> : null}
        {canReport && !reported ? (
          confirming ? <span className={m.end}>
            <Button variant="danger" size="sm" onClick={report}>Report this note</Button>
            <QuietButton onClick={() => setConfirming(false)}>Cancel</QuietButton>
          </span> : <QuietButton className={m.end} onClick={() => setConfirming(true)}>Report</QuietButton>
        ) : null}
      </div> : null}
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
    <div className={m.menu}>
      <span><BackLink onClick={onDone}>All mail</BackLink></span>
      <div className={m.readHead}><h3 className={m.readTitle}>New note</h3></div>
      <div className={m.field}>
        <label className={m.label} htmlFor="letter-to">To</label>
        {to ? (
          <div className={m.to}>
            <span className={m.who}>{to.display_name}</span>
            {!initialTo ? <QuietButton onClick={() => setTo(null)}>Change</QuietButton> : null}
          </div>
        ) : (
          <>
            <input id="letter-to" className={m.input} placeholder="Search members by name" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            {matches.length > 0 ? (
              <div className={m.matches}>
                {matches.map((x) => <button key={x.id} type="button" className={m.match} onClick={() => setTo(x)}>{x.display_name}</button>)}
              </div>
            ) : null}
          </>
        )}
      </div>
      <div className={m.field}>
        <label className={m.label} htmlFor="letter-subject">Subject (optional)</label>
        <input id="letter-subject" className={m.input} maxLength={SUBJECT_MAX_LEN} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className={m.field}>
        <label className={m.label} htmlFor="letter-body">Note</label>
        <textarea id="letter-body" className={m.input} maxLength={NOTE_MAX_LEN} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Say hi, thank someone, plan a fishing trip…" />
        <span className={m.count}>{body.length}/{NOTE_MAX_LEN}</span>
      </div>
      <p className={m.aside}>Notes are text only. No items or coins travel by mail.</p>
      {message ? <p role="status" className={m.note} data-tone={message.kind} style={{ marginTop: 14 }}>{message.text}</p> : null}
      <div className={m.actions}>
        <Button onClick={send} disabled={!to || !body.trim() || busy}>{busy ? "Sending…" : "Send note"}</Button>
        <QuietButton onClick={onDone}>Cancel</QuietButton>
      </div>
    </div>
  );
}

/** `keys`: the mail key, which closes the mailbox too. */
export default function LettersSheet({ open, onClose, transport, keys }: ProgressionSheetProps & { transport?: LettersTransport; keys?: string }) {
  return (
    <ProgressionPanel open={open} onClose={onClose} title="Mailbox" keys={keys} icon={<Mail size={20} />}>
      <LettersBody transport={transport} />
    </ProgressionPanel>
  );
}
