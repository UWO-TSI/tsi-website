"use client";

/**
 * Companion shell, Me tab (specs/companion.md deliverable 4): profile
 * (display name, member dot [row 223], family [row 222/034], showcase),
 * inventory, journal, mailbox — all the existing sheets, just opened from
 * the phone shell instead of the 3D world's HUD.
 */
import { useCallback, useEffect, useState } from "react";
import { Backpack, BookOpen, Mail } from "lucide-react";
import { Button, ErrorNote } from "@/components/gui";
import type { Family } from "@/lib/oracle/engine";
import { apiCall } from "@/lib/apiClient";
import { ClassBadge } from "@/components/portal/classIdentity";
import { BagSheet } from "@/components/game/Bag";
import CollectionBook from "@/components/game/CollectionBook";
import { ShowcaseSheet } from "@/components/game/peaceful/ShowcaseSheets";
import LettersSheet from "@/components/progression/LettersSheet";
import s from "@/components/study/companion.module.css";

interface IdentityMe {
  world_name: string | null;
  badge: "member" | null;
  family: Family | null;
}

type SheetName = "bag" | "journal" | "mailbox" | "showcase" | null;

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

      {/* The naming pass (menus §4): the Bag holds items, the Collection your catches (this said Journal). */}
      <div className={s.grid2}>
        <button className={s.tile} onClick={() => setSheet("bag")}><span className={s.appTile} style={{ "--tile": "#f7cd67" } as React.CSSProperties} aria-hidden><Backpack size={24} strokeWidth={2.2} /></span>Bag</button>
        <button className={s.tile} onClick={() => setSheet("journal")}><span className={s.appTile} style={{ "--tile": "#82d5bb" } as React.CSSProperties} aria-hidden><BookOpen size={24} strokeWidth={2.2} /></span>Collection</button>
        <button className={s.tile} onClick={() => setSheet("mailbox")}><span className={s.appTile} style={{ "--tile": "#e59266" } as React.CSSProperties} aria-hidden><Mail size={24} strokeWidth={2.2} /></span>Mailbox</button>
      </div>

      <BagSheet open={sheet === "bag"} onClose={close} />
      <LettersSheet open={sheet === "mailbox"} onClose={close} />
      <CollectionBook open={sheet === "journal"} onClose={close} />
      <ShowcaseSheet open={sheet === "showcase"} onClose={close} />
    </>
  );
}
