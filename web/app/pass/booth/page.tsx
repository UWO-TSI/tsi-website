import Link from "next/link";
import { passContext } from "@/lib/genesis/server";
import { isGenesisStaff } from "@/lib/genesis/staff";
import Booth from "./Booth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Photobooth" };

/** The photobooth app (staff only): runs in Chrome on the booth laptop, the guest view on the iPad over Sidecar. */
export default async function BoothPage() {
  const { db, user, href } = await passContext();
  if (!(await isGenesisStaff(db, user))) {
    return (
      <>
        <p className="gp-kicker">GENESIS photobooth</p>
        <h1>Staff only</h1>
        <p>{user ? "This account can't run the booth. Exec and directors (T1 to T3) can." : "Sign in with your Tethos account to run the booth."}</p>
        {!user && <Link href={href("/me")} className="gp-btn">Sign in</Link>}
      </>
    );
  }
  return <Booth />;
}
