import { arrive } from "@/lib/genesis/pass";
import { passForTap, tapRedirect } from "@/lib/genesis/server";

export const dynamic = "force-dynamic";

/** The front desk sticker (genesis.tethos.ca/start): make the pass if there isn't one, count the arrival, then setup or home. */
export async function GET(request: Request) {
  const { db, pass, secret, href } = await passForTap();
  if (pass) await arrive(db, pass.id);
  return tapRedirect(request, href(pass?.name ? "/?welcome=1" : "/setup"), secret);
}
