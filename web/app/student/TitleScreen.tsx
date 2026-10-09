"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Button, Field, Keycap } from "@/components/gui";
import TsiLogo from "@/components/ui/TsiLogo";
import { createClient } from "@/lib/supabase/client";
import s from "./TitleScreen.module.css";

const TitleScene = dynamic(() => import("@/components/title/TitleScene"), { ssr: false });

export type TitleView = "menu" | "signin" | "signup" | "forgot" | "check";
type MenuItem = { label: string; onSelect: () => void };

/**
 * The student portal's title screen (David, 2026-10-03; references: Piece by Piece, HOA, Breath of the Wild):
 * the live island behind a white wordmark, and a cream menu card (the GUI sheet) for signing in, creating an
 * account or continuing. Arrow keys move the selection, Enter picks, Escape steps back. After any sign-in,
 * `landing` (/student/go, carrying a safe ?next=) decides where the member goes.
 */
export default function TitleScreen({ landing, account, open, initialView, when, siteHome }: {
  landing: string; account: { name: string } | null; open: boolean; initialView: TitleView; when: string; siteHome: string;
}) {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<TitleView>(initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", invite: "" });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }));

  const go = (next: TitleView) => { setView(next); setError(null); setNotice(null); };
  const leave = (href: string) => { window.location.href = href; };

  const menu: MenuItem[] = account
    ? [{ label: "Continue", onSelect: () => leave(landing) },
       { label: "Sign out", onSelect: async () => { await createClient().auth.signOut(); window.location.reload(); } },
       { label: "Back to tethos.ca", onSelect: () => leave(siteHome) }]
    : [{ label: "Sign in", onSelect: () => go("signin") },
       { label: "Create account", onSelect: () => go("signup") },
       { label: "Apply to TSI", onSelect: () => leave(`${siteHome.replace(/\/$/, "")}/student/apply`) },
       { label: "Back to tethos.ca", onSelect: () => leave(siteHome) }];

  const google = async () => {
    setBusy(true); setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(landing)}` },
    });
    if (error) { setError(error.message); setBusy(false); }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: form.email, password: form.password });
    if (error) { setError(error.message); setBusy(false); return; }
    leave(landing);
  };

  const forgot = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/student/reset-password`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setNotice(`We sent a reset link to ${form.email}.`);
  };

  // Member sign-up (ported from the retired /student/signup): an optional invite code makes the account a member.
  const signUp = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    const supabase = createClient();
    const invite = form.invite.trim();
    try {
      if (invite) {
        const { data: valid } = await supabase.rpc("invite_code_valid", { p_code: invite });
        if (!valid) { setError("That invite code isn't valid or has expired."); setBusy(false); return; }
      }
      const { data, error } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: {
          data: { display_name: form.name.trim(), invite_code: invite || null },
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(landing)}`,
        },
      });
      if (error) { setError(error.message); setBusy(false); return; }
      // Supabase answers a duplicate email with a user that has no identities, and no error.
      if (!data.user || data.user.identities?.length === 0) { setError("There's already an account with that email. Sign in instead."); setBusy(false); return; }
      if (invite) await supabase.rpc("increment_invite_uses", { code_value: invite.toUpperCase() }).then(() => {}, () => {});
      if (!data.session) { setBusy(false); go("check"); return; }
      leave(landing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <main className={`gui ${s.screen}`} data-ready={ready || undefined}>
      <div className={s.scene}><TitleScene onReady={() => setReady(true)} /></div>
      <div className={s.shade} aria-hidden />

      <section className={s.column}>
        <header className={s.brand}>
          <TsiLogo width={64} height={64} className={s.logo} />
          <h1 className={s.wordmark}>Tethos<span>Student Portal</span></h1>
        </header>

        <div className={s.card} data-view={view}>
          {view === "menu" && <Menu items={menu} caption={account ? `Signed in as ${account.name}` : null} />}

          {view === "signin" && <Form title="Sign in" onBack={() => go("menu")} onSubmit={signIn}>
            <GoogleButton onClick={google} disabled={busy}>Continue with Google</GoogleButton>
            <Or />
            <Field label="Email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" autoFocus />
            <Field label="Password" type="password" value={form.password} onChange={set("password")} required minLength={6} autoComplete="current-password" />
            <Messages error={error} notice={notice} />
            <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
            <div className={s.links}>
              <button type="button" onClick={() => go("forgot")}>Forgot password?</button>
              <button type="button" onClick={() => go("signup")}>Create an account</button>
            </div>
          </Form>}

          {view === "signup" && <Form title="Create account" onBack={() => go("menu")} onSubmit={signUp}>
            <GoogleButton onClick={google} disabled={busy}>Sign up with Google</GoogleButton>
            <Or />
            <Field label="Name" value={form.name} onChange={set("name")} required autoComplete="name" autoFocus />
            <Field label="Email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" />
            <Field label="Password" type="password" value={form.password} onChange={set("password")} required minLength={6} autoComplete="new-password" placeholder="At least 6 characters" />
            <Field label="Invite code" value={form.invite} onChange={set("invite")} autoComplete="off" placeholder="Optional, from your TSI chapter" />
            <Messages error={error} notice={notice} />
            <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
            <div className={s.links}><button type="button" onClick={() => go("signin")}>I already have an account</button></div>
          </Form>}

          {view === "forgot" && <Form title="Reset password" onBack={() => go("signin")} onSubmit={forgot}>
            <p className={s.lead}>We&apos;ll email you a link to set a new one.</p>
            <Field label="Email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" autoFocus />
            <Messages error={error} notice={notice} />
            <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
          </Form>}

          {view === "check" && <Form title="Check your email" onBack={() => go("menu")}>
            <p className={s.lead}>We sent a link to {form.email}. Open it to finish creating your account.</p>
          </Form>}
        </div>
      </section>

      <footer className={s.footer}>
        <span className={s.when}>{when}{!open && <em className={s.soon}>The island opens soon</em>}</span>
        <span className={s.keys}>
          {view === "menu" ? <><Keycap>↑↓</Keycap> Move <Keycap>Enter</Keycap> Select</> : <><Keycap>Esc</Keycap> Back</>}
        </span>
      </footer>
    </main>
  );
}

function Menu({ items, caption }: { items: MenuItem[]; caption: string | null }) {
  const [selected, setSelected] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus({ preventScroll: true }); }, []);
  const move = (by: number) => {
    const next = (selected + by + items.length) % items.length;
    setSelected(next);
    refs.current[next]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
  };
  return (
    <nav aria-label="Main menu" onKeyDown={onKey}>
      {caption && <p className={s.caption}>{caption}</p>}
      <ul className={s.menu}>
        {items.map((item, i) => (
          <li key={item.label}>
            <button ref={el => { refs.current[i] = el; }} type="button" data-selected={i === selected || undefined}
              onMouseEnter={() => setSelected(i)} onFocus={() => setSelected(i)} onClick={item.onSelect}>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Form({ title, onBack, onSubmit, children }: { title: string; onBack: () => void; onSubmit?: (e: React.FormEvent) => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onBack(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);
  return (
    <form className={s.form} onSubmit={onSubmit ?? (e => e.preventDefault())} noValidate={false}>
      <div className={s.formHead}>
        <button type="button" className={s.back} onClick={onBack} aria-label="Back">‹</button>
        <h2>{title}</h2>
      </div>
      {children}
    </form>
  );
}

function GoogleButton({ children, ...props }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="secondary" {...props}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {children}
    </Button>
  );
}

function Or() {
  return <div className={s.or}><span>or</span></div>;
}

function Messages({ error, notice }: { error: string | null; notice: string | null }) {
  if (error) return <p className={s.error} role="alert">{error}</p>;
  if (notice) return <p className={s.notice} role="status">{notice}</p>;
  return null;
}
