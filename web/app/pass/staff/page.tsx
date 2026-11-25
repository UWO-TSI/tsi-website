import Link from "next/link";
import { redirect } from "next/navigation";
import { importRegistrations, parseLumaCsv } from "@/lib/genesis/luma";
import { BOOTHS } from "@/lib/genesis/booths";
import { passContext } from "@/lib/genesis/server";
import { isGenesisStaff } from "@/lib/genesis/staff";

export const dynamic = "force-dynamic";
export const metadata = { title: "GENESIS numbers" };

const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

async function loadGuests(formData: FormData) {
  "use server";
  const { db, user, href } = await passContext();
  if (!(await isGenesisStaff(db, user))) redirect(href("/staff"));
  const file = formData.get("csv");
  const guests = file instanceof Blob && file.size < 5 * 1024 * 1024 ? parseLumaCsv(await file.text()) : [];
  const n = guests.length ? await importRegistrations(db, guests) : 0;
  redirect(href(`/staff?loaded=${n}`));
}

/** Staff only: the live numbers. Moves into the club admin once that merges (specs/genesis-pass.md). */
export default async function Staff({ searchParams }: { searchParams: Promise<{ loaded?: string }> }) {
  const { loaded } = await searchParams;
  const { db, user, href } = await passContext();
  if (!(await isGenesisStaff(db, user))) {
    return <><h1>Staff only</h1><p>{user ? "Exec and directors (T1 to T3) only." : <Link href={href("/me")}>Sign in</Link>}</p></>;
  }
  const head = { count: "exact" as const, head: true };
  const [registered, ...rest] = await Promise.all([
    count(db.from("genesis_registrations").select("email", head)),
    count(db.from("genesis_passes").select("id", head)),
    count(db.from("genesis_passes").select("id", head).not("user_id", "is", null)),
    count(db.from("genesis_arrivals").select("pass_id", head)),
    count(db.from("genesis_photos").select("id", head)),
    count(db.from("genesis_photo_saves").select("photo_id", head)),
    ...BOOTHS.map((b) => count(db.from("genesis_stamps").select("pass_id", head).eq("booth", b.slug))),
  ]);
  const [passes, saved, arrivals, photos, photoSaves, ...perBooth] = rest;
  const { data: linked } = await db.from("genesis_registrations").select("pass_id").not("pass_id", "is", null);
  const linkedIds = (linked ?? []).map((r) => (r as { pass_id: string }).pass_id);
  const registeredIn = linkedIds.length ? await count(db.from("genesis_arrivals").select("pass_id", head).in("pass_id", linkedIds)) : 0;
  return (
    <>
      <p className="gp-kicker">GENESIS 2027 · staff</p>
      <h1>Live numbers</h1>
      <div className="gp-stats">
        <div><b>{arrivals}</b>checked in</div>
        <div><b>{passes}</b>passes</div>
        <div><b>{saved}</b>saved to an account</div>
        <div><b>{photos}</b>photos taken, {photoSaves} opened</div>
        <div><b>{registered}</b>on the Luma list</div>
        <div><b>{registeredIn}</b>registered and checked in (matched when they save with their Luma email)</div>
      </div>
      <h2>Luma guest list</h2>
      {loaded && <div className="gp-banner">Loaded {loaded} guests.</div>}
      <form action={loadGuests} className="gp-card">
        <p>Export the guest list from Luma (Guests, then Export) and load the CSV here. Loading again updates it.</p>
        <input type="file" name="csv" accept=".csv,text/csv" required style={{ margin: "8px 0 16px" }} />
        <button className="gp-btn" type="submit">Load guest list</button>
      </form>
      <h2>Stamps per booth</h2>
      <ul className="gp-list">
        {BOOTHS.map((b, i) => <li key={b.slug}><a aria-disabled>{b.nonprofit}<span>{perBooth[i]}</span></a></li>)}
      </ul>
      <p style={{ marginTop: 20 }}><Link href={href("/booth")}>Open the photobooth</Link></p>
    </>
  );
}
