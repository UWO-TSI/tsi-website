import Link from "next/link";
import { redirect } from "next/navigation";
import { cleanName, setName } from "@/lib/genesis/pass";
import { passContext, saveAfterSignIn } from "@/lib/genesis/server";
import { createClient } from "@/lib/supabase/server";
import GoogleButton from "./GoogleButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your pass" };

const cleanEmail = (raw: unknown) => {
  const e = String(raw ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null;
};

async function sendCode(formData: FormData) {
  "use server";
  const { href } = await passContext();
  const email = cleanEmail(formData.get("email"));
  if (!email) redirect(href("/me?error=email"));
  const { error } = await (await createClient()).auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  redirect(href(error ? "/me?error=send" : `/me?sent=${encodeURIComponent(email)}`));
}

async function checkCode(formData: FormData) {
  "use server";
  const { db, href } = await passContext();
  const email = cleanEmail(formData.get("email"));
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!email || !token) redirect(href("/me?error=code"));
  const { data, error } = await (await createClient()).auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) redirect(href(`/me?sent=${encodeURIComponent(email)}&error=code`));
  await saveAfterSignIn(db, data.user);
  redirect(href("/me?saved=1"));
}

async function rename(formData: FormData) {
  "use server";
  const { db, pass, href } = await passContext();
  if (pass) await setName(db, pass.id, cleanName(formData.get("name")));
  redirect(href("/me"));
}

async function signOut() {
  "use server";
  const { href } = await passContext();
  await (await createClient()).auth.signOut();
  redirect(href("/"));
}

const ERRORS: Record<string, string> = {
  email: "That email doesn't look right.",
  send: "The code couldn't be sent. Try again in a minute.",
  code: "That code didn't work. Check the email and try again.",
  "1": "Signing in didn't finish. Try again.",
};

/** The guest's own page: the name on the pass, and saving the pass with an email code or Google. */
export default async function Me({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; saved?: string }> }) {
  const { pass, user, href } = await passContext();
  const { sent, error, saved } = await searchParams;
  const saving = !!(pass?.user_id && user && pass.user_id === user.id);
  return (
    <>
      <p className="gp-kicker"><Link href={href("/")}>← Your pass</Link></p>
      <h1>{pass?.name ?? "Your pass"}</h1>
      {saved && saving && <div className="gp-banner">Saved. Sign in with {user!.email} on any device to open your pass.</div>}
      {error && <div className="gp-banner">{ERRORS[error] ?? ERRORS["1"]}</div>}

      {pass && (
        <form action={rename} className="gp-card">
          <label htmlFor="name">Name on your pass</label>
          <input id="name" name="name" className="gp-input" maxLength={40} defaultValue={pass.name ?? ""} autoComplete="name" />
          <button className="gp-btn gp-btn--quiet" type="submit">Save name</button>
        </form>
      )}

      <h2>Keep your pass</h2>
      {saving ? (
        <section className="gp-card">
          <p>Saved to {user!.email}. Sign in with it on any device, any time.</p>
          <form action={signOut}><button className="gp-btn gp-btn--quiet" type="submit">Sign out on this phone</button></form>
        </section>
      ) : sent ? (
        <form action={checkCode} className="gp-card">
          <p>We sent a code to {sent}. It can take a minute.</p>
          <input type="hidden" name="email" value={sent} />
          <label htmlFor="code">Code</label>
          <input id="code" name="code" className="gp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required />
          <button className="gp-btn" type="submit">Save my pass</button>
          <p style={{ marginTop: 12 }}><Link href={href("/me")}>Use a different email</Link></p>
        </form>
      ) : (
        <section className="gp-card">
          <p>Your pass lives on this phone. Save it with your email or Google to open it on any device after GENESIS.</p>
          <form action={sendCode}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="gp-input" autoComplete="email" required />
            <button className="gp-btn" type="submit" style={{ width: "100%" }}>Email me a code</button>
          </form>
          <p style={{ textAlign: "center", margin: "12px 0" }}>or</p>
          <GoogleButton back={href("/auth")} />
        </section>
      )}
    </>
  );
}
