# Tethos Website Redesign Changelog
## Session: April 13, 2026

### Infrastructure
- **Test Sohne font fix**: Fixed font-family typo ("Test Sogne" -> "Test Sohne") across all files. Fixed incorrect bold weight filename in @font-face. Added semibold (600) weight.
- **ASCII removal**: Removed all AsciiDivider and AsciiReveal usages from NPO, Company, and Student pages. Components kept in codebase for potential future use but no longer rendered on any page.
- **Custom cursor refinement**: Reduced corner bracket size from 9px to 7px, lowered z-index from 9999 to 9990, added 85% opacity for subtlety.

### New Components
- **PixelLogoCarousel** (`components/ui/PixelLogoCarousel.tsx`): Canvas-based logo carousel where logos dissolve into pixel blocks and reassemble as the next logo. Configurable pixel size, interval, transition duration, and dimensions. Uses offscreen canvas to sample text, then animates a grid of cells with per-cell stagger based on distance from center.

### Homepage (/)
- **SponsorStrip**: Replaced placeholder "Partner 1-8" text with real organization names (World Vision, Red Cross, Plan International, Childcan, IRC, Children's Museum, Plan Catalyst, Morrissette). Integrated PixelLogoCarousel for visual wow-factor. Added partner count subtitle.
- **TextRevealSection**: Tightened scroll pin from 160% to 120% to reduce dead space.

### NPO Page (/npo)
- **Testimonials**: Expanded from 2 to 4 quotes with real-sounding content. Made it a light section (#F5FAFF) for warmth contrast. Added white card containers with quote mark accents and footer separators. Added Canadian Red Cross and Childcan testimonials.
- **NPOCTA**: Fixed button elements to proper `<a>` tags with working hrefs. Added hover glow effect on primary CTA.
- **ASCII removal**: Removed AsciiDivider from NPOTimeline and NPOCTA sections.

### Company Page (/company)
- **WorkSection**: Built from empty stub into full project showcase with 4 case study cards (Donor Nexus, HeartFit, Harvest Hub, Grant Glass). Each card shows client, type, description, tech stack tags, and impact metric badge.
- **FAQSection**: Built from empty stub into full accordion FAQ with 7 real Q&A pairs about Tethos services, timeline, tech stack, talent access, and support. Animated expand/collapse with Framer Motion.
- **GetStartedSection**: ASCII divider removed.

### Sponsor Page (/sponsor)
- **Placeholder sponsors**: Replaced "Placeholder Sponsor" entries with Ivey Business School and Western Engineering.
- **Event gallery**: Removed empty placeholder gallery section (6 blank cards showing "Event Photo 1-6").

### Student Landing (/student)
- **Hero**: Replaced ASCII background texture with subtle radial blue glow.
- **CTAs**: Fixed all button elements to proper `<a>` tags linking to /student/apply, /student/login, and mailto:team@tethos.ca.

### Recruitment System (/student/apply/*)
- **Apply hub page**: Complete redesign with hero, horizontal scroll-driven timeline, phase filter tabs with AnimatePresence transitions, improved position cards with mouse-tracking glow and spring hover effects.
- **Position cards**: Redesigned with blue top accent line, animated green "Open" badge with pulse dot, Apply pill button with spring arrow animation, per-card mouse-following glow overlay.
- **Application form page**: Redesigned auth gate with proper position context (Phase badge, Open status, deadline). Lock icon, contextual copy ("for VP Internal"), animated divider line.
- **Dashboard**: Redesigned auth gate with proper sizing, lock icon, back link. Empty state with inbox icon and "Browse Positions" CTA.
- **Internal gate**: Complete redesign with gold lock icon, monospace ACCESS CODE input with focus ring, gold "Unlock Positions" button, back link with hover animation.
- **AuthModal**: Replaced glass-card with custom rounded-2xl card with backdrop-blur for cleaner look.
- **Positions opened for testing**: Updated Supabase positions table to set Phase 1 opens_at to April 1, 2026 (was May 1).

### Login/Signup
- **Navbar overlap fix**: Added pt-20 to both login and signup pages to push content below the glass navbar.

### Dev Tools
- **Component Playground** (`/dev/playground`): Local-only test page with tabbed sections for Typography, Colors, Buttons, Cards, Pixel Carousel, and Spacing. Confirms font loading and design token accuracy.

### Deployment
- Merged recruitment-system branch to main (PR #11)
- Added all server-side env vars to Vercel (Supabase service key, Google Drive, Resend, admin whitelist)
- Fixed OOM build crash: Added NODE_OPTIONS='--max-old-space-size=8192' to build script

### Design Decisions
- **No ASCII on marketing pages**: ASCII elements clashed with glass morphism. Removed dividers and background textures. Login/signup terminal aesthetic preserved.
- **Light sections**: Added light (#F5FAFF) testimonial section on NPO page for trust/warmth.
- **Card styles by audience**: Students get interactive glass cards with hover effects. Companies get solid surface cards (#1A1A1C). Sponsors get minimal text-heavy cards.
- **Motion budget**: Marketing pages use scroll-triggered reveals (GSAP ScrollTrigger). Recruitment pages use Framer Motion for entrance/exit animations.
- **Button hierarchy**: Primary = bg-[#002FA7] rounded-full. Secondary = border border-white/10. Accent = border-[#FFD166]/20 text-[#FFD166].
