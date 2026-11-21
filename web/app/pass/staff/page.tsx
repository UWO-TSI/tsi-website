import Link from "next/link";
import { BOOTHS } from "@/lib/genesis/booths";
import { passContext } from "@/lib/genesis/server";
import { isGenesisStaff } from "@/lib/genesis/staff";

export const dynamic = "force-dynamic";
export const metadata = { title: "GENESIS numbers" };

const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

/** Staff only: the live numbers. Moves into the club admin once that merges (specs/genesis-pass.md). */
export default async function Staff() {
  const { db, user, href } = await passContext();
  if (!(await isGenesisStaff(db, user))) {
    return <><h1>Staff only</h1><p>{user ? "Exec and directors (T1 to T3) only." : <Link href={href("/me")}>Sign in</Link>}</p></>;
  }
  const head = { count: "exact" as const, head: true };
  const [passes, saved, arrivals, photos, photoSaves, ...perBooth] = await Promise.all([
    count(db.from("genesis_passes").select("id", head)),
    count(db.from("genesis_passes").select("id", head).not("user_id", "is", null)),
    count(db.from("genesis_arrivals").select("pass_id", head)),
    count(db.from("genesis_photos").select("id", head)),
    count(db.from("genesis_photo_saves").select("photo_id", head)),
    ...BOOTHS.map((b) => count(db.from("genesis_stamps").select("pass_id", head).eq("booth", b.slug))),
  ]);
  return (
    <>
      <p className="gp-kicker">GENESIS 2027 · staff</p>
      <h1>Live numbers</h1>
      <div className="gp-stats">
        <div><b>{arrivals}</b>checked in</div>
        <div><b>{passes}</b>passes</div>
        <div><b>{saved}</b>saved to an account</div>
        <div><b>{photos}</b>photos taken, {photoSaves} opened</div>
      </div>
      <h2>Stamps per booth</h2>
      <ul className="gp-list">
        {BOOTHS.map((b, i) => <li key={b.slug}><a aria-disabled>{b.nonprofit}<span>{perBooth[i]}</span></a></li>)}
      </ul>
      <p style={{ marginTop: 20 }}><Link href={href("/booth")}>Open the photobooth</Link></p>
    </>
  );
}
