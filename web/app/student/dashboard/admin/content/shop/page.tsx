"use client";

import Link from "next/link";
import { ArrowLeft, History, Plus, Pencil, Store } from "lucide-react";
import { AdminGate, buttonLinkCls } from "@/components/portal/ProgressionAdminShared";
import { useShopItems } from "@/lib/content/loader";
import { Amount } from "@/components/economy/Amount";
import { Badge, Card, Empty, Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const BACK = "mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]";
/** A link in the kit's small sage button. */
const BUTTON_LINK = buttonLinkCls;
const TH = "px-4 py-3 text-xs font-extrabold whitespace-nowrap text-[var(--gui-ink-2)]";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

export default function AdminContentShopPage() {
  const { data: items, isLoading } = useShopItems();

  return (
    <AdminGate>
      <div className={PAGE}>
        <Link href="/student/dashboard/admin" className={BACK}>
          <ArrowLeft size={16} aria-hidden />
          Back to admin
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">
              Shop items
            </h1>
            <p className="mt-1 text-sm text-[var(--gui-muted)]">
              {items.length} items
            </p>
          </div>
          <Link
            href="/student/dashboard/admin/content/shop/new"
            className={BUTTON_LINK}
            data-size="sm"
          >
            <Plus size={16} aria-hidden /> New shop item
          </Link>
        </div>

        {isLoading ? (
          <Loading label="Getting the shop items…" />
        ) : items.length === 0 ? (
          <Empty icon={<Store size={32} />} title="No shop items yet">
            Add one and it goes on sale in the shop.
          </Empty>
        ) : (
          <Card style={{ padding: 0 }} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--gui-paper-warm)]">
                  <th className={`${TH} text-left`}>Item</th>
                  <th className={`${TH} text-left`}>Category</th>
                  <th className={`${TH} text-right`}>Price</th>
                  <th className={`${TH} text-left`}>Rarity</th>
                  <th className={`${TH} text-right`}>Stock</th>
                  <th className={`${TH} text-left`}>Status</th>
                  <th className={`${TH} text-left`}>Released</th>
                  <th className={TH}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t-2 border-dashed border-[var(--gui-paper-edge)]"
                  >
                    <td className="px-4 py-3">
                      <span className="font-extrabold text-[var(--gui-ink-strong)]">
                        {item.display_name}
                      </span>
                      <div className="text-xs text-[var(--gui-muted)]">
                        {item.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--gui-ink-2)]">
                      {item.category}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--gui-ink)]">
                      {typeof item.tc_price === "number" ? (
                        <Amount n={item.tc_price} currency="gems" />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.rarity ? (
                        <span className="inline-flex items-center gap-1.5 text-[var(--gui-ink)]">
                          <i
                            aria-hidden
                            className="h-3 w-3 rounded-full shadow-[inset_0_0_0_1.5px_var(--gui-paper-line)]"
                            style={{ background: `var(--gui-rarity-${item.rarity}, var(--gui-rarity-common))` }}
                          />
                          {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
                        </span>
                      ) : (
                        <span className="text-[var(--gui-ink-2)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--gui-ink-2)]">
                      {item.stock === null ? "No limit" : item.stock}
                    </td>
                    <td className="px-4 py-3">
                      {item.active ? (
                        <Badge tone="success">On sale</Badge>
                      ) : (
                        <Badge>Retired</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--gui-ink-2)]">
                      {day(item.released_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-3 whitespace-nowrap">
                        <Link
                          href={`/student/dashboard/admin/content/shop/${item.id}/edit`}
                          className="inline-flex items-center gap-1 font-bold text-[var(--gui-sage)] hover:underline"
                        >
                          <Pencil size={14} aria-hidden /> Edit
                        </Link>
                        <Link
                          href={`/student/dashboard/admin/content/shop/${item.id}/history`}
                          className="inline-flex items-center gap-1 font-bold text-[var(--gui-ink-2)] hover:underline"
                        >
                          <History size={14} aria-hidden /> History
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AdminGate>
  );
}
