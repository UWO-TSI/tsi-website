import { passForTap, tapRedirect } from "@/lib/genesis/server";

export const dynamic = "force-dynamic";

/** The photobooth receipt's QR (genesis.tethos.ca/ph/<id>): make sure the phone has a pass, then open the photo, which saves it. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.toLowerCase();
  const { secret, href } = await passForTap();
  return tapRedirect(request, href(`/photo/${encodeURIComponent(id)}`), secret);
}
