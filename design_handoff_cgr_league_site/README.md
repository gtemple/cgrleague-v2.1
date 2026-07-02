# Handoff: CGR League Site Redesign

## Overview
CGR League is a sim-racing (F1-style) league website: a 14-page site covering the current season, historical seasons, drivers (3 humans racing against an AI grid), teams, tracks, records, and editorial coverage (race recaps, previews, power rankings, season reviews). This bundle contains the complete high-fidelity design for the site, including a recent refresh pass (responsive layout, hover states, compact archive on the Articles page, live status ticker).

## About the Design Files
The files in `design_files/` are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. Your task is to **recreate these designs in the target codebase's existing environment** (React, Vue, Next.js, etc.) using its established patterns, routing, and component libraries. If no codebase exists yet, choose an appropriate framework (a React/Next.js app with file-based routing maps naturally onto these pages) and implement the designs there.

Each `.dc.html` file opens directly in a browser (they share `support.js`, a small template runtime — ignore it for implementation purposes). Inside each file:
- The markup between `<x-dc>` and `</x-dc>` is the page template. All styling is **inline styles**; `{{ name }}` placeholders are data holes; `<sc-for>`/`<sc-if>` are loop/conditional constructs; `style-hover="…"` attributes define `:hover` styles.
- The `<script data-dc-script>` block at the bottom holds the page's data (articles, standings, results) and view logic — treat it as the data model + derived-state spec.

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy, and interactions are final. Recreate pixel-perfectly using the codebase's conventions. All data currently hardcoded in the script blocks should come from your real data source; the hardcoded values define the expected shape.

## Design Tokens

### Colors
- Ink (nav, dark panels, primary text): `#16140f`; dark panel alt `#211e16`, `#1b1810`; dark borders `#2a261d`, `#332e25`
- Paper background: `#ecebe5`; card background `#fff`; ticker/archive-chip background `#e3e1d8`
- Borders: card `#d9d6cd`, section rule `#d9d6cd`, inner hairline `#ece9e1` / `#f0ede5` / `#f4f1e9`, ticker `#d3d0c5`, chip `#e2dfd6`
- Text: primary `#16140f`, body `#33312a`, secondary `#6a685f`, muted `#7a766b` / `#9b988d`, faint `#b0ada2`; on dark: light `#f7f5ef`, muted `#b3afa4`, faint `#8a8579`
- Accent red (primary): `#e8232c` — nav underline/border-bottom, active tab, CTAs, "READ →" links
- Accent gold: `#f5b21a` (text on gold: `#241a00`) — power rankings tag, LIVE PAGE badge
- Accent blue: `#2a6fdb` — race preview tag; Accent purple: `#7c5cff` — season preview/review tags
- Hover: card border `#a8a496`; row highlight `#f6f4ee`; nav link text `#f7f5ef`

### Typography (Google Fonts)
- **Saira Condensed** (500–800): display/headlines. Page titles 54px/800/uppercase (clamp(36px,6vw,54px)); Home hero 80px (clamp(46px,7vw,80px)), line-height 0.88–0.9; card titles 19px/700; section headers 24px/700 uppercase; archive row titles 17px/700
- **Saira** (400–700): UI text and body. Nav links 14px/500; body copy 16px/1.7; card excerpts 13px/1.45
- **JetBrains Mono** (400–700): all metadata, labels, numbers, tickers. Section labels 11px with 0.18em letter-spacing; card meta 10px; tags 9px/700 with 0.1em letter-spacing

### Other
- Border radius: 3px (tags/chips), 4–5px (cards, buttons), 6px (panels)
- Card hover: `border-color:#a8a496; transform:translateY(-2px); box-shadow:0 10px 22px rgba(22,20,15,0.09)`, transition 0.15s (border-color, transform, box-shadow)
- Content max-widths: 1320px (Articles), 1440px (Home); page padding 26px horizontal
- Global resets: `* { box-sizing:border-box; margin:0; padding:0 }`, `a { color:inherit; text-decoration:none }`, body background `#ecebe5`

## Shared Chrome (all pages)
- **Nav bar**: sticky, `#16140f`, 3px red bottom border, min-height 62px, `flex-wrap:wrap`. Left: red 32px "CGR" logo square + "CGR LEAGUE" wordmark. Center: links Seasons / Drivers / Teams / Tracks / Hall of Fame / Articles (14px Saira 500, `#b3afa4`, hover → `#f7f5ef`); active page rendered as white text with 2px red border-bottom (padding-bottom 3px). Right: decorative "⌕ SEARCH ⌘K" pill (11px mono, 1px `rgba(255,255,255,0.18)` border).
- **Status ticker** (Home + Articles): `#e3e1d8` strip, 11px JetBrains Mono, items separated by 1px×14px `#cbc7bb` dividers: "● SEASON 7" (red) · ROUND 06 / 22 · LEADER C. REYNOLDS 90 · MARGIN +17; right-aligned link. On Articles the right link is "LAST RACE R5 SPANISH GP · READ RECAP →" → recap article, hover → red.

## Screens / Views
(Reference each file for exact layout and copy — the list below is the map.)

- **CGR Home** — hero row (flex-wrap: dark next-race hero panel `flex:3 1 480px`, 392px tall, striped texture + gradient, "NEXT RACE" badge, giant race title; countdown card `flex:1 1 300px` with 4-cell DAYS/HRS/MIN/SEC grid, session schedule list, red "RACE CENTRE →" button). Below: 3 human-driver cards; driver + constructor standings tables side by side (`auto-fit minmax(360px,1fr)`); dark "FLASHBACK" podium strip; dark "ROLL OF HONOUR" champions strip; 3 latest-coverage article cards.
- **CGR Seasons** — season picker; results grid table (Position/Points/Heat Map toggle) with a 320px right rail (flex: main `999 1 480px`, rail `1 1 300px`); season stat panels (`auto-fit minmax(280px,1fr)`).
- **CGR Drivers / CGR Driver** — roster grids (human cards `auto-fit minmax(280px,1fr)`); driver detail: dark header with 10-cell stat row (`auto-fit minmax(92px,1fr)`), DNA bars, track specialization panels, track record grid (`auto-fill minmax(150px,1fr)`).
- **CGR Teams / CGR Team** — all-time record cards, searchable team grid (`auto-fill minmax(240px,1fr)`); team detail with dark 8-cell stat row.
- **CGR Tracks / CGR Track** — record cards, searchable track grid (`auto-fill minmax(210px,1fr)`); track detail with dark 5-cell stat row.
- **CGR Hall of Fame** — career-points podium; leader cards (`auto-fit minmax(240px,1fr)`); single-season records; career awards.
- **CGR Articles** — index page. Dark header band with title + filter tabs (All / Race / Season / Rankings; active tab red pill). Status ticker. Season 7 and Season 6 as card grids (`auto-fill minmax(300px,1fr)`): each card = 140px striped image placeholder + colored type tag (+ gold "LIVE PAGE →" badge if a live article exists), meta line, title, excerpt, footer (date · read time | "READ →" red or "COMING SOON" gray). Seasons 1–5 collapse into a compact **Archive** list: white container, rows = season chip + 122px-wide type tag + title + date·read + CTA, `flex-wrap`, hover background `#f6f4ee`.
- **CGR Article Preview / Recap / Rankings / Season** — article layouts: headline block, body copy 16px/1.7 with a 320px right rail (flex: body `999 1 400px`, rail `1 1 280px`); Rankings uses a 2-col ranked-driver card grid (`auto-fit minmax(340px,1fr)`).

## Interactions & Behavior
- **Navigation**: nav links route between pages; article cards with a live page navigate to it (pointer cursor); "COMING SOON" cards are inert (default cursor).
- **Articles filter tabs**: client-side filter by category (all/race/season/rankings); applies to both card groups and the archive list; season groups with zero matches are hidden; archive section hidden when empty.
- **Search inputs** (Teams, Tracks): live substring filter of the grid.
- **Seasons results grid**: display-mode toggle (Position / Points / Heat Map) re-renders the table cells.
- **Hover states**: cards lift (see token above); archive + table rows tint `#f6f4ee`; nav links brighten; text links → red. All transitions 0.15s.
- **Nav search pill** is currently decorative — implement ⌘K search or omit.

## Responsive Behavior
Desktop-first, degrades to narrow via wrapping (no media queries in the prototypes — preserve the mechanics or translate to breakpoints):
- Card grids: `repeat(auto-fill|auto-fit, minmax(Npx, 1fr))` per the values above
- Two-column layouts (hero + sidebar, content + rail): flex with `flex-wrap`; main `flex:999 1 <basis>`, rail `flex:1 1 ~300px` so the rail drops below on narrow screens
- Nav and ticker: `flex-wrap:wrap`
- Page titles use `clamp()` sizes

## State Management
- Articles page: `filter` (string). Seasons: selected season + results display mode. Teams/Tracks: search query. Home countdown: derived from race start datetime (ticking).
- Data entities: Season, Round/Race, Driver (human vs AI flag, nationality, team, form), Team, Track, Article (type: recap | preview | rankings | season-preview | season-review; season; round; date; read time; live/href). Hardcoded arrays in each file's script block define the shapes.

## Assets
No image assets. All imagery is intentionally placeholder: `repeating-linear-gradient` diagonal stripes (e.g. `repeating-linear-gradient(118deg,#dedbd1 0 2px,#e9e6dd 2px 11px)` on light, `#211e16/#16140f` on dark) marking where real photography/circuit art should go. Fonts load from Google Fonts.

## Files
All in `design_files/` (open any file directly in a browser; keep `support.js` alongside them):
- `CGR Home.dc.html` — landing page
- `CGR Seasons.dc.html` — season explorer
- `CGR Drivers.dc.html`, `CGR Driver.dc.html` — roster + driver detail
- `CGR Teams.dc.html`, `CGR Team.dc.html` — teams + team detail
- `CGR Tracks.dc.html`, `CGR Track.dc.html` — tracks + track detail
- `CGR Hall of Fame.dc.html` — records
- `CGR Articles.dc.html` — article index (filter tabs, ticker, archive)
- `CGR Article Preview.dc.html`, `CGR Article Recap.dc.html`, `CGR Article Rankings.dc.html`, `CGR Article Season.dc.html` — article templates
- `support.js` — prototype runtime (reference only, do not port)
