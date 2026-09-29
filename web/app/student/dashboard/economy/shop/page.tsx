"use client";

import { ShopBody } from "@/components/economy/EconomySheets";
import s from "@/components/progression/progression.module.css";

// Shop as a route: deep link + OverlaySheet target ("/student/dashboard/economy/shop").
export default function ShopPage() {
  return (
    <div className={s.page}>
      <div className={s.pageCard}>
        <h1 style={{ margin: "0 0 12px", fontSize: 22 }}>Shop</h1>
        <ShopBody />
      </div>
    </div>
  );
}
