"use client";

/**
 * Companion shell, Me tab (specs/companion.md deliverable 4, reachability §4): profile (display name, member dot
 * [row 223], family [row 222/034], showcase), then the game's own sheets under the game's names: the Bag (items),
 * the Collection (catches), the Journal (quests), the Mailbox, the Wallet and Settings (the phone's part of them).
 */
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Backpack, BookOpen, Mail, ScrollText, Settings, Wallet, type LucideIcon } from "lucide-react";
import { Button, ErrorNote } from "@/components/gui";
import type { Family } from "@/lib/oracle/engine";
import { apiCall } from "@/lib/apiClient";
import { ClassBadge } from "@/components/portal/classIdentity";
import { BagSheet } from "@/components/game/Bag";
import CollectionBook from "@/components/game/CollectionBook";
import { ShowcaseSheet } from "@/components/game/peaceful/ShowcaseSheets";
import LettersSheet from "@/components/progression/LettersSheet";
import JournalSheet from "@/components/progression/JournalSheet";
import { WalletSheet } from "@/components/economy/EconomySheets";
import SettingsSheet from "@/components/game/oracle/SettingsSheet";
import s from "@/components/study/companion.module.css";

interface IdentityMe {
  world_name: string | null;
  badge: "member" | null;
  family: Family | null;
}

type SheetName = "bag" | "collection" | "journal" | "mailbox" | "wallet" | "settings" | "showcase" | null;
/** The six, as phone app tiles in their colours. */
const TILES: { sheet: Exclude<SheetName, "showcase" | null>; label: string; icon: LucideIcon; tile: string }[] = [
  { sheet: "bag", label: "Bag", icon: Backpack, tile: "#f7cd67" },
  { sheet: "collection", label: "Collection", icon: BookOpen, tile: "#82d5bb" },
  { sheet: "journal", label: "Journal", icon: ScrollText, tile: "#c3a6ee" },
  { sheet: "mailbox", label: "Mailbox", icon: Mail, tile: "#e59266" },
  { sheet: "wallet", label: "Wallet", icon: Wallet, tile: "#f6b26b" },
  { sheet: "settings", label: "Settings", icon: Settings, tile: "#a7bfd6" },
];

export default function MeTab() {
  const [me, setMe] = useState<IdentityMe | null | "error">(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const close = useCallback(() => setSheet(null), []);

  useEffect(() => {
    let cancelled = false;
    apiCall<IdentityMe>("/api/identity/me", "identity").then(
      (v) => !cancelled && setMe(v),
      () => !cancelled && setMe("error"),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const name = me && me !== "error" ? me.world_name ?? "Unnamed islander" : "…";
  const initial = name.charAt(0).toUpperCase() || "?";

  return (
    <>
      <section className={s.card}>
        <div className={s.meHead}>
          <span className={s.meAvatar} aria-hidden>{initial}</span>
          <div>
            <div className={s.meName}>
              {name}
              {me && me !== "error" && me.badge === "member" ? <span className={s.dot} title="TSI member" aria-label="TSI member" /> : null}
            </div>
            {me && me !== "error" && me.family ? <ClassBadge cls={me.family} iconSize={14} fontSize={13} /> : <span className={s.muted}>No family yet</span>}
          </div>
        </div>
        {me === "error" ? <ErrorNote>Your profile didn’t load. The connection may have dropped.</ErrorNote> : null}
        <div className={s.row} style={{ marginTop: 12 }}>
          <Button variant="quiet" size="sm" onClick={() => setSheet("showcase")}>Your showcase</Button>
        </div>
      </section>

      {/* The game's names (menus §4): the Bag holds items, the Collection your catches, the Journal your quests. */}
      <div className={s.grid2}>
        {TILES.map(t => <button key={t.sheet} className={s.tile} onClick={() => setSheet(t.sheet)}>
          <span className={s.appTile} style={{ "--tile": t.tile } as CSSProperties} aria-hidden><t.icon size={24} strokeWidth={2.2} /></span>{t.label}
        </button>)}
      </div>

      <BagSheet open={sheet === "bag"} onClose={close} />
      <CollectionBook open={sheet === "collection"} onClose={close} />
      <JournalSheet open={sheet === "journal"} onClose={close} />
      <LettersSheet open={sheet === "mailbox"} onClose={close} />
      <WalletSheet open={sheet === "wallet"} onClose={close} />
      <SettingsSheet open={sheet === "settings"} onClose={close} place="phone" />
      <ShowcaseSheet open={sheet === "showcase"} onClose={close} />
    </>
  );
}
