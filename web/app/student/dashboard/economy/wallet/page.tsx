"use client";

import { WalletBody } from "@/components/economy/EconomySheets";
import s from "@/components/progression/progression.module.css";

// Wallet as a route: deep link + OverlaySheet target ("/student/dashboard/economy/wallet").
export default function WalletPage() {
  return (
    <div className={s.page}>
      <div className={s.pageCard}>
        <h1 style={{ margin: "0 0 12px", fontSize: 22 }}>Wallet</h1>
        <WalletBody />
      </div>
    </div>
  );
}
