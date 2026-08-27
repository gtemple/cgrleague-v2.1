---
name: CGR League
description: A private F1-style racing league's source of record, built as a printed almanac rather than a dashboard.
colors:
  ink: "#16140f"
  ink-alt: "#211e16"
  ink-alt-2: "#1b1810"
  ink-border: "#2a261d"
  ink-border-2: "#332e25"
  paper: "#ecebe5"
  card: "#ffffff"
  chip: "#e3e1d8"
  border-card: "#d9d6cd"
  border-hairline: "#ece9e1"
  border-hover: "#a8a496"
  row-hover: "#f6f4ee"
  text-primary: "#16140f"
  text-body: "#33312a"
  text-secondary: "#6a685f"
  text-muted: "#7a766b"
  text-muted-2: "#9b988d"
  text-faint: "#b0ada2"
  text-on-dark: "#f7f5ef"
  text-on-dark-muted: "#b3afa4"
  text-on-dark-faint: "#8a8579"
  racing-red: "#e8232c"
  signal-gold: "#f5b21a"
  gold-text: "#241a00"
  accent-blue: "#2a6fdb"
  accent-purple: "#7c5cff"
typography:
  display:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "clamp(36px, 6vw, 54px)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "Saira, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.18em"
rounded:
  chip: "3px"
  card: "5px"
  panel: "6px"
  pill: "999px"
spacing:
  hairline: "2px"
  xs: "6px"
  sm: "9px"
  md: "13px"
  lg: "18px"
  xl: "26px"
components:
  panel:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "16px 18px"
  band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.text-on-dark}"
    padding: "26px"
  chip:
    backgroundColor: "{colors.chip}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.chip}"
    padding: "1px 4px"
  chip-sprint:
    backgroundColor: "{colors.signal-gold}"
    textColor: "{colors.gold-text}"
    rounded: "{rounded.chip}"
    padding: "1px 4px"
  nav:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.text-on-dark-muted}"
    height: "62px"
    padding: "8px 26px"
  nav-link-active:
    textColor: "{colors.text-on-dark}"
---

# Design System: CGR League

## 1. Overview

**Creative North Star: "The Paddock Almanac"**

CGR League is a printed motorsport record book rendered in a browser. Paper stock under ink headers, condensed uppercase titles, figures set in mono. Its authority comes from looking like a published annual of record, something a league would keep on a shelf, not from looking like software. When a driver checks whether they finally passed their rival, the page should feel like consulting the book rather than querying a database.

The system rejects two things by name. It is not **generic dark SaaS**: no blue-accent card grids, no opacity-token dashboard chrome, no glass. It is not the **official F1 website**: no marketing furniture, no brand promotion competing with the numbers. Both anti-references share a failure mode this system refuses, which is treating stats as content to be decorated. Here the stats are the product and the chrome recedes until it disappears.

Density is a virtue. A sparse layout reads as unfinished, so pack information with precision and let hairline rules do the separating that whitespace would do elsewhere. Where a page has personality, it comes from typographic contrast (a 54px condensed headline against an 11px mono eyebrow) rather than from color or ornament.

**Key Characteristics:**
- Paper-and-ink duality: dark bands introduce, light panels inform
- Condensed uppercase display type against wide-tracked mono labels
- Flat at rest, hairline-ruled, no resting shadows
- Real team liveries used as data encoding, never as decoration
- Numbers set in mono and tabular everywhere they are compared

## 2. Colors

A warm, low-chroma document palette: bone paper, near-black ink, and a single racing red that is never used for decoration.

### Primary
- **Racing Red** (`#e8232c`): The league's signature. Reserved for identity and active state only: the 3px rule under the navigation bar, the logo mark, the active nav link underline, focus outlines. It is never a fill for cards, chips, or headings.

### Secondary
- **Signal Gold** (`#f5b21a`): Marks exceptional facts, not routine ones. Sprint chips, best-in-column highlights, the focus glow (`0 0 0 4px rgba(245,178,26,0.18)`). Paired with **Gold Text** (`#241a00`) when used as a fill.

### Tertiary
- **Accent Blue** (`#2a6fdb`) and **Accent Purple** (`#7c5cff`): Categorical only, for article types and taxonomy chips. Never for interactive state.

### Neutral
- **Ink** (`#16140f`): Header bands, navigation, and the primary text color on paper. The same value doing both jobs is deliberate; it is one ink.
- **Ink Alt** (`#211e16`) and **Ink Alt 2** (`#1b1810`): Raised surfaces inside a dark band (tabs, avatar wells, burger hover).
- **Paper** (`#ecebe5`): The page ground. Every content page sits on this, never on white.
- **Card** (`#ffffff`): Panels lifted off the paper. The contrast between paper and card is the primary depth cue in the system.
- **Chip** (`#e3e1d8`): Inert badges and avatar fallbacks.
- **Border Card** (`#d9d6cd`): Panel edges and table header rules. **Border Hairline** (`#ece9e1`): row dividers inside a panel. **Border Hover** (`#a8a496`): the only border state change.
- **Text ramp on paper**: Primary `#16140f`, Body `#33312a`, Secondary `#6a685f`, Muted `#7a766b`, Muted 2 `#9b988d`, Faint `#b0ada2`.
- **Text ramp on ink**: On Dark `#f7f5ef`, Muted `#b3afa4`, Faint `#8a8579`.

### Named Rules

**The One Ink Rule.** There is a single ink (`#16140f`). It is the band background and it is the body text color. Never introduce a second near-black; never reach for pure `#000`.

**The Red Is Not Decoration Rule.** Racing Red marks identity and active state, nothing else. If red appears on a surface that is neither the nav rule, the logo, an active indicator, nor a focus ring, it is wrong.

**The Livery Rule.** Team colors are data encoding, never styling. When two liveries encode two series (a rivalry, a comparison), they must clear both a ΔE floor and a hue gap before use; substitute a contrasting partner hue when they cannot. See `frontend/src/utils/rivalryColors.ts`. Real liveries routinely fail: Red Bull against Racing Bulls sits at ΔE 13, Ferrari against Alfa Romeo at ΔE 11, and Haas silver falls below the chroma floor entirely.

## 3. Typography

**Display Font:** Saira Condensed (fallback `sans-serif`)
**Body Font:** Saira (fallback `sans-serif`)
**Label/Mono Font:** JetBrains Mono (fallback `monospace`)

**Character:** Condensed grotesque headlines against a humanist sans body, with a technical mono carrying every label and figure. The pairing reads as a sports annual: the headline compresses to fit the column, the mono keeps the numbers honest.

### Hierarchy
- **Display** (800, `clamp(36px, 6vw, 54px)`, line-height 0.9, uppercase, `-0.01em`): Page titles inside an ink band. One per page.
- **Headline** (700, 22px, line-height 1, uppercase): Entity names in a band, such as the two drivers on a rivalry page.
- **Title** (600, 17px): Card and panel headings, track names, driver names in lists.
- **Body** (400, 13px to 14px, line-height 1.5): Prose and table cells. Cap running prose at 65 to 75ch; tables may run denser.
- **Label** (400, 10px to 11px, letter-spacing `0.16em` to `0.22em`, uppercase, mono): Section eyebrows, table headers, units, season markers.

### Named Rules

**The Mono Numbers Rule.** Every figure that gets compared against another figure is set in JetBrains Mono with `font-variant-numeric: tabular-nums`. Points, positions, lap counts, records, deltas. A number in the body font is a number nobody is comparing.

**The Eyebrow Rule.** Sections are introduced by an 11px wide-tracked uppercase mono label, never by a large heading. The heading weight belongs to the ink band; inside the paper, sections whisper.

## 4. Elevation

Flat by default. Depth comes from the paper-to-card tonal step and from hairline rules, not from shadows. Panels sit on paper with a 1px `#d9d6cd` border and no resting shadow, which is what keeps the system reading as a printed page rather than a stack of floating widgets.

Shadows exist only as a response to state. There is exactly one ambient shadow in the system and one focus ring.

### Shadow Vocabulary
- **Ambient lift** (`box-shadow: 0 10px 22px rgba(22, 20, 15, 0.09)`): Hover only, on interactive cards, paired with `border-color` shifting to `#a8a496`. Tinted toward the ink hue, never neutral black.
- **Focus ring** (`box-shadow: 0 0 0 4px rgba(245, 178, 26, 0.18)`): Keyboard focus on inputs and controls.

### Named Rules

**The Flat-At-Rest Rule.** No surface carries a shadow at rest. If a card has a resting shadow, delete it and let the border and the paper contrast do the work. Audit test: screenshot the page and squint. If you see soft gray halos under stationary elements, the system has drifted.

## 5. Components

Precise and understated. Tight radii, hairline borders, color reserved for state. The chrome should be invisible until you interact with it.

### Navigation
- **Style:** Sticky ink bar (`#16140f`), 62px min-height, with a 3px `#e8232c` bottom border that acts as the league's signature stripe.
- **Links:** 14px Saira at weight 500, `#b3afa4` default, `#f7f5ef` on hover.
- **Active:** `#f7f5ef` text with a 2px Racing Red bottom border and 3px of padding beneath.
- **Mobile:** Collapses to a burger at 768px; burger hover fills `#211e16`, focus shows a 2px red outline offset 2px.

### Header Bands
- **Style:** Full-bleed `#16140f` block, 26px padding, holding a mono eyebrow above a condensed uppercase display title.
- **Purpose:** Every page opens with one. It states what you are looking at and hands off to the paper below.

### Cards / Panels
- **Corner Style:** Gently squared (5px, `--cgr-radius-card`); panels that hold panels use 6px.
- **Background:** `#ffffff` on a `#ecebe5` page.
- **Border:** 1px `#d9d6cd`. This is the primary edge, not a shadow.
- **Shadow Strategy:** None at rest. See Elevation.
- **Internal Padding:** 16px vertical, 18px horizontal, tightening to 13px on phones.
- **Hover (interactive cards only):** `border-color` to `#a8a496` plus the ambient lift, over 0.15s.

### Chips
- **Style:** 3px radius, 1px 4px padding, 9px to 10px mono uppercase.
- **Inert:** `#e3e1d8` fill with `#7a766b` text, for counts and categories.
- **Signal:** `#f5b21a` fill with `#241a00` text, for exceptional facts (sprint races, records).

### Tables
- **Header:** Mono, 10px, `0.16em` tracking, uppercase, `#9b988d`, with a 1px `#d9d6cd` bottom rule. Sticky when the table scrolls.
- **Rows:** Separated by 1px `#ece9e1` hairlines, never by fills or zebra striping. Hover fills `#f6f4ee`.
- **Cells:** 8px vertical padding. Numeric columns centered and mono; label columns left and body font.
- **Long tables:** Cap the scroll container (around 480px) rather than letting 100+ rows own the page.

### Data Bars
- **Style:** 3px to 4px tall, no radius beyond 2px on the outer ends, with a 2px gap between two adjacent fills.
- **Purpose:** Split bars for two-way comparison, share bars for one-way. Always paired with the literal value in text; the bar is reinforcement, never the only encoding.

## 6. Do's and Don'ts

### Do:
- **Do** build every new page on the `--cgr-*` tokens in `frontend/src/styles/cgr-tokens.css`. Page shell is `--cgr-paper` with `--cgr-text-primary` and `--cgr-font-body`.
- **Do** open each page with an ink band: mono eyebrow, condensed uppercase display title.
- **Do** set every comparable figure in `--cgr-font-mono` with tabular numerals.
- **Do** separate rows with 1px `#ece9e1` hairlines and let density carry credibility.
- **Do** keep surfaces flat at rest and move `border-color` on hover over 0.15s.
- **Do** validate any two-series color pair for both ΔE and hue gap before shipping it, and give every series a text label so identity is never color-alone.
- **Do** respect `prefers-reduced-motion` on anything that animates.

### Don't:
- **Don't** build on the legacy `:root` tokens in `index.css` (`--bg`, `--surface`, `--text-bright`, `--accent`). They predate the redesign and only still apply to unmigrated pages. A new page styled with them renders dark-on-dark against the current light surfaces, which is the single most common way this system gets broken.
- **Don't** produce **generic dark SaaS**: no blue-accent card grids, no opacity-token chrome, no glassmorphism, no floating panels with resting shadows.
- **Don't** imitate the **official F1 website**: no marketing furniture, no brand promotion competing with the data.
- **Don't** use Racing Red as a fill, a heading color, or an accent on anything that is not identity or active state.
- **Don't** use a team livery as decoration. Liveries are data encoding and must pass the legibility gate first.
- **Don't** use `border-left` or `border-right` above 1px as a colored stripe on cards, rows, or callouts.
- **Don't** pad a page out with whitespace to make it feel designed. Sparse reads as unfinished here; add information instead.
- **Don't** put a large heading inside the paper region. Sections are introduced by mono eyebrows; the display weight belongs to the band.
