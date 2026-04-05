# UX Spec — Settings Page

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-04-04
> **Route:** `/student/dashboard/settings`
> **Data:** `GET /api/profile` (own profile) · `PATCH /api/profile` (update)
> **Layout:** Tabbed sections — Profile | Social | Appearance | Account

---

## 1. Overview

The Settings page is the central place for users to manage their profile, social links, appearance preferences, and account information. It uses a **horizontal tab bar** with 4 sections, one visible at a time.

**API integration:**
- Load current profile on mount: `GET /api/profile`
- Save changes per-section: `PATCH /api/profile` with changed fields
- Each section has its own "Save Changes" button — no global save

---

## 2. Page Layout

```
+------------------------------------------+
| SETTINGS                                 |
+------------------------------------------+
| [Profile] [Social] [Appearance] [Account]|
+==========================================+
|                                          |
|  (Active section content)                |
|                                          |
|                                          |
|               [Save Changes]             |
|                                          |
+------------------------------------------+
```

### 2.1 Page Container

| Property | Value |
|----------|-------|
| Max-width | `720px` |
| Margin | `0 auto` |
| Padding | `var(--space-6)` (24px) |
| Background | `var(--color-bg-main)` (#0f0f10) |

### 2.2 Page Title

| Property | Value |
|----------|-------|
| Text | "Settings" |
| Font | `var(--font-size-h3)` (30px), weight 700 |
| Color | `var(--color-text-main)` (#f1ffff) |
| Margin-bottom | `var(--space-6)` (24px) |

---

## 3. Tab Bar

### 3.1 Tab Layout

| Property | Value |
|----------|-------|
| Display | `flex`, `gap: 0` |
| Border-bottom | `1px solid rgba(255, 255, 255, 0.06)` |
| Margin-bottom | `var(--space-6)` (24px) |

### 3.2 Tab Item

| Property | Value |
|----------|-------|
| Height | `40px` |
| Padding | `0 var(--space-4)` (0 16px) |
| Font | `var(--font-size-body-sm)` (14px), weight 500 |
| Cursor | `pointer` |
| Border-bottom | `2px solid transparent` (default) |
| Transition | `color 0.15s ease, border-color 0.15s ease` |

### 3.3 Tab States

| State | Text Color | Border-bottom |
|-------|-----------|---------------|
| Default | `var(--color-text-muted)` (#9ca3af) | `transparent` |
| Hover | `var(--color-text-soft)` (#e5e7eb) | `transparent` |
| Active | `var(--color-text-main)` (#f1ffff) | `2px solid var(--color-brand-blue)` (#002fa7) |

### 3.4 Tab Names

| Index | Label | Icon (optional) |
|-------|-------|-----------------|
| 0 | Profile | Lucide `User` |
| 1 | Social | Lucide `Link` |
| 2 | Appearance | Lucide `Palette` |
| 3 | Account | Lucide `Shield` |

---

## 4. Tab: Profile

### 4.1 Section Layout

```
+------------------------------------------+
|  AVATAR                                  |
|  +------+                                |
|  | [Av] | [Body] [Face] [Hair] [Outfit]  |
|  | 4x   |  [Option grid 4×N]            |
|  +------+                                |
|                                          |
|  DISPLAY NAME                            |
|  [____________________________]          |
|                                          |
|  BIO                                     |
|  [____________________________]          |
|  [____________________________]          |
|                                          |
|  SKILLS                                  |
|  [React] [TypeScript] [+] ______        |
|                                          |
|                  [Save Changes]          |
+------------------------------------------+
```

### 4.2 Avatar Editor (inline)

The full avatar creator is embedded directly in the Profile tab.

| Property | Value |
|----------|-------|
| Layout | Two-column: preview (left) + options (right) |
| Preview size | `160px x 240px` |
| Preview bg | `var(--color-bg-alt)` (#111113) |
| Preview scale | `4x` pixel scale (`image-rendering: pixelated`) |
| Preview border | `1px solid var(--glass-border-soft)`, `var(--radius-sm)` |
| Options area | `flex: 1` |

#### Avatar Sub-tabs

| Property | Value |
|----------|-------|
| Tabs | Body, Face, Hair, Outfit |
| Tab height | `36px` |
| Tab font | `13px`, weight 500 |
| Active tab | `border-bottom: 2px solid var(--color-brand-blue)`, `var(--color-text-main)` |
| Inactive tab | `var(--color-text-muted)` |

#### Option Grid

| Property | Value |
|----------|-------|
| Display | `grid`, `grid-template-columns: repeat(4, 1fr)` |
| Gap | `var(--space-2)` (8px) |
| Option size | `64px x 64px` |
| Option bg | `var(--color-surface)` |
| Option border | `1px solid var(--glass-border-soft)` |
| Option radius | `var(--radius-sm)` (8px) |
| Selected border | `2px solid var(--color-brand-blue)` |
| Max-height | `240px` (scrollable) |
| Overflow-y | `auto` |

### 4.3 Display Name Field

| Property | Value |
|----------|-------|
| Label | "Display Name", 12px, uppercase, font-mono, `var(--color-text-subtle)`, `letter-spacing: 0.05em` |
| Input height | `40px` |
| Input bg | `var(--color-surface)` (#111827) |
| Input border | `1px solid var(--glass-border-soft)` |
| Input radius | `var(--radius-sm)` (8px) |
| Input padding | `0 var(--space-3)` (0 12px) |
| Input font | `14px`, `var(--color-text-main)` |
| Focus | `border-color: var(--color-brand-blue)`, `box-shadow: 0 0 0 2px rgba(0, 47, 167, 0.2)` |
| Max length | `50` characters |
| Margin-top | `var(--space-5)` (20px) from avatar section |

### 4.4 Bio Field

| Property | Value |
|----------|-------|
| Label | "Bio" (same label style as Display Name) |
| Element | `<textarea>` |
| Rows | `3` |
| Height | Auto (min 80px) |
| Same styling as input | bg, border, radius, padding, font, focus |
| Max length | `250` characters |
| Character count | Bottom-right, `12px`, `var(--color-text-subtle)`, "123/250" |

### 4.5 Skills Section

| Property | Value |
|----------|-------|
| Label | "Skills" (same label style) |
| Display | Flex wrap of skill pills + add input |
| Existing skills | Same pill style as profile page: `28px`, `12px` padding, brand-blue bg/border, pill radius |
| Remove button | Tiny `X` (12px) inside each pill on hover |
| Add input | Inline input field after pills, `200px` max-width, `28px` height |
| Add trigger | Press Enter or comma to add skill |
| Max skills | `15` |

---

## 5. Tab: Social Links

### 5.1 Section Layout

```
+------------------------------------------+
|  Connect your social profiles.           |
|                                          |
|  GITHUB                                  |
|  [https://github.com/username___]        |
|                                          |
|  LINKEDIN                                |
|  [https://linkedin.com/in/_____]         |
|                                          |
|  WEBSITE / PORTFOLIO                     |
|  [https://______________________]        |
|                                          |
|  TWITTER / X                             |
|  [https://x.com/_________________]      |
|                                          |
|  INSTAGRAM                               |
|  [https://instagram.com/________]        |
|                                          |
|  DISCORD                                 |
|  [username#1234________________]         |
|                                          |
|                  [Save Changes]          |
+------------------------------------------+
```

### 5.2 Social Link Field

Each social link is a labeled URL input.

| Property | Value |
|----------|-------|
| Label | Platform name + icon, 12px, uppercase, font-mono, `var(--color-text-subtle)` |
| Label icon | Lucide icon (20px) inline before text: `Github`, `Linkedin`, `Globe`, `Twitter`, `Instagram`, `Globe` (Discord) |
| Input | Same styling as Profile inputs |
| Placeholder | Platform-specific URL hint (e.g., "https://github.com/username") |
| Validation | URL format check on blur (show error in `var(--color-error)` 12px below input) |
| Gap | `var(--space-4)` (16px) between fields |

### 5.3 Section Description

| Property | Value |
|----------|-------|
| Text | "Connect your social profiles. These appear on your public profile." |
| Font | `14px`, `var(--color-text-muted)` |
| Margin-bottom | `var(--space-5)` (20px) |

---

## 6. Tab: Appearance

### 6.1 Section Layout

```
+------------------------------------------+
|  Customize how the portal looks.         |
|                                          |
|  THEME                                   |
|  +--------+  +--------+                 |
|  | [Moon]  |  | [Sun]  |                |
|  |  Dark   |  | Light  |                |
|  +--------+  +--------+                 |
|                                          |
+------------------------------------------+
```

### 6.2 Theme Toggle

| Property | Value |
|----------|-------|
| Layout | Two cards side by side, `flex`, `gap: var(--space-3)` |
| Card size | `120px x 80px` |
| Card bg | `var(--color-surface)` (#111827) |
| Card border | `1px solid var(--glass-border-soft)` |
| Card radius | `var(--radius-md)` (16px) |
| Card content | Icon (24px) + label (14px, weight 500) centered vertically |
| Selected card border | `2px solid var(--color-brand-blue)` |
| Selected card bg | `rgba(0, 47, 167, 0.1)` |
| Dark icon | Lucide `Moon` |
| Light icon | Lucide `Sun` |
| Card cursor | `pointer` |
| Transition | `border-color 0.15s ease, background 0.15s ease` |

### 6.3 Theme Persistence

| Property | Value |
|----------|-------|
| Storage | `localStorage` key `tethos-theme` |
| Values | `"dark"` (default), `"light"` |
| Apply | Toggle `data-theme="light"` attribute on `<html>` |
| Default | Dark — no attribute needed |

### 6.4 Light Theme Color Overrides

When `data-theme="light"` is set, override these CSS custom properties:

```css
[data-theme="light"] {
  --color-bg-main: #F5F5F5;
  --color-bg-alt: #FFFFFF;
  --color-surface: #FFFFFF;
  --color-text-main: #1A1A2E;
  --color-text-soft: #333355;
  --color-text-muted: #666680;
  --color-text-subtle: #999AAA;
  --glass-border-soft: rgba(0, 0, 0, 0.1);
  --gray-700: rgba(0, 0, 0, 0.15);
  --gray-800: rgba(0, 0, 0, 0.08);
  --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-strong: 0 8px 24px rgba(0, 0, 0, 0.12);
}
```

**Note:** Light theme only affects portal UI (sidebar, directory, profile, settings, overlay panels). The 3D game world keeps its own lighting/colors — those are not theme-dependent.

### 6.5 Future: Accent Color Picker (not for MVP)

Placeholder text: "More appearance options coming soon."

| Property | Value |
|----------|-------|
| Text | `14px`, `var(--color-text-subtle)`, italic |
| Margin-top | `var(--space-6)` (24px) |

---

## 7. Tab: Account

### 7.1 Section Layout

```
+------------------------------------------+
|  ACCOUNT INFO                            |
|                                          |
|  Email       david@example.com           |
|  Tier        T1 · Super Admin    [gold]  |
|  Joined      January 2026                |
|  Position    President                    |
|                                          |
|  ─────────────────────────────           |
|                                          |
|  DANGER ZONE                             |
|                                          |
|  [Sign Out]                              |
|                                          |
+------------------------------------------+
```

### 7.2 Account Info Table

Read-only information displayed as label-value pairs.

| Property | Value |
|----------|-------|
| Layout | 2-column grid: `label` (120px) + `value` (flex 1) |
| Row height | `40px` |
| Label | `14px`, `var(--color-text-subtle)`, weight 400 |
| Value | `14px`, `var(--color-text-main)`, weight 500 |
| Tier value | Color-coded text using tier color + tier label (e.g., "T1 · Super Admin" in `#ffd166`) |
| Row divider | None (clean grid) |

### 7.3 Danger Zone

| Property | Value |
|----------|-------|
| Section label | "Danger Zone", `12px`, uppercase, font-mono, `var(--color-error)` (#ef4444) |
| Margin-top | `var(--space-6)` (24px) |
| Border-top | `1px solid rgba(239, 68, 68, 0.2)` (red-tinted) |
| Padding-top | `var(--space-4)` (16px) |

### 7.4 Sign Out Button

| Property | Value |
|----------|-------|
| Text | "Sign Out" |
| Icon | Lucide `LogOut` (16px), left of text |
| Height | `40px` |
| Padding | `0 var(--space-4)` (0 16px) |
| Background | `transparent` |
| Border | `1px solid var(--color-error)` (#ef4444) |
| Text color | `var(--color-error)` |
| Border-radius | `var(--radius-sm)` (8px) |
| Hover bg | `rgba(239, 68, 68, 0.1)` |
| Action | Clear session, redirect to `/student/login` |

---

## 8. Save Button (per section)

Each editable section (Profile, Social) has its own save button at the bottom.

| Property | Value |
|----------|-------|
| Text | "Save Changes" |
| Width | `auto` (content-sized), right-aligned |
| Height | `40px` |
| Padding | `0 var(--space-5)` (0 20px) |
| Background | `var(--color-brand-blue)` (#002fa7) |
| Color | `var(--color-brand-light)` (#f1ffff) |
| Font | `14px`, weight 600 |
| Border-radius | `var(--radius-sm)` (8px) |
| Hover bg | `#003BD4` (lighter blue) |
| Disabled | `opacity: 0.5`, `cursor: not-allowed` (when no changes made) |
| Loading | Replace text with Lucide `Loader2` spinning icon |
| Success | Briefly show "Saved!" in green for 2 seconds, then revert to "Save Changes" |

### 8.1 Unsaved Changes Warning

| Property | Value |
|----------|-------|
| Trigger | User tries to switch tabs with unsaved changes |
| Behavior | Browser `beforeunload` event + custom inline warning |
| Warning text | "You have unsaved changes. Switch anyway?" with [Discard] [Stay] buttons |
| Warning bg | `rgba(239, 68, 68, 0.1)` |
| Warning border | `1px solid rgba(239, 68, 68, 0.2)` |
| Warning radius | `var(--radius-sm)` |

---

## 9. Loading & Error States

### 9.1 Loading

| Property | Value |
|----------|-------|
| Skeleton | Tab bar + 3 skeleton input fields (shimmer) |
| Animation | Opacity pulse 0.5↔1.0, 1.5s ease |

### 9.2 Save Error

| Property | Value |
|----------|-------|
| Display | Inline error text below save button |
| Text | "Failed to save. Please try again." |
| Color | `var(--color-error)` (#ef4444) |
| Font | `14px` |
| Duration | Visible for 5 seconds, then fades |

---

## 10. Mobile Adaptations (< 768px landscape)

| Property | Desktop | Mobile |
|----------|---------|--------|
| Max-width | `720px` | `100%` |
| Padding | `24px` | `16px` |
| Tab bar | Static row | Horizontal scroll (`overflow-x: auto`) |
| Avatar editor | Two-column (preview + options) | **Stacked** (preview top, options below) |
| Avatar preview | `160px x 240px` | `120px x 180px`, centered |
| Option grid | `4 columns` | `4 columns` (same) |
| Theme cards | Side by side | Side by side (same — fit in landscape) |
| Save button | Right-aligned | Full-width |

---

## 11. Accessibility

| Concern | Implementation |
|---------|---------------|
| Tab navigation | `role="tablist"` on tab bar, `role="tab"` on each tab, `role="tabpanel"` on content |
| Tab ARIA | `aria-selected="true"` on active tab, `aria-controls` linking tab to panel |
| Keyboard | Arrow keys to switch tabs, Tab key to enter panel content |
| Form labels | All inputs have associated `<label>` elements |
| Required fields | Display name is required — show `aria-required="true"` |
| Error messages | `role="alert"` on validation errors |
| Color contrast | Light theme meets WCAG AA (4.5:1 for text on backgrounds) |
