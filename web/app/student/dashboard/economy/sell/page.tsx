"use client";

import { SellBody } from "@/components/economy/EconomySheets";
import { ShoppingBasket } from "lucide-react";
import { Banner } from "@/components/gui";
import s from "@/components/progression/progression.module.css";

// Sell as a route: deep link + OverlaySheet target ("/student/dashboard/economy/sell").
export default function SellPage() {
  return (
    <div className={s.page}>
      <Banner title="Sell" icon={<ShoppingBasket size={26} />} tone="butter">Turn your catches and finds into TC.</Banner>
      <div className={s.pageCard}>
        <SellBody />
      </div>
    </div>
  );
}
