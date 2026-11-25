import Link from "next/link";
import { PHOTO_ID, savePhoto } from "@/lib/genesis/pass";
import { passContext } from "@/lib/genesis/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your GENESIS photo" };

/** A photobooth photo in colour. Opening it saves it to the pass; a photo still uploading from the booth says so. */
export default async function Photo({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.toLowerCase();
  const { db, pass, href } = await passContext();
  const result = pass && PHOTO_ID.test(id) ? await savePhoto(db, pass.id, id) : "unknown";
  const { data: row } = PHOTO_ID.test(id) ? await db.from("genesis_photos").select("path").eq("id", id).maybeSingle() : { data: null };
  const signed = row ? (await db.storage.from("genesis-photos").createSignedUrl((row as { path: string }).path, 3600)).data?.signedUrl : null;
  const download = row ? (await db.storage.from("genesis-photos").createSignedUrl((row as { path: string }).path, 3600, { download: `genesis-2027-${id}.jpg` })).data?.signedUrl : null;
  return (
    <>
      <p className="gp-kicker"><Link href={href("/")}>← Your pass</Link></p>
      <h1>Your photo</h1>
      {signed ? (
        <>
          {result === "saved" && <div className="gp-banner">Saved to your pass.</div>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signed} alt="Your GENESIS 2027 photobooth photo" className="gp-photo" />
          {download && <a href={download} className="gp-btn" style={{ width: "100%", marginTop: 16 }}>Download</a>}
          {!pass?.user_id && <p style={{ marginTop: 16 }}><Link href={href("/me")}>Save your pass</Link> to keep this photo on any device.</p>}
        </>
      ) : (
        <section className="gp-card">
          <p>This photo is still on its way from the booth. Give it a minute, then refresh.</p>
          <Link href={href(`/photo/${id}`)} className="gp-btn">Refresh</Link>
        </section>
      )}
    </>
  );
}
