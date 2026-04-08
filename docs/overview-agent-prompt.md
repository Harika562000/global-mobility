# Overview Component — Agent Context Prompt

Use this document to brief an AI agent on the current state of the Overview component in this AEM Edge Delivery Services project. Share the full contents of this file as context before asking the agent to work on this feature.

---

## Project Stack

- **AEM Edge Delivery Services** (Franklin/Helix) — vanilla JS ES6+, no build step, no frameworks
- CSS3, no Tailwind, no preprocessors
- Blocks live in `blocks/{blockname}/{blockname}.js` and `blocks/{blockname}/{blockname}.css`
- Content comes from the CMS as `.plain.html` — the JS `decorate(block)` function transforms it
- Dev server: `npx @adobe/aem-cli up` at `http://localhost:3000`

---

## Feature Overview

The **Overview component** is a dual-mode page layout with a tab switcher:

| Mode | Default | Behaviour |
|------|---------|-----------|
| **Full View** | ✅ Yes | All page sections render normally. Switcher visible on top of the hero block. |
| **Overview** | No | All page sections hidden. Overview block shows a condensed dashboard populated from other blocks via one-time DOM cloning. |

Mode is controlled by toggling CSS classes on `<main>`:
- `overview-page-overview` — hides all sections except `.overview-container`
- `overview-page-fullview` — hides `.overview-container`, shows everything else
- On `≤ 1024px` — both mode classes are cleared; the overview dashboard is hidden entirely (mobile not yet designed)

---

## File Map

| File | Role |
|------|------|
| `blocks/overview/overview.js` | Main block — builds DOM, registers event listeners, injects content from other blocks |
| `blocks/overview/overview.css` | All overview layout and slot styles |
| `atomic/switcher/overview-switcher.js` | Reusable tab switcher component (`createOverviewSwitcher`, `setupOverviewSwitcher`) |
| `atomic/switcher/overview-switcher.css` | Switcher button styles |
| `blocks/hero/hero.js` | Dispatches `hero:decorated` at end of `decorate()` |
| `blocks/numeralia/numeralia.js` | Dispatches `numeralia:decorated` at end of `decorate()` |
| `blocks/numeralia/numeralia.css` | Uses `numeralia-*` prefixed class names |
| `blocks/cards/cards.js` | Dispatches `cards:decorated` at end of `decorate()` |
| `blocks/product-cards/product-cards.js` | Dispatches `product-cards:decorated`; stores Lottie JSON on `data-lottie-json` attribute |
| `scripts/s-and-p-global/s-and-p-carousel.js` | Shared carousel — extended with `vertical: true` option |
| `styles/s-and-p-global/s-and-p-carousel.css` | Carousel styles including `.carousel-vertical` rules |
| `styles/lazy-styles.css` | Global utility: `.text-link-button` shared class |

---

## Architecture: Cross-Block Communication Pattern

Each source block dispatches a custom event when it finishes decorating. The overview block registers `{ once: true }` listeners on `pageRoot` (`<main>`) for each:

```
hero.js          → new CustomEvent('hero:decorated', { bubbles: true })
numeralia.js     → new CustomEvent('numeralia:decorated', { bubbles: true })
cards.js         → new CustomEvent('cards:decorated', { bubbles: true })
product-cards.js → new CustomEvent('product-cards:decorated', { bubbles: true })
```

**Why this pattern:** Source blocks have zero knowledge of overview. If overview is absent from the page, events fire and nothing listens — no error. If a block hasn't decorated yet when overview runs, the listener waits. All injection is one-time DOM cloning (not live references).

---

## DOM Structure (Overview Panel)

```
.overview-layout
  .overview-hero                          ← navy band
    .overview-hero-inner
      .overview-switcher [role=tablist]   ← tab switcher (prepended here)
      .overview-hero-main                 ← h1 + p cloned from full-view hero
      aside.overview-hero-stat            ← numeralia stat carousel
  .overview-main
    .overview-main-left
      .overview-main-cards                ← action cards (cloned from .cards block)
      .overview-main-subrow
        .overview-grid-insights           ← insights slot (not yet populated)
        .overview-grid-products           ← product cards list
    .overview-main-right
      .overview-grid-contact              ← contact/embed-form slot (not yet populated)
```

---

## Slot Injection Functions (in `overview.js`)

### `scheduleInjectHeroEmAccentContent(pageRoot, panelOverview)`
- Listens: `hero:decorated`
- Source: `.hero .hero-em-accent-content` (outside `.overview-container`)
- Clones: h1 + first non-button `<p>` → appends to `.overview-hero-main`

### `scheduleInjectHeroSwitcher(pageRoot, heroTablist)`
- Listens: `hero:decorated`
- Appends the second switcher tablist into `.hero` as `.overview-switcher-hero-host`
- The hero switcher and the overview-panel switcher are kept in sync via `tabSets` array

### `scheduleInjectNumeraliaStat(pageRoot, panelOverview)`
- Listens: `numeralia:decorated`
- Source: `.numeralia .stats .stat-item` elements (outside `.overview-container`)
- Reads `data-target` attribute for number value (avoids animation timing issues)
- Builds DOM: `<span class="numeralia-number-wrapper"><span class="numeralia-number-scroll"><span class="number-item">${value}</span></span></span>`
- Calls `initCarousel(stat, { mobileOnly: false, infinite: false, vertical: true })`

### `scheduleInjectCards(pageRoot, panelOverview)`
- Listens: `cards:decorated`
- Source: `.cards .card-item` elements (outside `.overview-container`)
- Restructures each card: removes `.card-body`, creates `.card-bottom` > `.card-bottom-content` containing `.card-title` + `.card-description` (hidden, shown on hover), plus `.icon-arrow-right`
- Description text extracted from `.card-body` text nodes before removal
- Sets `--overview-cards-count` CSS custom property for dynamic grid columns
- Hover behaviour: description fades in (`opacity 0→1`, `max-height 0→150px`), arrow rotates

### `scheduleInjectProductCards(pageRoot, panelOverview)`
- Listens: `product-cards:decorated`
- Source: `.product-cards` block (outside `.overview-container`)
- Builds: header row (section heading + "Browse All" CTA) + scrollable `.overview-products-list` (300px fixed height, `overflow-y: auto`)
- Each product: `<a>` or `<div>` row with title (left) + Lottie animation (right, 48×48px)
- CTA lookup order: `headerEl a[href]` → `.carousel-cta a[href]` (because `product-cards.js` moves CTA into carousel nav before event fires)
- Lottie JSON stored on `lottieHost.dataset.lottieJson` in `product-cards.js` so clones can re-init animations
- Rows are `<a>` tags when source card has a link (currently empty in test content)

---

## Tab Switcher (`atomic/switcher/overview-switcher.js`)

### `createOverviewSwitcher(options)`
Returns a `<div role="tablist">` with two buttons. Does not auto-inject — caller places it.

Options: `{ bid, panelOverviewId, panelFullviewId, idSuffix? }`

### `setupOverviewSwitcher({ tabSets, panelOverview, panelFullview, pageRoot })`
Wires click handlers for **two synced switchers** via `tabSets` array:
```js
tabSets: [
  { btnOverview, btnFullview },         // switcher inside overview-hero-inner
  { btnOverview: heroBtnOverview, btnFullview: heroBtnFullview }  // switcher on full-view hero
]
```
- Default active tab: **Full View** (`btnFullview.is-active`)
- On desktop init: calls `setPageDesktopMode('fullview')`
- On `≤ 1024px`: clears page mode classes (mobile fallback)

---

## Vertical Carousel (`s-and-p-carousel.js`)

Extended with `vertical: true` option. When passed:
- Adds `carousel-vertical` class
- `slideTo` uses `translateY` instead of `translateX`
- Dots render as vertical pill column on the right
- Track height set via `ResizeObserver` — defers until panel is unhidden (avoids `height: 0`)
- Arrow nav hidden
- Drag uses Y axis

**Zero regression risk** — only activates when `vertical: true` is explicitly passed.

---

## Shared Utility: `text-link-button` (`styles/lazy-styles.css`)

A utility class for "plain underline text link" style (transparent background, no border, underlined via `box-shadow: 0 0.75px 0`). Used by:
- `product-cards` compact variant CTA (matched by long selector in the same rule)
- Overview products slot CTA (`.text-link-button` class applied in JS)

`box-shadow` is used instead of `border-bottom` to avoid adding layout height.

---

## CSS Visibility Logic (`overview.css`)

```css
/* ≤ 1024px: hide overview dashboard, all sections stay in flow */
@media (width <= 1024px) {
  .section.overview-container > .overview-wrapper { display: none !important; }
}

/* > 1024px + overview mode: show only overview-container */
@media (width >= 1025px) {
  .overview-page-overview > .section:not(.overview-container) { display: none !important; }
  .overview-page-overview > .section.overview-container       { display: block !important; }
  .overview-page-fullview > .section.overview-container       { display: none !important; }
  .overview-page-fullview > .section:not(.overview-container) { display: block !important; }

  /* Footer sits outside <main> — hide it via :has() in overview mode */
  body:has(.overview-page-overview) footer { display: none !important; }
}
```

---

## Known TODOs / Hardcoded Values

| Value | Location | Needs token for |
|-------|----------|----------------|
| `#132445` | `overview.css` | Dark navy text (stats, cards) |
| `#B8EAF5` | `overview.css` | Light blue card background |
| `88px` | `overview.css` | Large stat number font size |
| `263px` / `421px` | `overview.css` | Stat card min dimensions |
| `300px` | `overview.css` | Products / insights slot height |
| `17px` | `overview.css` | Product row top padding |
| `0.75px` | `lazy-styles.css` | Underline thickness in `text-link-button` |
| `clamp(189px, calc(22.14vh - 19.1px), 220px)` | `overview.css` | Action card min-height (viewport-responsive) |

---

## Pending / Not Yet Implemented

| Slot | Status | Notes |
|------|--------|-------|
| `overview-grid-insights` | Skeleton only | `insights-card` block has a rendering issue locally (works in AEM UE). Not wired up yet. |
| `overview-grid-contact` | Skeleton only | Embed form slot — open design discussion on whether full form or simplified CTA |
| Mobile layout | Deferred | Overview dashboard hidden on `≤ 1024px` — no responsive design yet |

---

## Open Design Discussions

1. **Product card hover description** — full-view product cards show description on hover. Should overview product rows do the same? (tooltip, expand-in-place, or nothing)
2. **Embed form / contact slot** — should it embed the full AEM Forms iframe, or a simplified teaser + link?
3. **Empty slots** — if a source block is absent, the slot container (white box, border) still renders. Should it be hidden?

---

## Test Scenarios (Planned — Not Yet Built)

Static HTML fixtures in `drafts/overview/` for:
1. No overview block authored
2. Overview block authored, no source blocks present
3. Overview + partial components (various missing block combinations)
4. Happy path — all blocks present and populated
5. Minimum data — all blocks present with 1 item each
6. Maximum data — all blocks with many/long items (overflow, scroll, grid stress)

Start dev server with: `npx @adobe/aem-cli up --no-open --forward-browser-logs --html-folder drafts`
