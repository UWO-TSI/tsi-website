"use client";

import { SellBody } from "@/components/economy/EconomySheets";
import s from "@/components/progression/progression.module.css";

// Sell as a route: deep link + OverlaySheet target ("/student/dashboard/economy/sell").
export default function SellPage() {
  return (
    <div className={s.page}>
      <div className={s.pageCard}>
        <h1 style={{ margin: "0 0 12px", fontSize: 22 }}>Sell</h1>
        <SellBody />
      </div>
    </div>
  );
}
