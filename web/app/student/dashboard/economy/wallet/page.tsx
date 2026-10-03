"use client";

import { WalletBody } from "@/components/economy/EconomySheets";
import { Wallet } from "lucide-react";
import { Banner } from "@/components/gui";
import s from "@/components/progression/progression.module.css";

// Wallet as a route: deep link + OverlaySheet target ("/student/dashboard/economy/wallet").
export default function WalletPage() {
  return (
    <div className={s.page}>
      <Banner title="Wallet" icon={<Wallet size={26} />} tone="butter">Your TC and Gems, and where they came from.</Banner>
      <div className={s.pageCard}>
        <WalletBody />
      </div>
    </div>
  );
}
