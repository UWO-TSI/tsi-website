"use client";

import { ShopBody } from "@/components/economy/EconomySheets";
import { httpEconomyTransport, type EconomyTransport } from "@/lib/wallet/transport";

/**
 * The portal's shop page (/student/dashboard/shop; specs/polish/flat-ui.md step 2): the in-game shop overlay's body in
 * the same flat panel, on the economy service (coins and Gems, the club merch and your pickups). It used to be an older
 * copy of the shop over the legacy catalogue.
 */
export default function ShopView({ transport = httpEconomyTransport }: { transport?: EconomyTransport }) {
  return <div style={{ maxWidth: 1360, margin: "0 auto", padding: "20px 20px 32px" }}><ShopBody transport={transport} /></div>;
}
