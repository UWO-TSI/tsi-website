"use client";

import { ShopBody } from "@/components/economy/EconomySheets";
import { Store } from "lucide-react";
import { Banner } from "@/components/gui";
import s from "@/components/progression/progression.module.css";

// Shop as a route: deep link + OverlaySheet target ("/student/dashboard/economy/shop").
export default function ShopPage() {
  return (
    <div className={s.page}>
      <Banner title="Shop" icon={<Store size={26} />} tone="butter">Tools, outfits, furniture and merch.</Banner>
      <div className={s.pageCard}>
        <ShopBody />
      </div>
    </div>
  );
}
