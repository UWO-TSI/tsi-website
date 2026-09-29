"use client";

import { InventoryBody } from "@/components/economy/EconomySheets";
import s from "@/components/progression/progression.module.css";

// Inventory as a route: deep link + OverlaySheet target ("/student/dashboard/economy/inventory").
export default function InventoryPage() {
  return (
    <div className={s.page}>
      <div className={s.pageCard}>
        <h1 style={{ margin: "0 0 12px", fontSize: 22 }}>Inventory</h1>
        <InventoryBody />
      </div>
    </div>
  );
}
