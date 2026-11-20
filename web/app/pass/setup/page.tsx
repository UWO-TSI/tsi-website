import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { cleanName, createPass, PASS_COOKIE, PASS_COOKIE_OPTIONS, setName } from "@/lib/genesis/pass";
import { passContext } from "@/lib/genesis/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your pass" };

async function save(formData: FormData) {
  "use server";
  const { db, pass, href } = await passContext();
  const name = cleanName(formData.get("name"));
  if (pass) await setName(db, pass.id, name);
  else {
    const made = await createPass(db, name);
    if (made) (await cookies()).set(PASS_COOKIE, made.secret, PASS_COOKIE_OPTIONS);
  }
  redirect(href("/?welcome=1"));
}

/** Setup at the front desk: the name on the pass. Saving with an email or Google comes next (specs/genesis-pass.md). */
export default async function Setup() {
  const { pass, href } = await passContext();
  return (
    <>
      <p className="gp-kicker">Welcome to GENESIS 2027</p>
      <h1>Your pass</h1>
      <p>Collect each project with its booth&apos;s sticker and keep your photobooth photos. You can come back to it after GENESIS.</p>
      <form action={save} className="gp-card">
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" className="gp-input" maxLength={40} defaultValue={pass?.name ?? ""} autoComplete="name" placeholder="On your pass card" />
        <button className="gp-btn" type="submit">Start collecting</button>
      </form>
      <p style={{ marginTop: 16 }}><a href={href("/")}>Skip for now</a></p>
    </>
  );
}
