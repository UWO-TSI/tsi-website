# UX Spec — Job Board

> **Owner:** UXUI · **Status:** Implementation-ready · **Date:** 2026-03-29
> **Frontend reads this to build:** `web/app/student/dashboard/jobs/page.tsx`, `web/components/portal/JobCard.tsx`

---

## 1. Overview

The Job Board is a **full-page** curated + member-submitted job listing board. Members browse internships, full-time roles, and freelance opportunities. Includes search, filters, and a submission form for members to post opportunities they find.

**Route:** `/student/dashboard/jobs`
**Entry:** Sidebar nav "Job Board" OR interacting with Job Board object in game world (fade-to-black → navigates to page)

---

## 2. Page Layout

```
+--[Jobs Page]------------------------------------+
| Job Board                     [+ Submit a Job]  |
+-------------------------------------------------+
| [Search jobs...]                                |
+-------------------------------------------------+
| [All] [Internship] [Full-Time] [Freelance]     |
+-------------------------------------------------+
| +---------------------------------------------+ |
| | Google — Software Engineering Intern         | |
| | Remote | Posted 3 days ago                   | |
| | "Build scalable distributed systems..."      | |
| | [Apply] [Save]                               | |
| +---------------------------------------------+ |
| +---------------------------------------------+ |
| | Stripe — Frontend Developer                  | |
| | New York, NY | Posted 1 week ago             | |
| | "Join our payments team to build..."         | |
| | [Apply] [Save]                               | |
| +---------------------------------------------+ |
+-------------------------------------------------+
```

### 2.1 Page Container

| Property | Value |
|----------|-------|
| Padding | `var(--space-6)` (24px) |
| Max-width | `960px` |
| Margin | `0 auto` |

### 2.2 Page Header

| Element | Style |
|---------|-------|
| Title | "Job Board", `var(--font-size-h3)` (30px), `var(--color-text-main)`, weight 700 |
| Submit button | Ghost button, right-aligned: "+ Submit a Job" |

---

## 3. Search Bar

| Property | Value |
|----------|-------|
| Style | Same as directory search (see `ux-directory.md` Section 3.2) |
| Placeholder | "Search by company, role, or keyword..." |
| Margin-bottom | `var(--space-4)` (16px) |

---

## 4. Filter Tabs

```
[All] [Internship] [Full-Time] [Freelance] [Part-Time]
```

| Property | Value |
|----------|-------|
| Style | Same pill tabs as Shop/Bounty |
| Default | "All" active |
| Margin-bottom | `var(--space-6)` (24px) |

---

## 5. Job Listing Card

```
+---------------------------------------------------+
| Google                                             |
| Software Engineering Intern                        |
| Remote | Internship | Posted 3 days ago           |
|                                                   |
| "Build scalable distributed systems for Google    |
|  Cloud Platform. Work with a team of..."          |
|                                                   |
| [Apply]  [Save]                                   |
+---------------------------------------------------+
```

### 5.1 Card Container

| Property | Value |
|----------|-------|
| Background | `var(--color-surface)` (#111827) |
| Border | `1px solid rgba(255, 255, 255, 0.06)` |
| Border-radius | `var(--radius-md)` (16px) |
| Padding | `var(--space-6)` (24px) |
| Margin-bottom | `var(--space-4)` (16px) |
| Hover border | `rgba(0, 47, 167, 0.2)` |
| Transition | `border-color 0.2s` |

### 5.2 Card Elements

#### Company Name

| Property | Value |
|----------|-------|
| Font | `var(--font-size-body-sm)` (14px), weight 500, `var(--color-text-muted)` |
| Uppercase | Optional — depends on branding preference |

#### Role Title

| Property | Value |
|----------|-------|
| Font | `var(--font-size-body-lg)` (18px), weight 700, `var(--color-text-main)` |
| Margin-top | `var(--space-1)` (4px) |

#### Meta Row

| Property | Value |
|----------|-------|
| Layout | `flex`, `gap: var(--space-3)` (12px), `flex-wrap: wrap` |
| Items | Location, Type badge, Posted date |
| Font | `var(--font-size-body-sm)` (14px), `var(--color-text-muted)` |
| Separator | `·` character between items |
| Type badge | Pill style, color-coded (see below) |

**Type badge colors:**

| Type | Background | Text |
|------|-----------|------|
| Internship | `rgba(34, 211, 238, 0.15)` | `var(--color-accent-cyan)` |
| Full-Time | `rgba(0, 47, 167, 0.15)` | `#4A7AFF` |
| Freelance | `rgba(255, 209, 102, 0.15)` | `var(--color-brand-yellow)` |
| Part-Time | `rgba(34, 197, 94, 0.15)` | `var(--color-success)` |

#### Description

| Property | Value |
|----------|-------|
| Font | `var(--font-size-body)` (16px), `var(--color-text-soft)` |
| Lines | Max 2, `text-overflow: ellipsis`, `-webkit-line-clamp: 2` |
| Margin-top | `var(--space-3)` (12px) |

#### Action Buttons

| Property | Value |
|----------|-------|
| Layout | `flex`, `gap: var(--space-3)` (12px), `margin-top: var(--space-4)` |
| "Apply" | Primary button, opens external link in new tab |
| "Save" | Ghost button with Lucide `Bookmark` icon |
| "Save" active | Filled `Bookmark` icon, `var(--color-brand-yellow)` |

---

## 6. Job Detail View

Clicking the card (not the Apply button) expands it or navigates to a detail view.

| Section | Content |
|---------|---------|
| Full description | Untruncated job description |
| Requirements | Bulleted list of qualifications |
| Compensation | Salary/hourly range if provided |
| How to apply | Link or instructions |
| Posted by | Member who submitted (if member-submitted) + date |
| Source | "Curated by Tethos" or "Submitted by {member name}" |

---

## 7. Job Submission Form

Members can submit job opportunities they find. Accessible via "+ Submit a Job" button.

```
+--[Submit a Job]----------------------------+
| Company Name    [________________]         |
| Role Title      [________________]         |
| Type            [Internship v]             |
| Location        [________________]         |
| Application URL [________________]         |
| Description     [________________]         |
|                 [________________]         |
|                 [________________]         |
|                                            |
| [Cancel]              [Submit for Review]  |
+--------------------------------------------+
```

| Property | Value |
|----------|-------|
| Container | Modal overlay, `max-width: 560px` |
| Background | `var(--color-bg-navy)` (#0d1b2a) |
| Border | `1px solid rgba(0, 47, 167, 0.3)` |
| Border-radius | `var(--radius-md)` (16px) |
| Padding | `var(--space-6)` (24px) |

### Form Fields

| Field | Type | Required |
|-------|------|----------|
| Company Name | Text input | Yes |
| Role Title | Text input | Yes |
| Type | Dropdown (Internship, Full-Time, Freelance, Part-Time) | Yes |
| Location | Text input (free text: "Remote", "NYC", etc.) | Yes |
| Application URL | URL input | Yes |
| Description | Textarea, `min-height: 100px` | No |

### Form Input Style

| Property | Value |
|----------|-------|
| Height | `40px` (text inputs), auto (textarea) |
| Background | `var(--color-surface)` (#111827) |
| Border | `1px solid var(--glass-border-soft)` |
| Border-radius | `var(--radius-sm)` (8px) |
| Text | `var(--font-size-body-sm)` (14px), `var(--color-text-main)` |
| Placeholder | `var(--color-text-subtle)` |
| Focus | `border-color: var(--color-brand-blue)`, `box-shadow: 0 0 0 2px rgba(0, 47, 167, 0.2)` |
| Label | `var(--font-size-body-sm)` (14px), `var(--color-text-muted)`, `margin-bottom: var(--space-1)` |
| Field gap | `var(--space-4)` (16px) between fields |

### Submission Review

Submitted jobs go to T1-T3 admin review before appearing publicly. Submitter sees "Pending Review" status on their submission.

---

## 8. Empty & Loading States

### Loading

| Property | Value |
|----------|-------|
| Skeleton cards | 4 placeholder cards |
| Animation | Shimmer pulse |

### Empty

| Property | Value |
|----------|-------|
| Icon | Lucide `Briefcase` (32px), `var(--color-text-subtle)` |
| Text | "No jobs posted yet. Check back soon or submit one!" |

### No search results

| Property | Value |
|----------|-------|
| Icon | Lucide `SearchX` (32px) |
| Text | "No jobs match your search. Try different keywords." |
