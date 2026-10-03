"use client";

import { InventoryBody } from "@/components/economy/EconomySheets";
import { Backpack } from "lucide-react";
import { Banner } from "@/components/gui";
import s from "@/components/progression/progression.module.css";

// Inventory as a route: deep link + OverlaySheet target ("/student/dashboard/economy/inventory").
export default function InventoryPage() {
  return (
    <div className={s.page}>
      <Banner title="Bag" icon={<Backpack size={26} />} tone="butter">What you own: tools, clothes and furniture.</Banner>
      <div className={s.pageCard}>
        <InventoryBody />
      </div>
    </div>
  );
}
