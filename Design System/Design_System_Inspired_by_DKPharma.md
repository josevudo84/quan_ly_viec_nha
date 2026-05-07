# Design System Inspired by DKPharma

> Derived from **DKPharma Corporate Identity — Version 2022** (brand book, 20th Anniversary edition). The brand book specifies color, typography, and a distinctive graphic motif in detail; all UI component specs, states, spacing, radii, and responsive behavior are inferred from those foundations and marked `(inferred)` throughout.

---

## 1. Visual Theme & Atmosphere

DKPharma's visual identity is built on a single, unwavering claim: **science in service of health, expressed through nature**. The system is anchored by a deep botanical teal (`#007965`) paired with an earthy mustard-gold (`#b6ab3a`) — a palette that rejects the cold clinical blues of conventional pharma in favor of something that looks closer to a herbarium than a hospital. The logotype itself reinforces this: a sprig of leaves crowns the mark, and a dotted half-arc underlines it like a growth ring. Every ancillary surface — stationery, packaging, event backdrops — extends this same silhouette, so that the brand is recognizable even with the wordmark removed.

Typography pairs a high-contrast display serif with a modern geometric sans. Playfair Display carries all headline and display work — its high stroke contrast and refined ball terminals give headings a scholarly elegance that suits a pharmaceutical brand rooted in a university pharmacy school. Inter takes over for all UI and body text, bringing crisp on-screen legibility, well-hinted Vietnamese diacritics, and a quietly contemporary warmth that keeps the interface from reading as dated. Together, the pairing feels like a well-typeset medical journal that happens to live in a browser. Weight is controlled: Playfair Display stays at Regular and Bold; Inter extends to Medium (500) and Semibold (600) for UI specificity, but never reaches Light or Black.

The signature visual move — and the single most important thing to preserve in any digital extension — is the **radial leaf-pattern motif**: an array of small leaf shapes arranged in a concentric fan, always anchored to one corner or edge, always paired with the sweeping curve that separates the green base from the content area above, and always topped by a thin gold accent ribbon. This motif is the brand's compositional heartbeat. Every page of the brand book uses it; every piece of packaging uses it; a website that doesn't use it will not feel like DKPharma.

**Key Characteristics:**
- Botanical teal `#007965` as the dominant color; mustard-gold `#b6ab3a` as the sole accent
- Playfair Display for all headlines and display text; Inter for body and UI
- Radial leaf-pattern motif anchored to corners (the brand's primary decorative device)
- The sweeping "green wave + thin gold ribbon" footer divider, used on virtually every surface
- Serif type treated as a mark of scientific authority, not as decoration
- White or cream as the primary content field — teal is reserved for banners, headers, and framing
- Leaf-and-sprig icon (detached from wordmark) acts as a secondary standalone mark
- Clear-space rule: every logo lock-up keeps a margin ≥ 25% of logo width (x = w/4)
- Pattern areas must be bordered by a white or high-contrast frame of exactly `cornerSize / 20`
- Cultural register is Vietnamese-professional: formal, research-institution-adjacent, not consumer-playful

## 2. Color Palette & Roles

### Primary
- **Xanh DK / DK Green** (`#007965`): The brand's dominant color. Used for full-bleed headers, primary banners, CTA fills, footer strips, and any surface that needs to read as unmistakably DKPharma. Pantone 568M / CMYK 85·0·55·40.
- **Vàng DK / DK Gold** (`#b6ab3a`): The sole accent. Used for the thin dividing ribbon above green footers, for highlight sweeps behind hero imagery, and for gold-foil effects on certificates and invitations. Pantone 618M / CMYK 0·0·80·35. Never used for body text (fails contrast on white).
- **Xám DK / DK Gray** (`#67686b`): The structural neutral. Used for secondary UI chrome, name-tag backplates, and anywhere the teal would overpower. Pantone P179-11C / CMYK 0·0·0·73.

### Interactive
- **CTA Fill** (`#007965`): Primary button background. Uses the main brand green.
- **CTA Fill Hover** (`#00654f`) *(inferred)*: Darken primary ~10% for hover state.
- **CTA Fill Active** (`#00513f`) *(inferred)*: Darken primary ~18% for pressed state.
- **Accent Fill** (`#b6ab3a`): Secondary/highlight button background, used sparingly for promotional moments.
- **Accent Fill Hover** (`#9c922f`) *(inferred)*: Darken gold ~12%.
- **Link (on white)** (`#007965`): Body links match the primary green. Underline on hover.
- **Link (on green)** (`#ffffff`): White links on brand-green surfaces, underline always visible.

### Text
- **Heading on light** (`#1a1a1a`) *(inferred)*: Near-black for Playfair Display headlines on white — softened from pure black for warmth against the botanical palette.
- **Heading on green** (`#ffffff`): Pure white for headlines on the DK Green banners.
- **Body on light** (`#333333`) *(inferred)*: Slightly softer than heading black for running text.
- **Body secondary** (`rgba(26,26,26,0.65)`) *(inferred)*: Captions, metadata, form helper text.
- **Body tertiary / disabled text** (`rgba(26,26,26,0.40)`) *(inferred)*: Placeholders, timestamps, disabled labels.
- **Body on green** (`rgba(255,255,255,0.85)`) *(inferred)*: Supporting copy on teal surfaces.

### Surface & Variants
- **Page Background** (`#ffffff`): The default content field.
- **Warm Cream** (`#faf6e8`) *(inferred)*: A soft, off-white derived from the gold hue, useful for certificate-style panels, testimonial cards, and "science paper" sections.
- **Teal Surface** (`#007965`): Full-bleed brand banners and CTAs.
- **Teal Surface Soft** (`#e6f1ee`) *(inferred)*: A tint of DK Green used for subtle info panels, selected states, and alternating section stripes.
- **Gold Surface Soft** (`#f4f1dc`) *(inferred)*: Tint of DK Gold for highlight callouts.
- **Gray Panel** (`#f5f5f6`) *(inferred)*: Neutral background panels derived from DK Gray at ~4% saturation.

### States (hover, active, disabled)
- **Hover on green surfaces**: brighten teal by ~6% (`#00876f`) *(inferred)*
- **Disabled fill** (`rgba(0,121,101,0.4)`) *(inferred)*: 40% opacity of primary.
- **Error** (`#b3261e`) *(inferred)*: A muted red that reads well alongside the botanical palette — avoid bright primary red.
- **Success** (`#007965`): Reuse the brand green; DKPharma is literally a green-is-good brand.
- **Focus ring** (`#b6ab3a`) *(inferred)*: The gold accent is the single best focus indicator — it contrasts with both white and teal.

### Shadows
- **Subtle Lift** (`0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)`) *(inferred)*: Default card lift.
- **Pronounced Lift** (`0 8px 24px rgba(0,48,40,0.12)`) *(inferred)*: Hover state for cards and modals. The shadow tint is pulled toward teal rather than pure black, so depth stays on-brand.
- **Banner Separation** (`0 2px 0 #b6ab3a`) *(inferred)*: A hard gold line under green banners — echoes the ribbon device from the brand book.

## 3. Typography Rules

### Font Family
- **Display / Headline**: `"Playfair Display", "Lora", Georgia, serif`. Used for all H1–H3 and hero display text. Load from Google Fonts: `Playfair+Display:wght@400;700`.
- **Body / UI**: `"Inter", "Helvetica Neue", system-ui, sans-serif`. Used for paragraphs, buttons, labels, form fields, navigation. Load from Google Fonts: `Inter:wght@400;500;600;700`.
- **Tertiary (legacy stationery)**: `"UTM Aptima", "Inter", sans-serif`. Only reproduce this where fidelity to printed stationery is required.
- **Switching rule**: Playfair Display above 18px for hierarchy; Inter below 18px for legibility. Buttons always use Inter regardless of size.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Hero Display | Playfair Display | 64px (4.00rem) | 400 | 1.10 | -0.5px | Homepage hero only; serif set large and light *(inferred)* |
| H1 | Playfair Display | 48px (3.00rem) | 700 | 1.15 | -0.3px | Page titles *(inferred)* |
| H2 | Playfair Display | 36px (2.25rem) | 700 | 1.20 | -0.2px | Section headings *(inferred)* |
| H3 | Playfair Display | 28px (1.75rem) | 700 | 1.25 | -0.1px | Subsection headings *(inferred)* |
| H4 | Playfair Display | 22px (1.375rem) | 700 | 1.30 | 0px | Card titles, small section titles *(inferred)* |
| Eyebrow / Tag | Inter | 12px (0.75rem) | 600 | 1.40 | 1.5px (uppercase) | "KHOA HỌC VÌ SỨC KHOẺ" style labels |
| Body Large | Inter | 18px (1.125rem) | 400 | 1.55 | 0px | Lead paragraphs *(inferred)* |
| Body | Inter | 16px (1.00rem) | 400 | 1.55 | 0px | Default running text *(inferred)* |
| Body Small | Inter | 14px (0.875rem) | 400 | 1.50 | 0px | Captions, secondary content *(inferred)* |
| Button | Inter | 15px (0.9375rem) | 500 | 1.20 | 0.2px | CTA labels — Medium weight for cleaner button text *(inferred)* |
| Nav Item | Inter | 15px (0.9375rem) | 500 | 1.20 | 0px | Navigation links — Medium weight *(inferred)* |
| Caption | Inter | 12px (0.75rem) | 400 | 1.45 | 0.1px | Image captions, footnotes, legal text |
| Micro | Inter | 10px (0.625rem) | 400 | 1.40 | 0.2px | Reserved for dense address blocks — matches printed stationery |

### Principles

- **Serif for substance, sans for service.** Playfair Display is never used for UI affordances (buttons, form labels, tabs). Inter is never used for primary headlines. The handoff point is 18px — above is editorial, below is interface.
- **Weight is deliberate, not decorative.** Playfair Display uses Regular (400) and Bold (700) only — no intermediate weights. Inter unlocks Medium (500) for button labels and Semibold (600) for nav items / card titles, in addition to Regular (400) and Bold (700). Never use Light or Black in either family.
- **Uppercase is ceremonial.** All-caps is reserved for eyebrow labels, ribbon text, and the tagline "KHOA HỌC VÌ SỨC KHOẺ". Always paired with letter-spacing of at least 1.5px. Never use all-caps for body, buttons, or headlines.
- **Tight heading, open body.** Headlines use negative letter-spacing (`-0.1` to `-0.5px`) to give serif display text a confident, edited feel. Body text uses default spacing and generous 1.55 line-height to respect Vietnamese diacritics (ấ, ộ, ừ) that need vertical room.
- **Bilingual parity.** Vietnamese and English versions of the same content should render at identical sizes and weights; the brand book treats them as equal citizens. Never shrink English translations or set them in italic.

## 4. Component Stylings

### Buttons

**Primary CTA**
- Background: `#007965`
- Text: `#ffffff`, Inter Medium 15px, letter-spacing 0.2px
- Padding: `12px 28px` *(inferred)*
- Radius: `6px` *(inferred — matches the soft, not-too-rounded feel of the brand book's curve device)*
- Border: none
- Hover: background `#00654f`, `box-shadow: 0 4px 12px rgba(0,101,79,0.25)` *(inferred)*
- Active: background `#00513f`, translate-y `1px` *(inferred)*
- Focus: `2px solid #b6ab3a` outline with 2px offset *(inferred)*
- Disabled: background `rgba(0,121,101,0.4)`, cursor not-allowed *(inferred)*
- Use: The single most important action on a page (e.g. "Đặt hàng", "Liên hệ", "Đăng ký")

**Secondary CTA**
- Background: `#ffffff`
- Text: `#007965`, Inter Medium 15px
- Padding: `12px 28px`
- Radius: `6px`
- Border: `2px solid #007965`
- Hover: background `#e6f1ee`, border stays `#007965` *(inferred)*
- Active: background `#d0e3dd`, border `#00513f` *(inferred)*
- Focus: same gold focus ring as primary
- Disabled: border and text at 40% opacity
- Use: Secondary actions alongside a primary ("Tìm hiểu thêm", "Xem chi tiết")

**Ghost / Text Button**
- Background: transparent
- Text: `#007965`, Inter Medium 15px, underline on hover only
- Padding: `8px 12px`
- Radius: `4px`
- Border: none
- Hover: text `#00654f`, underline appears *(inferred)*
- Active: text `#00513f`
- Focus: gold underline `2px`
- Disabled: opacity 0.4
- Use: Inline links in footers, navigation, or card CTAs

**Gold Accent CTA** (sparingly)
- Background: `#b6ab3a`
- Text: `#1a1a1a`, Inter Medium 15px (dark text is required for contrast)
- Padding: `12px 28px`
- Radius: `6px`
- Border: none
- Hover: background `#9c922f` *(inferred)*
- Active: background `#867e28` *(inferred)*
- Focus: `2px solid #007965` outline (green ring for contrast against gold)
- Disabled: 40% opacity
- Use: Seasonal or promotional moments only (e.g. Tết campaigns, anniversary banners). Never for primary navigation CTAs.

### Cards & Containers
- Background: `#ffffff`
- Border: `1px solid rgba(0,0,0,0.06)` *(inferred)*
- Radius: `8px` *(inferred)*
- Shadow: `0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)` (Subtle Lift)
- Padding: `24px` *(inferred)*
- Hover: shadow deepens to `0 8px 24px rgba(0,48,40,0.12)`, `transform: translateY(-2px)` *(inferred)*
- Product cards follow the brand book's packaging layout: image top, teal band at the bottom ~1/3 of the card containing the benefit list (matches the "LỢI ÍCH" blocks on page 54).

### Navigation
- Background: `#ffffff` with `1px solid rgba(0,0,0,0.08)` bottom border *(inferred)*
- Height: `72px` on desktop, `56px` on mobile *(inferred)*
- Logo length: `120px` (desktop), `80px` (mobile) — never below the 30mm print minimum scaled to pixels
- Text: Inter 15px 500, color `#1a1a1a`
- Active: text color `#007965`, `2px solid #007965` underline with 4px offset *(inferred)*
- Hover: text color `#007965`, no underline until active
- Mobile collapse: Full navigation collapses to hamburger icon below 768px; menu opens as a full-height right drawer with teal background and white text.
- Scroll behavior: on downscroll the background gains the gold ribbon divider at the bottom edge to maintain brand signature during scrolled states.

### Inputs & Forms
- Background: `#ffffff`
- Border: `1px solid #67686b` *(inferred — uses DK Gray for neutral affordance)*
- Radius: `6px`
- Padding: `12px 14px`
- Font: Inter 15px 400, text color `#1a1a1a`
- Focus: border `2px solid #007965`, shadow `0 0 0 3px rgba(0,121,101,0.15)` *(inferred)*
- Placeholder: color `rgba(26,26,26,0.4)`
- Error: border `#b3261e`, helper text `#b3261e`, small error icon before text
- Disabled: background `#f5f5f6`, text at 40% opacity

### Distinctive Components

**1. Brand Banner (the signature composition)**
The hero/banner pattern that ties every DKPharma surface together:
- Full-bleed background in `#007965`
- Radial leaf motif (see Section 1) anchored to one corner at ~40% viewport width, rendered in `rgba(255,255,255,0.08)`
- A thin gold curve (`#b6ab3a`, ~4px at peak, tapering) swooping across the lower third of the banner — this is non-negotiable
- Content aligned left, headline in Playfair Display 48px+ white, supporting text Inter 18px at 85% white
- Above the banner, always place a thin `2px` gold divider ribbon matching the top of the curve

**2. Packaging-Style Product Card**
A product-detail card that mirrors the printed product packaging from page 54 of the brand book:
- White upper half with product image
- Lower half in `#007965` with a "LỢI ÍCH" (Benefits) label on the left edge, rotated 90°, in gold
- Benefits list in white Inter 14px, bulleted with small gold dots
- Thin gold curve separating the halves, matching the brand's signature divider

**3. Certificate / Credential Module**
For pages showing accreditations (GMP-WHO, ISO 9001, etc.):
- Warm cream background `#faf6e8`
- Logo/seal centered, Playfair Display 24px title below, Inter 14px body
- Ornamental gold curve with green fill at bottom of module — echoes the certificate designs on pages 46–47 of the brand book

## 5. Layout Principles

### Spacing System
- Base unit: `4px`
- Scale: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128` *(inferred)*
- The brand book applies generous margins in print (15mm+ on A4); translate that habit to web with section padding of `96px` on desktop, `48px` on mobile.

### Grid & Container
- Max content width: `1200px` *(inferred)*, centered
- Gutter: `24px` on desktop, `16px` on mobile
- Primary layout is a 12-column grid; product grids default to 3-up on desktop, 2-up on tablet, 1-up on mobile
- Hero sections are always full-bleed; content inside respects the max-width container

### Whitespace Philosophy
- **Breathing room equals credibility.** DKPharma is a research-pedigreed pharmaceutical brand; crowded layouts read as budget consumer goods. Section padding should feel slightly over-generous by consumer-web standards.
- **Asymmetric anchoring.** The leaf motif is always anchored to a corner (typically bottom-left or top-right), never centered. Compositions should inherit this off-center gravity — hero content left-aligned, decorative motif right-anchored.
- **The green-gold-white triad is a rhythm.** No section should have all three competing. Most sections use white-dominant with a teal accent; a few use teal-dominant with white content; gold appears only as a thin edge or highlight.
- **Vietnamese typography needs air.** Diacritic-heavy headlines require 1.15+ line-height to avoid visual clash between stacked accents.

### Border Radius Scale
- Micro (`4px`): form helper chips, tags, ghost-button radius
- Standard (`6px`): buttons, inputs
- Comfortable (`8px`): cards, images, standard containers
- Large (`16px`): modals, hero content panels, feature callouts
- Pill (`999px`): status pills, notification badges, rare promotional CTAs
- Circle (`50%`): avatars, icon buttons, the leaf-sprig icon when shown standalone

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Level 0) | No shadow, solid background | Page sections, full-bleed banners, navigation at top of page |
| Hairline (Level 0.5) | `1px solid rgba(0,0,0,0.06)` | Cards at rest, input borders, section dividers |
| Subtle Lift (Level 1) | `0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)` | Product cards, content cards, dropdowns |
| Pronounced Lift (Level 2) | `0 8px 24px rgba(0,48,40,0.12)` | Card hover, tooltips, popovers |
| Floating (Level 3) | `0 16px 40px rgba(0,48,40,0.18)` | Modals, bottom sheets, overlays |
| Ribbon (signature) | `0 2px 0 #b6ab3a` below a teal banner | Whenever a green banner ends and content begins below — this is the brand's signature transition |
| Focus | `0 0 0 3px rgba(182,171,58,0.35)` + `2px solid #b6ab3a` | Keyboard focus on interactive elements |

**Shadow Philosophy**: DKPharma uses shadow sparingly — the brand book is overwhelmingly flat, with depth implied through curves and color rather than through drop shadows. On the web, shadows should be tinted toward the brand green (rather than pure black) to keep elevation on-brand, and should increase on hover rather than sitting deep at rest. The one piece of non-optional depth is the **gold ribbon divider** between green surfaces and white content — this is not decorative, it is load-bearing brand equity and must appear wherever teal meets white vertically.

### Decorative Depth
- Gold ribbon divider above every teal-to-white transition (2–4px, can taper as a curve)
- Radial leaf pattern at very low opacity (`rgba(255,255,255,0.08)` on teal, `rgba(0,121,101,0.06)` on white) as ambient background texture
- Never use glassmorphism or backdrop-blur — the brand reads as printed, not as digital glass

## 7. Do's and Don'ts

### Do
- Use `#007965` (DK Green) for every primary CTA, navigation active state, and full-bleed banner.
- Pair every teal banner with a thin gold ribbon (`#b6ab3a`, 2–4px) at its lower edge.
- Set all headlines in Playfair Display — 700 for H1–H4, 400 acceptable for hero display sizes only.
- Set all UI text (buttons, labels, body copy) in Inter — Regular (400) for body, Medium (500) for buttons, Semibold (600) for nav and card titles, Bold (700) for emphasis.
- Anchor the radial leaf motif to a corner at low opacity on hero sections and brand-heavy pages.
- Give headlines negative letter-spacing (-0.1 to -0.5px) to preserve the edited feel of the print brand book.
- Reserve gold (`#b6ab3a`) for focus rings, accent highlights, and ribbon dividers — never use it for primary fills except in rare promotional moments.
- Use white (`#ffffff`) as the default page background; let teal appear in bounded zones, not as the field.
- Maintain the clear-space rule around the logo: margin ≥ 25% of logo width on every surface.
- Use bilingual labels (Vietnamese + English) at identical visual weight where the audience is mixed.

### Don't
- Don't introduce a third accent color — the chromatic budget is spent on teal and gold. Teal, gold, and neutral grays only.
- Don't use pure black (`#000000`) anywhere — the brand softens to `#1a1a1a` for warmth against the botanical palette.
- Don't set body copy in Playfair Display — serif below 18px fatigues readers and fights with Vietnamese diacritics.
- Don't use Light, Thin, or Black font weights in either family — Playfair Display uses 400/700 only; Inter uses 400/500/600/700.
- Don't apply glassmorphism, backdrop-blur, or neumorphism — the brand reads as printed paper, not as digital glass.
- Don't stretch or skew the radial leaf motif or embed it over photography — the brand book explicitly prohibits motif distortion.
- Don't use saturated primary red for errors — use the muted `#b3261e` that coexists with the botanical palette.
- Don't use the logo below 30px tall (scaled from the 30mm print minimum); use the leaf-sprig icon alone if space is tight.

## 8. Responsive Behavior

### Breakpoints *(inferred)*

| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | 0–639px | Single-column stacking, hamburger nav, hero headline drops to 36px, section padding reduces to 48px |
| Tablet | 640–1023px | 2-column grids, navigation remains hamburger until 1024px, hero 44px |
| Desktop | 1024–1439px | Full navigation bar, 12-col grid engaged, hero 48–56px |
| Large Desktop | 1440px+ | Max content width caps at 1200px (centered), hero scales up to 64px |

### Touch Targets
- Minimum interactive area: `44px × 44px` on mobile and tablet.
- Buttons retain 12px vertical padding minimum on mobile to meet the 44px target with 15px text.
- Icon-only buttons: `40px × 40px` minimum hit area even when visual icon is smaller.
- Form inputs: 48px minimum height on mobile for comfortable tap.

### Collapsing Strategy
- Hero headlines scale down by roughly one tier per breakpoint (64 → 48 → 36).
- Product grids collapse from 3-up (desktop) to 2-up (tablet) to 1-up (mobile).
- Navigation collapses at 1024px into a right-drawer menu with teal background and white Inter 18px items.
- The **gold ribbon divider** never disappears at any breakpoint — it thins from 4px to 2px but must remain visible. This is sacred.
- The radial leaf motif scales proportionally to its container corner but never drops below 120px diameter.

### Image Behavior
- Product photography is always on white or cream backgrounds, never on teal (matches the brand book's product-shot treatment).
- Hero imagery crops to 16:9 on desktop, 4:3 on tablet, 1:1 on mobile.
- Decorative motifs (leaf pattern) are SVG and scale without pixelation; never rasterize.

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary CTA: `#007965`
- Accent / Focus: `#b6ab3a`
- Page background (light): `#ffffff`
- Page background (warm): `#faf6e8`
- Teal banner background: `#007965`
- Heading text (on light): `#1a1a1a`
- Heading text (on teal): `#ffffff`
- Body text: `#333333`
- Body text (on teal): `rgba(255,255,255,0.85)`
- Link (on light bg): `#007965`
- Border / divider: `rgba(0,0,0,0.06)`
- Focus ring: `#b6ab3a` with `rgba(182,171,58,0.35)` halo
- Card shadow: `0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)`
- Ribbon divider: `#b6ab3a`, 2–4px solid

### Example Component Prompts

**Hero Banner**
> Build a full-bleed hero banner. Background `#007965`. Render a radial leaf pattern (concentric fan of small oval leaves) in `rgba(255,255,255,0.08)` anchored to the bottom-right corner at 480px diameter. At the lower edge of the banner, add a sweeping gold curve (`#b6ab3a`) 4px thick that tapers from left to right, then a 2px solid gold ribbon divider directly below where the banner meets the next section. Content aligned left inside a 1200px container: eyebrow label "KHOA HỌC VÌ SỨC KHOẺ" in Inter 12px semibold (600) uppercase, letter-spacing 1.5px, color `#b6ab3a`. Headline in Playfair Display 64px weight 400, color `#ffffff`, line-height 1.1, letter-spacing -0.5px. Supporting text in Inter 18px regular, color `rgba(255,255,255,0.85)`, max-width 560px. Primary CTA with background `#ffffff`, text `#007965`, padding 12px 28px, radius 6px, Inter medium (500) 15px. Vertical padding 96px top and bottom.

**Product Card**
> Build a product card, 320px wide, white background, radius 8px, border `1px solid rgba(0,0,0,0.06)`, shadow `0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)`. Top 60% of card: product image on white, 24px padding. Bottom 40%: background `#007965`, padding 20px 24px, with a thin gold curve (`#b6ab3a`, 3px) separating top and bottom sections. Inside the teal area, a rotated (90°) "LỢI ÍCH" label on the left edge in Inter 11px semibold (600) uppercase color `#b6ab3a`, letter-spacing 1.5px. To the right of the label, a bulleted list of 3 benefits in Inter 14px regular color `#ffffff` with small `#b6ab3a` dot bullets. On hover, shadow deepens to `0 8px 24px rgba(0,48,40,0.12)` and card translates up 2px. Product title above the teal area in Playfair Display 22px bold, color `#1a1a1a`.

**Navigation Bar**
> Build a sticky top navigation bar, 72px tall, background `#ffffff`, bottom border `1px solid rgba(0,0,0,0.08)`. Logo on the left, 120px wide (use the DKPharma mark with wordmark). Nav items on the right in Inter 15px medium (500), color `#1a1a1a`, spaced 32px apart. On hover, item color turns `#007965`. Active item has color `#007965` and a 2px solid `#007965` underline offset 4px below the text. Primary CTA on the far right: background `#007965`, text `#ffffff`, padding 10px 20px, radius 6px, Inter medium (500) 15px. Below 1024px, collapse into a hamburger icon; opening it reveals a right-drawer with background `#007965`, items in Inter 18px regular color `#ffffff`, each with a 2px gold underline on active. Clear space around the logo: minimum 24px on all sides.

**Feature Section (Alternating)**
> Build an alternating feature section inside a 1200px centered container. Left column: 16:9 image with radius 8px. Right column: eyebrow label in Inter 12px semibold (600) uppercase `#b6ab3a` letter-spacing 1.5px; H2 in Playfair Display 36px bold, color `#1a1a1a`, line-height 1.2, letter-spacing -0.2px, max-width 480px; body paragraph in Inter 16px regular color `#333333` line-height 1.55; ghost button "Tìm hiểu thêm →" with text `#007965` Inter medium (500) 15px, underline on hover. Section vertical padding 96px top and bottom. Alternate image and text columns on every even instance. Between alternating sections, insert a subtle warm-cream band (`#faf6e8`, 1 section tall) to create rhythm.

**Certificate / Accreditation Callout**
> Build an accreditation strip. Background `#faf6e8` (warm cream). Padding 48px vertical. Centered H3 in Playfair Display 28px bold color `#1a1a1a` reading "Tiêu chuẩn chất lượng". Below, a horizontal row of 6 logo badges (GMP-WHO, GMP-HS, GLP, GSP, GACP-WHO, ISO 9001:2015) each 80×80px in circular white plates with radius 50% and shadow `0 1px 2px rgba(0,0,0,0.06)`. At the bottom of the strip, the brand's signature gold-curve-with-teal-fill ornament mirroring the certificate designs: a sweeping arc in `#b6ab3a` 3px with a soft teal `#007965` fill underneath, 80px tall max.

### Iteration Guide

1. **The teal `#007965` and gold `#b6ab3a` are inseparable.** Never use teal without a gold accent somewhere on the same surface. Never use gold without teal anchoring the composition.
2. **Every teal-to-white transition must include a gold ribbon divider.** This is the single most recognizable compositional move in the brand. Do not omit it.
3. **Serif for headlines, sans for UI.** Playfair Display for anything above 18px that conveys voice; Inter for anything that conveys function. Never invert this.
4. **Playfair Display: two weights (400, 700). Inter: four weights (400, 500, 600, 700).** Do not introduce Light, Thin, or Black in either family.
5. **Preserve the radial leaf motif on at least one surface per page.** Anchor it to a corner, keep it low-opacity, never stretch or crop it tightly.
6. **Negative letter-spacing on display text, default spacing on body.** Headlines feel edited; body feels read.
7. **Prefer white as the page field, teal as a bounded zone.** Teal dominance should be reserved for hero banners, CTAs, and brand moments — never as the default page background.
8. **Shadows stay subtle and tint toward teal.** Use `rgba(0,48,40,*)` rather than pure black for shadow colors on elevated elements.
9. **Vietnamese diacritics need line-height ≥ 1.15 on headlines.** Never set Vietnamese display text with line-height 1.0.
10. **Flat before fancy.** When in doubt, remove the shadow, remove the gradient, remove the blur. The brand reads as a well-printed book, not as a 2025 SaaS landing page.
