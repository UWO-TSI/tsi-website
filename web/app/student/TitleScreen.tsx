"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft } from "lucide-react";
import { DarkButton, FlatField, FlatSlider, FlatToggle, GhostButton, RoundButton } from "@/components/gui/flat";
import TsiLogo from "@/components/ui/TsiLogo";
import { createClient } from "@/lib/supabase/client";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { useAudioState } from "@/lib/game/useAudio";
import { AudioManager } from "@/lib/game/audio";
import TitleMenu, { TITLE_MENU, type TitleAction } from "./TitleMenu";
import s from "./TitleScreen.module.css";

const TitleScene = dynamic(() => import("@/components/title/TitleScene"), { ssr: false });

export type TitleView = "menu" | "signin" | "signup" | "forgot" | "check" | "settings";

/**
 * The game's title screen (David, 2026-10-03; the banner look chosen 2026-11-01, specs/lanes/title-r2.md): the live
 * island close up with depth of field, a white banner hanging from the top-left with the logo and Let's Play,
 * Settings and Exit (a gold marker under the chosen one, between two gold diamonds), and a small input hint bottom-right.
 * Arrow keys (or W/S) move, Enter picks, Escape steps back.
 * Let's Play continues a signed-in member and asks anyone else to sign in (creating an account and Google from
 * there); Settings holds the graphics and sound (and signing out); Exit goes back to tethos.ca. After any sign-in,
 * `landing` (/student/go, carrying a safe ?next=) decides where the member goes.
 */
export default function TitleScreen({ landing, account, open, initialView, when, siteHome }: {
  landing: string; account: { name: string } | null; open: boolean; initialView: TitleView; when: string; siteHome: string;
}) {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<TitleView>(initialView);
  /** The menu's selection, kept while a sub-view is open so Back lands where you left. */
  const [chosen, setChosen] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", invite: "" });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }));

  const go = (next: TitleView) => { setView(next); setError(null); setNotice(null); };
  const leave = (href: string) => { window.location.href = href; };

  const pick = (id: TitleAction) => {
    if (id === "play") { if (account) leave(landing); else go("signin"); }
    else if (id === "settings") go("settings");
    else leave(siteHome);
  };
  const signOut = async () => { await createClient().auth.signOut(); window.location.reload(); };

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
          <h1 className={s.wordmark}>Tethos<span>Island</span></h1>
        </header>

        <div className={s.card} data-view={view}>
          {view === "menu" && <TitleMenu items={TITLE_MENU} selected={chosen} onSelected={setChosen} onPick={pick} caption={account ? `Signed in as ${account.name}` : null} />}

          {view === "settings" && <Settings onBack={() => go("menu")} onSignOut={account ? signOut : null} />}

          {view === "signin" && <Form title="Sign in" onBack={() => go("menu")} onSubmit={signIn}>
            <GoogleButton onClick={google} disabled={busy} />
            <p className={s.or}>or</p>
            <FlatField label="Email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" autoFocus />
            <FlatField label="Password" type="password" value={form.password} onChange={set("password")} required minLength={6} autoComplete="current-password" />
            <Messages error={error} notice={notice} />
            <DarkButton type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</DarkButton>
            <div className={s.links}>
              <button type="button" onClick={() => go("forgot")}>Forgot password?</button>
              <button type="button" onClick={() => go("signup")}>Create account</button>
            </div>
          </Form>}

          {view === "signup" && <Form title="New account" onBack={() => go("menu")} onSubmit={signUp}>
            <GoogleButton onClick={google} disabled={busy} />
            <p className={s.or}>or</p>
            <FlatField label="Name" value={form.name} onChange={set("name")} required autoComplete="name" autoFocus />
            <FlatField label="Email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" />
            <FlatField label="Password" type="password" value={form.password} onChange={set("password")} required minLength={6} autoComplete="new-password" placeholder="Password, 6+ characters" />
            <FlatField label="Invite code" value={form.invite} onChange={set("invite")} autoComplete="off" placeholder="Invite code (optional)" />
            <Messages error={error} notice={notice} />
            <DarkButton type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</DarkButton>
            <div className={s.links}><button type="button" onClick={() => go("signin")}>I have an account</button></div>
          </Form>}

          {view === "forgot" && <Form title="Reset password" onBack={() => go("signin")} onSubmit={forgot}>
            <p className={s.lead}>We&apos;ll email you a link.</p>
            <FlatField label="Email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" autoFocus />
            <Messages error={error} notice={notice} />
            <DarkButton type="submit" disabled={busy}>{busy ? "Sending…" : "Send link"}</DarkButton>
          </Form>}

          {view === "check" && <Form title="Check your email" onBack={() => go("menu")}>
            <p className={s.lead}>Open the link we sent to {form.email}.</p>
          </Form>}
        </div>
      </section>

      <footer className={s.footer}>
        <span className={s.when}>
          {when}{!open && <em className={s.soon}>The island opens soon</em>}
        </span>
        <span className={s.hint} aria-hidden>
          {view === "menu" && <span><kbd>↑↓</kbd>Move</span>}
          <span>{view === "menu" ? <><kbd>↵</kbd>Select</> : <><kbd>Esc</kbd>Back</>}</span>
        </span>
      </footer>
    </main>
  );
}

/**
 * Settings on the title: the game's own graphics settings and sound, kept on this device (the world reads the same).
 * Flat like the sign-in (David, title round 3): Quality as three pills on a grey well, the kit's flat switches and slider.
 */
function Settings({ onBack, onSignOut }: { onBack: () => void; onSignOut: (() => void) | null }) {
  const [graphics, actions] = useGraphicsSettings();
  const audio = useAudioState();
  // isExplicit isn't part of the store snapshot: re-render on a change so Auto shows as chosen.
  const [, rerender] = useState(0);
  const quality = actions.isExplicit("liteMode") ? (graphics.liteMode ? "lite" : "high") : "auto";
  const setQuality = (q: "auto" | "lite" | "high") => {
    rerender(n => n + 1);
    if (q === "auto") actions.unset("liteMode");
    else { actions.setLiteMode(q === "lite"); if (q === "high") actions.setShadows(true); }
  };
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onBack(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);
  return (
    <div className={s.form} role="group" aria-labelledby="title-settings">
      <div className={s.formHead}>
        <RoundButton label="Back" onClick={onBack} autoFocus><ChevronLeft size={18} /></RoundButton>
        <h2 id="title-settings">Settings</h2>
      </div>
      <div className={s.setting}>
        <span id="title-quality">Quality</span>
        <div className={s.segmented} role="group" aria-labelledby="title-quality">
          {(["auto", "lite", "high"] as const).map(q => <button key={q} type="button" aria-pressed={quality === q} onClick={() => setQuality(q)}>{q === "auto" ? "Auto" : q === "lite" ? "Lite" : "High"}</button>)}
        </div>
        <small>Lite is for older laptops: lighter grass and no shadows.</small>
      </div>
      <FlatToggle checked={graphics.pixelated} onChange={actions.setPixelated} hint="The island's crisp pixel look">Pixel finish</FlatToggle>
      <FlatToggle checked={graphics.shadows && !graphics.liteMode} disabled={graphics.liteMode} onChange={actions.setShadows}>Sun shadows</FlatToggle>
      <FlatSlider label="Volume" value={Math.round(audio.volumes.master * 100)} onChange={v => AudioManager.setVolumes({ master: v / 100 })} format={v => `${v}%`} />
      {onSignOut && <GhostButton className={s.line} onClick={onSignOut}>Sign out</GhostButton>}
    </div>
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
        <RoundButton label="Back" onClick={onBack}><ChevronLeft size={18} /></RoundButton>
        <h2>{title}</h2>
      </div>
      {children}
    </form>
  );
}

/** Google, the one-tap way in: a white pill with the G (both sign-in and sign-up, as before). */
function GoogleButton(props: { onClick: () => void; disabled?: boolean }) {
  return (
    <GhostButton className={`${s.line} ${s.google}`} {...props}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Continue with Google
    </GhostButton>
  );
}

function Messages({ error, notice }: { error: string | null; notice: string | null }) {
  if (error) return <p className={s.error} role="alert">{error}</p>;
  if (notice) return <p className={s.notice} role="status">{notice}</p>;
  return null;
}
