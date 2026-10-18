"use client";

import ShopView from "@/components/portal/ShopView";

// Shop as a route: deep link + OverlaySheet target ("/student/dashboard/economy/shop"). The same shop as /shop: the
// in-game overlay's body on the page (specs/polish/flat-ui.md step 2).
export default function ShopPage() {
  return <ShopView />;
}
