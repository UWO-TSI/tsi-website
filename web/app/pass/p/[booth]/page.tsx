import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOTHS, boothBySlug } from "@/lib/genesis/booths";
import { stampsOf } from "@/lib/genesis/pass";
import { passContext } from "@/lib/genesis/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ booth: string }> }) {
  const b = boothBySlug((await params).booth);
  return { title: b ? `${b.project}, ${b.nonprofit}` : "Project" };
}

/** A project: what the nonprofit does, the problem, what the team built. Shows the stamp when the sticker just landed it. */
export default async function Project({ params, searchParams }: { params: Promise<{ booth: string }>; searchParams: Promise<{ stamped?: string }> }) {
  const b = boothBySlug((await params).booth);
  if (!b) notFound();
  const { db, pass, href } = await passContext();
  const count = pass ? (await stampsOf(db, pass.id)).length : 0;
  const { stamped } = await searchParams;
  return (
    <>
      {stamped && <div className="gp-banner">Collected. {count} of {BOOTHS.length} booths on your pass.</div>}
      <p className="gp-kicker">{b.nonprofit}</p>
      <h1>{b.project}</h1>
      <p>{b.line}</p>
      <h2>The nonprofit</h2>
      <p>{b.nonprofitAbout}</p>
      <h2>The problem</h2>
      <p>{b.problem}</p>
      <h2>What the team built</h2>
      <p>{b.built}</p>
      <p><a href={b.site} target="_blank" rel="noopener noreferrer">Visit {b.nonprofit}</a></p>
      <p style={{ marginTop: 24 }}><Link href={href("/")} className="gp-btn gp-btn--quiet">Back to my pass</Link></p>
    </>
  );
}
