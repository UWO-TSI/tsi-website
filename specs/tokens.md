# Design Tokens — Game & Portal Specific

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-03-27
> **Extends:** `web/styles/tokens.css` (base design tokens)
> **Frontend:** Add these as CSS custom properties in a new `web/styles/game-tokens.css` or append to `tokens.css`

---

## 1. Overview

These tokens extend the base design system (`tokens.css`) with game-specific and portal-specific values. The base tokens (colors, typography, spacing, radii, shadows) remain unchanged. These tokens cover the student dashboard sidebar, game world, directory, overlay panels, and interaction states.

---

## 2. Sidebar Tokens

```css
/* Sidebar */
--sidebar-width: 240px;
--sidebar-width-collapsed: 0px;        /* fully hidden below breakpoint */
--sidebar-bg: var(--color-surface);     /* #111827 */
--sidebar-border: var(--glass-border-soft); /* rgba(241,255,255,0.12) */
--sidebar-padding-x: var(--space-2);    /* 8px */
--sidebar-padding-top: var(--space-4);  /* 16px */
--sidebar-z: 40;

/* Sidebar - Nav Items */
--nav-item-height: 40px;
--nav-item-gap: var(--space-1);         /* 4px */
--nav-item-padding-x: var(--space-3);   /* 12px */
--nav-item-radius: var(--radius-sm);    /* 8px */
--nav-item-icon-size: 18px;
--nav-item-icon-gap: var(--space-3);    /* 12px */

/* Sidebar - Active Indicator */
--nav-active-accent-width: 2px;
--nav-active-accent-color: var(--color-brand-blue); /* #002fa7 */
--nav-active-bg: rgba(255, 255, 255, 0.06);

/* Sidebar - Hover */
--nav-hover-bg: rgba(255, 255, 255, 0.04);

/* Sidebar - Player Status */
--sidebar-avatar-size: 32px;
--sidebar-status-padding: var(--space-3); /* 12px */
```

---

## 3. Responsive Tokens

```css
/* Breakpoints (reference — these are Tailwind defaults, not CSS vars) */
/* md: 768px — sidebar collapse point */
/* lg: 1024px */

/* Hamburger Button */
--hamburger-size: 40px;
--hamburger-icon-size: 24px;
--hamburger-offset: var(--space-3);     /* 12px from edges */
--hamburger-z: 50;

/* Mobile Sidebar Overlay */
--sidebar-overlay-z: 50;
--sidebar-backdrop-z: 45;
--sidebar-backdrop-bg: rgba(0, 0, 0, 0.5);
--sidebar-slide-duration: 0.25s;
--sidebar-slide-ease: ease-out;
```

---

## 4. Game World Tokens

```css
/* Camera */
--game-camera-fov: 35;
--game-camera-polar: 45deg;
--game-camera-distance: 20;
--game-camera-near: 0.1;
--game-camera-far: 200;

/* Fog */
--game-fog-color: var(--color-bg-main); /* #0f0f10 */
--game-fog-near: 60;
--game-fog-far: 120;

/* Map */
--game-map-size: 80;                    /* 80��80 units */
--game-spawn-x: 0;
--game-spawn-z: -20;

/* Player */
--game-player-speed: 5;                 /* units/second */
--game-player-rotation-lerp: 10;

/* Interaction */
--game-interact-range: 3;               /* units, overworld */
--game-interact-range-interior: 2;      /* units, inside HQ */

/* Lighting */
--game-ambient-intensity: 0.4;
--game-sun-color: #ffeedd;
--game-sun-intensity: 0.8;
--game-lamp-color: #ffcc88;
--game-lamp-intensity: 0.6;
--game-lamp-range: 8;

/* HQ */
--game-hq-room-width: 20;
--game-hq-room-depth: 16;
--game-admin-room-width: 14;
--game-admin-room-depth: 12;
--game-admin-accent-color: var(--color-brand-yellow); /* #ffd166 */
```

---

## 5. Transition Tokens

```css
/* Building Entry/Exit — Fade to Black */
--transition-fade-in: 0.3s;
--transition-fade-out: 0.3s;
--transition-fade-ease-in: ease-in;
--transition-fade-ease-out: ease-out;
--transition-overlay-color: #000000;
--transition-overlay-z: 100;

/* Overlay Panel — Scale In */
--overlay-panel-enter: 0.25s;
--overlay-panel-exit: 0.15s;
--overlay-panel-ease: ease-out;
--overlay-panel-scale-from: 0.95;

/* Overlay Backdrop */
--overlay-backdrop-bg: rgba(0, 0, 0, 0.6);
--overlay-backdrop-blur: 4px;
```

---

## 6. Overlay Panel Tokens

```css
/* Solid Dark Overlay Panel (bounty board, job board, leaderboard, HQ stations) */
--panel-bg: var(--color-bg-navy);       /* #0d1b2a */
--panel-border: 1px solid rgba(0, 47, 167, 0.3);
--panel-radius: var(--radius-md);       /* 16px */
--panel-shadow: var(--shadow-strong);
--panel-max-width: 800px;
--panel-max-height: 80vh;
--panel-padding: var(--space-6);        /* 24px */
--panel-z: 60;

/* Panel Header */
--panel-header-font-size: var(--font-size-h4); /* 24px */
--panel-header-padding-bottom: var(--space-4);  /* 16px */
--panel-header-divider: 1px solid rgba(255, 255, 255, 0.08);
--panel-close-size: 24px;
```

---

## 7. Directory Tokens

```css
/* Directory Page */
--directory-max-width: 960px;
--directory-padding: var(--space-6);    /* 24px */

/* Search Bar */
--search-height: 40px;
--search-bg: var(--color-surface);      /* #111827 */
--search-border: var(--glass-border-soft);
--search-radius: var(--radius-sm);      /* 8px */
--search-icon-size: 16px;
--search-focus-border: var(--color-brand-blue);
--search-focus-ring: 0 0 0 2px rgba(0, 47, 167, 0.2);
--search-debounce: 300ms;

/* Member Row */
--row-height: 64px;
--row-padding-x: var(--space-4);        /* 16px */
--row-gap: var(--space-3);              /* 12px */
--row-border: 1px solid rgba(255, 255, 255, 0.06);
--row-hover-bg: rgba(255, 255, 255, 0.04);
--row-hover-border: rgba(0, 47, 167, 0.2);
--row-radius: var(--radius-sm);         /* 8px */

/* Avatar */
--avatar-size-sm: 32px;                /* sidebar */
--avatar-size-md: 40px;                /* directory row */
--avatar-size-lg: 96px;                /* profile page */

/* XP Bar (inline, directory) */
--xp-bar-width: 80px;
--xp-bar-height: 6px;
--xp-bar-track: var(--gray-800);       /* #27272a */
--xp-bar-fill: var(--color-brand-blue); /* #002fa7 */
--xp-bar-radius: 3px;

/* XP Bar (full, profile page) */
--xp-bar-full-height: 8px;

/* Filter Pill */
--filter-pill-height: 28px;
--filter-pill-padding: 0 var(--space-3); /* 0 12px */
--filter-pill-radius: var(--radius-pill);
--filter-pill-selected-bg: rgba(0, 47, 167, 0.15);
--filter-pill-selected-border: var(--color-brand-blue);
```

---

## 8. Tier Color Tokens

```css
/* Tier 1 — Super Admin (David) — Gold */
--tier-1-color: var(--color-brand-yellow);  /* #ffd166 */
--tier-1-bg: rgba(255, 209, 102, 0.2);
--tier-1-border: var(--color-brand-yellow);

/* Tier 2 — Chapter Presidents — Blue */
--tier-2-color: #4A7AFF;
--tier-2-bg: rgba(0, 47, 167, 0.2);
--tier-2-border: var(--color-brand-blue);   /* #002fa7 */

/* Tier 3 — PMs & VPs — Cyan */
--tier-3-color: var(--color-accent-cyan);   /* #22d3ee */
--tier-3-bg: rgba(34, 211, 238, 0.2);
--tier-3-border: var(--color-accent-cyan);

/* Tier 4 — Directors & Devs — Green */
--tier-4-color: var(--color-success);       /* #22c55e */
--tier-4-bg: rgba(34, 197, 94, 0.2);
--tier-4-border: var(--color-success);

/* Tier 5 — Volunteers — Gray */
--tier-5-color: var(--gray-400);            /* #a1a1aa */
--tier-5-bg: rgba(161, 161, 170, 0.15);
--tier-5-border: var(--gray-600);           /* #52525b */
```

---

## 9. Interaction Prompt Tokens

```css
/* Proximity Prompt ("Press E to enter") */
--prompt-bg: var(--color-surface);          /* #111827 */
--prompt-border: var(--glass-border-soft);
--prompt-radius: var(--radius-sm);          /* 8px */
--prompt-padding: 4px 12px;
--prompt-font-size: var(--font-size-body-sm); /* 14px */
--prompt-fade-duration: 0.2s;

/* Building Label */
--label-bg: rgba(15, 15, 16, 0.7);
--label-padding: 2px 8px;
--label-radius: 4px;
--label-font-size: var(--font-size-label);  /* 12px */
--label-font-family: "IBM Plex Mono", ui-monospace; /* monospace */

/* Nameplate (player) */
--nameplate-bg: rgba(15, 15, 16, 0.6);
--nameplate-padding: 2px 8px;
--nameplate-radius: 4px;
```

---

## 10. Avatar Creator Tokens (Phase 2)

```css
/* Avatar Creator — Tabbed Panel (2D Sprite Preview) */
--creator-width: min(560px, 90vw);
--creator-preview-height: 280px;
--creator-preview-bg: var(--color-bg-alt);  /* #111113 */
--creator-preview-scale: 4;                 /* 4× pixel scale for sprite preview */
--creator-preview-rendering: pixelated;     /* image-rendering: pixelated */
--creator-tab-height: 40px;
--creator-tab-active-border: 2px solid var(--color-brand-blue);
--creator-option-grid-cols: 4;
--creator-option-size: 64px;
--creator-option-gap: var(--space-2);       /* 8px */
--creator-option-radius: var(--radius-sm);  /* 8px */
--creator-option-selected-border: 2px solid var(--color-brand-blue);
--creator-options-max-height: 240px;

/* Sprite Layer Tokens */
--sprite-layer-z-offset: 0.001;             /* z-offset between layers */
--sprite-layer-count: 4;                    /* body, outfit, hair, accessories */
--sprite-frame-rate: 8;                     /* FPS for sprite animation */
--sprite-billboard-width: 1.2;              /* units */
--sprite-billboard-height: 1.8;             /* units */
```

---

## 11. "Coming Soon" Badge Tokens

```css
/* Nav item "Soon" badge */
--badge-soon-font-size: var(--font-size-label); /* 12px */
--badge-soon-color: var(--color-text-subtle);    /* #6b7280 */
--badge-soon-bg: rgba(255, 255, 255, 0.06);
--badge-soon-radius: var(--radius-pill);
--badge-soon-padding: 1px 6px;
```

---

## 12. Skill Tag Tokens

```css
/* Skill tags on profile */
--skill-tag-height: 28px;
--skill-tag-padding: 0 var(--space-3);     /* 0 12px */
--skill-tag-bg: rgba(0, 47, 167, 0.1);
--skill-tag-border: 1px solid rgba(0, 47, 167, 0.2);
--skill-tag-color: var(--color-text-soft);  /* #e5e7eb */
--skill-tag-radius: var(--radius-pill);
```

---

## 13. Z-Index Scale (Portal)

```css
/* Z-index hierarchy for the student portal */
--z-sidebar: 40;
--z-sidebar-backdrop: 45;
--z-sidebar-mobile: 50;
--z-hamburger: 50;
--z-overlay-panel: 60;
--z-overlay-backdrop: 55;
--z-sheet: 60;                             /* mobile bottom sheet */
--z-transition-overlay: 100;
--z-orientation-prompt: 9999;              /* landscape-lock fallback prompt */
--z-building-label: 10;
--z-interaction-prompt: 15;
--z-mobile-hud: 40;
```

---

## 14. Mobile & Responsive Tokens

> **See also:** `specs/ux-mobile.md` for full mobile spec.

```css
/* Orientation Lock */
--mobile-orientation: landscape;

/* Touch Targets */
--touch-target-min: 36px;
--touch-target-comfortable: 44px;
--touch-target-large: 48px;

/* Mobile HUD Strip */
--hud-height: 36px;
--hud-bg: rgba(15, 15, 16, 0.7);
--hud-blur: blur(8px);
--hud-z: var(--z-mobile-hud);

/* Mobile Game Camera Overrides */
--game-camera-fov-mobile: 55;
--game-camera-distance-mobile: 18;
--game-camera-follow-mobile: 0.06;
--game-camera-distance-interior-mobile: 12;
--game-interact-range-mobile: 2.5;

/* Tap-to-Move Feedback */
--tap-indicator-size: 24px;
--tap-indicator-color: rgba(255, 255, 255, 0.6);
--tap-indicator-duration: 0.3s;

/* Bottom Sheet (mobile overlay replacement) */
--sheet-z: var(--z-sheet);
--sheet-radius: 16px;
--sheet-header-height: 48px;
--sheet-handle-width: 32px;
--sheet-handle-height: 4px;
--sheet-handle-color: var(--gray-600);
--sheet-open-duration: 0.3s;
--sheet-open-ease: cubic-bezier(0.32, 0.72, 0, 1);
--sheet-close-duration: 0.25s;
--sheet-close-ease: ease-in;
--sheet-swipe-velocity: 0.5;              /* px/ms threshold */

/* Mobile Directory Overrides */
--row-height-mobile: 48px;
--avatar-size-mobile: 32px;
--directory-padding-mobile: 12px;
--tier-badge-height-mobile: 18px;

/* Mobile Profile Overrides */
--avatar-size-lg-mobile: 64px;
--avatar-border-lg-mobile: 3px;
--profile-name-size-mobile: 24px;
--profile-stat-value-mobile: 20px;

/* Mobile Building Interaction Prompt */
--building-prompt-height-mobile: 36px;
--building-prompt-radius-mobile: 18px;
--building-prompt-bg-mobile: rgba(0, 47, 167, 0.9);
```

---

## Usage Notes

- All game-world numeric values (camera FOV, fog distances, player speed) are stored as CSS vars for reference but used as JS constants in R3F components.
- Color tokens reference base `tokens.css` variables where possible for consistency.
- Tier colors are the only new color palette — everything else reuses the base design system.
- Frontend should create a `game-tokens.css` file importing these values, loaded only within the dashboard layout.
