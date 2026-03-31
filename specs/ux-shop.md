# UX Spec — Shop (E-Commerce Catalog)

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-03-29
> **Frontend reads this to build:** `web/app/student/dashboard/shop/page.tsx`, `web/components/portal/ProductCard.tsx`, `web/components/portal/ProductDetail.tsx`

---

## 1. Overview

The Shop is a **real merchandise e-commerce store** — not avatar cosmetics. Players navigate to `/student/dashboard/shop` to browse and purchase physical items (hoodies, stickers, etc.) and digital goods. Supports **dual currency**: real money (Stripe/PayPal) and TSI coins.

**Route:** `/student/dashboard/shop`
**Entry:** Sidebar nav item "Shop" OR entering the Shop building in the game world (fade-to-black → navigates to this page)

---

## 2. Page Layout

```
+---[Shop Page]-----------------------------------+
|  Shop                     Balance: 450 TSI coin |
+-------------------------------------------------+
|  [All] [Apparel] [Accessories] [Digital] [Merch]|
+-------------------------------------------------+
|  [Product] [Product] [Product] [Product]        |
|  [Product] [Product] [Product] [Product]        |
|  [Product] [Product] [Product] [Product]        |
+-------------------------------------------------+
```

### 2.1 Page Container

| Property | Value |
|----------|-------|
| Padding | `var(--space-6)` (24px) |
| Max-width | `1120px` |
| Margin | `0 auto` |
| Background | `var(--color-bg-main)` (#0f0f10) |

### 2.2 Page Header

| Element | Style |
|---------|-------|
| Title | "Shop", `var(--font-size-h3)` (30px), `var(--color-text-main)`, weight 700 |
| Coin balance | Right-aligned, `var(--font-size-body)` (16px), IBM Plex Mono, `var(--color-brand-yellow)` (#ffd166) |
| Coin icon | Small coin icon (16px) before balance number |
| Header margin-bottom | `var(--space-6)` (24px) |

---

## 3. Category Tabs

```
[All] [Apparel] [Accessories] [Digital] [Merch]
```

| Property | Value |
|----------|-------|
| Container | `flex`, `gap: var(--space-2)` (8px), `overflow-x: auto` |
| Margin-bottom | `var(--space-6)` (24px) |
| Tab height | `36px` |
| Tab padding | `0 var(--space-4)` (0 16px) |
| Tab font | `var(--font-size-body-sm)` (14px), weight 500 |
| Tab radius | `var(--radius-pill)` |
| Inactive | `var(--color-text-muted)`, `transparent` bg, `1px solid var(--gray-700)` |
| Active | `var(--color-text-main)`, `rgba(0, 47, 167, 0.15)` bg, `1px solid var(--color-brand-blue)` |
| Hover | `var(--color-text-soft)`, `rgba(255, 255, 255, 0.04)` bg |

**Categories:** All, Apparel, Accessories, Digital, Merch

---

## 4. Product Grid

| Property | Value |
|----------|-------|
| Display | CSS Grid |
| Columns | `repeat(auto-fill, minmax(260px, 1fr))` |
| Gap | `var(--space-6)` (24px) |
| Results | 3–4 cards per row on desktop, 2 on tablet, 1 on mobile |

---

## 5. Product Card — Standard E-Commerce

```
+-------------------+
|  [Product Photo]  |
|    400×400        |
|    aspect-ratio   |
|    1:1            |
+-------------------+
|  TSI Hoodie       |
|  $45.00           |
|  [Add to Cart]    |
+-------------------+
```

### 5.1 Card Container

| Property | Value |
|----------|-------|
| Background | `var(--color-surface)` (#111827) |
| Border | `1px solid rgba(255, 255, 255, 0.06)` |
| Border-radius | `var(--radius-md)` (16px) |
| Overflow | `hidden` |
| Cursor | `pointer` |
| Transition | `border-color 0.2s, transform 0.2s` |

### 5.2 Card Hover

| Property | Value |
|----------|-------|
| Border-color | `rgba(0, 47, 167, 0.3)` |
| Transform | `translateY(-2px)` |
| Shadow | `var(--shadow-soft)` |
| Image | Show secondary product image (if available) via opacity crossfade |

### 5.3 Card Elements

#### Product Image

| Property | Value |
|----------|-------|
| Aspect ratio | `1 / 1` (square) |
| Width | `100%` |
| Object-fit | `cover` |
| Background | `var(--color-bg-alt)` (#111113) (loading placeholder) |

#### Product Info Area

| Property | Value |
|----------|-------|
| Padding | `var(--space-4)` (16px) |
| Gap | `var(--space-2)` (8px) |

#### Product Name

| Property | Value |
|----------|-------|
| Font | `var(--font-size-body)` (16px), weight 600 |
| Color | `var(--color-text-main)` (#f1ffff) |
| Lines | Max 2, `text-overflow: ellipsis` |

#### Price Display (Dual Currency)

| Property | Value |
|----------|-------|
| Real price | `var(--font-size-body)` (16px), `var(--color-text-main)`, weight 700 |
| Coin price | `var(--font-size-body-sm)` (14px), `var(--color-brand-yellow)` (#ffd166), IBM Plex Mono |
| Layout | Real price on left, coin price on right (or below) |
| Separator | "or" in `var(--color-text-subtle)` between prices |
| Format | "$45.00 or 450 TSI" |

Items may have: real money only, coins only, or both options.

#### Add to Cart Button

| Property | Value |
|----------|-------|
| Style | Primary button (see DESIGN_SYSTEM.md Section 7.5) |
| Text | "Add to Cart" |
| Height | `36px` |
| Width | `100%` |
| Font | `var(--font-size-body-sm)` (14px), weight 500 |
| Hover | `glow-blue` + `scale(1.02)` |
| Active | `scale(0.98)` |

---

## 6. Product Detail Page/Modal

Clicking a product card opens a detail view. Can be a modal overlay or route (`/student/dashboard/shop/[id]`).

```
+-----------------------------------------------+
|  [< Back to Shop]                              |
+-----------------------------------------------+
|  [Product Image]     |  TSI Hoodie             |
|  [thumb] [thumb]     |  $45.00 or 450 TSI      |
|                      |                          |
|                      |  Size: [S] [M] [L] [XL]  |
|                      |  Color: [Blk] [Wht] [Nvy]|
|                      |                          |
|                      |  [Add to Cart]           |
|                      |  [Buy with TSI Coins]    |
+-----------------------------------------------+
|  Description                                   |
|  Premium heavyweight hoodie with embroidered   |
|  Tethos logo. 100% cotton, unisex fit.         |
+-----------------------------------------------+
```

### 6.1 Layout

| Property | Value |
|----------|-------|
| Display | `grid`, `grid-template-columns: 1fr 1fr` on desktop, stacked on mobile |
| Gap | `var(--space-8)` (32px) |
| Max-width | `960px` |
| Padding | `var(--space-6)` (24px) |

### 6.2 Image Gallery

| Property | Value |
|----------|-------|
| Main image | `aspect-ratio: 1/1`, `border-radius: var(--radius-md)`, `object-fit: cover` |
| Thumbnails | `64px × 64px`, row below main image, `gap: var(--space-2)` |
| Active thumbnail | `border: 2px solid var(--color-brand-blue)` |
| Click behavior | Swap main image |

### 6.3 Product Info

| Element | Style |
|---------|-------|
| Name | `var(--font-size-h3)` (30px), `var(--color-text-main)`, weight 700 |
| Price (real) | `var(--font-size-h4)` (24px), `var(--color-text-main)`, weight 700 |
| Price (coin) | `var(--font-size-body)` (16px), `var(--color-brand-yellow)`, IBM Plex Mono |
| "or" separator | `var(--font-size-body-sm)`, `var(--color-text-subtle)` |

### 6.4 Variant Selectors

**Size selector:**

| Property | Value |
|----------|-------|
| Layout | `flex`, `gap: var(--space-2)` |
| Option | `40px × 40px`, `var(--radius-sm)` (8px) |
| Unselected | `var(--color-text-muted)`, `1px solid var(--gray-700)` |
| Selected | `var(--color-text-main)`, `1px solid var(--color-brand-blue)`, `rgba(0, 47, 167, 0.15)` bg |
| Out of stock | `var(--color-text-subtle)`, strikethrough, `cursor: not-allowed` |

**Color selector:**

| Property | Value |
|----------|-------|
| Layout | `flex`, `gap: var(--space-2)` |
| Swatch | `32px × 32px`, `border-radius: 50%`, filled with actual color |
| Selected | `ring: 2px solid var(--color-brand-blue)`, `ring-offset: 2px` |

### 6.5 Action Buttons

| Button | Style |
|--------|-------|
| "Add to Cart" | Primary button, full width |
| "Buy with TSI Coins" | Ghost button below, `var(--color-brand-yellow)` text, `1px solid var(--color-brand-yellow)` border |

### 6.6 Description

| Property | Value |
|----------|-------|
| Label | "Description", section label style (uppercase, `var(--font-size-label)`, `var(--color-text-subtle)`) |
| Body | `var(--font-size-body)` (16px), `var(--color-text-soft)`, `max-width: 600px` |
| Margin-top | `var(--space-6)` (24px) |

---

## 7. Cart / Checkout (Phase 3 — stub spec)

> Detailed checkout flow spec deferred. Key decisions for Frontend to scaffold:

| Element | Approach |
|---------|----------|
| Cart icon | Top-right of shop page header, badge with item count |
| Cart panel | Slide-over from right (like mobile sidebar) |
| Checkout | Redirect to Stripe checkout session (real money) or in-app confirmation (coins) |
| Coin purchase | Modal confirmation: "Spend 450 TSI coins on TSI Hoodie?" with balance display |

---

## 8. Empty & Loading States

### Loading

| Property | Value |
|----------|-------|
| Skeleton cards | 8 placeholder cards matching grid layout |
| Skeleton image | `aspect-ratio: 1/1`, `var(--gray-800)` |
| Skeleton text | 2 bars at 60%/40% width, `var(--gray-800)` |
| Animation | Shimmer pulse (opacity 0.5 ↔ 1.0, 1.5s) |

### Empty (filtered category with no items)

| Property | Value |
|----------|-------|
| Icon | Lucide `ShoppingBag` (32px), `var(--color-text-subtle)` |
| Text | "No items in this category yet", `var(--color-text-muted)` |
| Container | Centered, `padding: var(--space-12)` |
