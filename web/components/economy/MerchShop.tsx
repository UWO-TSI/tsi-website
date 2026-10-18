"use client";

/**
 * The club merch (David's reference, references/ui/shop/2026-10-18-ref-merch-grid.png): a light, clean grid of large
 * white cards, each with the item's still render (its icon, a render of its 3D model) centred on white, its name over
 * a quiet line of kind · Tethos club, its price in Gems as a grey pill, a small ↗ and an optional tag (staff pick, new
 * drop). Filter pills at the top pick a kind, with the Tethos mark on the active one. A card opens the item: its model
 * turning in the middle with the pixel finish (MerchViewer), its name, price and the reserve button.
 */
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Sparkles } from "lucide-react";
import { shopIcon } from "@/lib/icons/keys";
import type { ShopEntry } from "@/lib/wallet/service";
import { MERCH_KINDS, merchFilters, merchKind, merchTag, type MerchKind } from "@/lib/wallet/merchShelf";
import { Amount } from "./Amount";
import MerchViewer from "./MerchViewer";
import s from "./MerchShop.module.css";

const KIND_LABEL = new Map(MERCH_KINDS.map(k => [k.id, k.label]));
const sub = (e: ShopEntry) => `${KIND_LABEL.get(merchKind(e))} · Tethos club`;
const art = (e: ShopEntry) => e.sprite_url ?? shopIcon({ slug: e.slug, catalogue_ref: e.catalogue_ref, category: e.category });

function Tag({ slug }: { slug: string }) {
  const tag = merchTag(slug);
  return tag ? <span className={s.tag}><Sparkles size={12} aria-hidden />{tag}</span> : null;
}

function Stock({ e }: { e: ShopEntry }) {
  if (e.stock === null) return null;
  return e.stock > 0 ? <span className={s.stock}>{e.stock} left</span> : <span className={s.soldOut}>Sold out</span>;
}

export default function MerchShop({ items, busy, onReserve }: {
  items: ShopEntry[]; busy: string | null;
  onReserve: (e: ShopEntry) => void;
}) {
  const [filter, setFilter] = useState<"all" | MerchKind>("all");
  const [open, setOpen] = useState<string | null>(null);
  const filters = merchFilters(items);
  const shown = filter === "all" ? items : items.filter(e => merchKind(e) === filter);
  const item = items.find(e => e.id === open);

  if (item) return <div className={s.shelf} data-testid="merch-detail">
    <button type="button" className={s.back} onClick={() => setOpen(null)}><ArrowLeft size={16} aria-hidden />All merch</button>
    <div className={s.detail}>
      <div className={s.stage}><MerchViewer key={item.slug} slug={item.slug} name={item.name} caption={false} large /></div>
      <div className={s.info}>
        <Tag slug={item.slug} />
        <h3 className={s.detailName}>{item.name}</h3>
        <p className={s.sub}>{sub(item)}</p>
        {item.description ? <p className={s.description}>{item.description}</p> : null}
        <p className={s.priceRow}><span className={s.price}><Amount n={item.price} currency={item.currency} /></span><Stock e={item} /></p>
        <button type="button" className={s.redeem} disabled={!item.can_buy || busy !== null} onClick={() => onReserve(item)}>
          {busy === item.id ? "One moment…" : "Redeem with Gems"}
        </button>
        <p className={s.fine}>Reserve it here, then pick it up at HQ on campus.</p>
      </div>
    </div>
  </div>;

  return <div className={s.shelf} data-testid="merch-grid">
    {filters.length > 1 && <div className={s.filters} role="radiogroup" aria-label="Kind of merch">
      {filters.map(f => <button key={f} type="button" role="radio" aria-checked={filter === f} className={s.filter} data-active={filter === f || undefined} onClick={() => setFilter(f)}>
        {filter === f && <span className={s.mark} aria-hidden />}{f === "all" ? "all" : KIND_LABEL.get(f)}
      </button>)}
    </div>}
    <div className={s.grid}>
      {shown.map(e => <button key={e.id} type="button" className={s.card} onClick={() => setOpen(e.id)} aria-label={`${e.name}, ${e.price} Gems`}>
        <Tag slug={e.slug} />
        <ArrowUpRight className={s.arrow} size={18} aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.art} src={art(e)} alt="" width={128} height={128} />
        <span className={s.foot}>
          <span className={s.text}><span className={s.name}>{e.name}</span><span className={s.sub}>{sub(e)}</span></span>
          <span className={s.price}><Amount n={e.price} currency={e.currency} size={15} /></span>
        </span>
        {e.stock === 0 ? <span className={s.soldOutBadge}>Sold out</span> : null}
      </button>)}
    </div>
  </div>;
}
