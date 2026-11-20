import { boothBySlug } from "@/lib/genesis/booths";
import { stamp } from "@/lib/genesis/pass";
import { passForTap, tapRedirect } from "@/lib/genesis/server";

export const dynamic = "force-dynamic";

/** A booth sticker (genesis.tethos.ca/s/<booth>): stamp it into the pass (made on the spot if needed), then open the project. */
export async function GET(request: Request, { params }: { params: Promise<{ booth: string }> }) {
  const booth = boothBySlug((await params).booth);
  if (!booth) return tapRedirect(request, "/", null);
  const { db, pass, secret, href } = await passForTap();
  const result = pass ? await stamp(db, pass.id, booth.slug) : "error";
  return tapRedirect(request, href(`/p/${booth.slug}${result === "stamped" ? "?stamped=1" : ""}`), secret);
}
