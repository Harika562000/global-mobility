# Overview Component — Technical Lead Analysis Sheet

---

## What Was Built

### Feature: Overview / Full View Tab Switcher

A dual-mode page layout controlled by a tab switcher with two states:

| Mode | Behavior |
|------|----------|
| **Full View** (default) | All page sections render normally. Switcher sits on top of the hero block. |
| **Overview** | All page sections hidden. Overview block shows a condensed dashboard that pulls content from other blocks via one-time DOM cloning. |

---

## Architecture Decisions

### 1. CSS-Class-Driven Visibility

Classes `overview-page-overview` / `overview-page-fullview` are toggled on `<main>`. CSS handles all show/hide logic — no JS style manipulation.

```css
.overview-page-overview > .section:not(.overview-container) { display: none !important; }
.overview-page-fullview > .section.overview-container      { display: none !important; }
```

**Why:** Zero layout thrash. No JS knows about specific sections. Easy to debug in DevTools.

---

### 2. Custom Event Lifecycle Pattern (Cross-Block Communication)

Each source block fires a custom event after it finishes decorating. The overview block listens and clones content into its slots.

```
hero.js          → dispatches  hero:decorated
numeralia.js     → dispatches  numeralia:decorated
cards.js         → dispatches  cards:decorated
product-cards.js → dispatches  product-cards:decorated
```

The overview block registers `{ once: true }` listeners on `pageRoot` for each event.

**Why blocks stay decoupled:** `hero.js` has zero knowledge of overview. If overview is not on the page, the event fires and nothing listens — no error, no side effect.

**Why one-time cloning (not live references):** Overview panel can be shown/hidden independently from source blocks. Cloned DOM is fully owned by overview.

---

### 3. Atomic Switcher Component

`atomic/switcher/overview-switcher.js` — reusable tab switcher.

- `createOverviewSwitcher({ bid, panelOverviewId, panelFullviewId })` → returns a `<div role="tablist">` DOM node (no auto-inject, caller places it)
- `setupOverviewSwitcher({ tabSets, panelOverview, panelFullview, pageRoot })` → wires click/keyboard handlers for **two synced switchers** (one in overview panel hero, one injected into full-view hero)

---

### 4. Dual Switcher Sync

Two tab switcher instances share a single `setupOverviewSwitcher` call via `tabSets` array. Clicking either switcher updates both.

| Location | How it gets there |
|----------|-------------------|
| Inside overview panel hero | `heroInner.prepend(tablist)` directly in `decorate()` |
| On top of full-view hero | `scheduleInjectHeroSwitcher` — waits for `hero:decorated`, then appends |

---

### 5. Data Slots in Overview Dashboard

| Slot | Source Block | Injection Method |
|------|-------------|-----------------|
| Stat card | `.numeralia` block | `scheduleInjectNumeraliaStat` — clones `.stat-item` elements, reads `data-target` for number value, builds vertical carousel |
| Action cards | `.cards` block | `scheduleInjectCards` — clones `.card-item` elements, restructures to icon + title + arrow layout |
| Hero heading/copy | `.hero` block | `scheduleInjectHeroEmAccentContent` — clones h1 and first p from `.hero-em-accent-content` |
| Products | `.product-cards` block | `scheduleInjectProductCards` — builds a header (title + CTA) and a scrollable list of rows (title + Lottie) |

---

### 6. Vertical Stat Carousel

Extended `s-and-p-carousel.js` with a new `vertical: true` config option.

- Adds `carousel-vertical` CSS class
- Uses `translateY` instead of `translateX` for sliding
- Dots render as vertical pill column on the right
- `ResizeObserver` defers height calculation until panel is made visible (avoids height: 0 when panel is hidden)
- **Zero regression risk** — existing carousel usage unchanged; vertical only activates when `vertical: true` is explicitly passed

---

### 7. Dynamic Card Grid

The card count in the overview dashboard is not hardcoded. After `cards:decorated` fires:

```js
rowCards.style.setProperty('--overview-cards-count', cards.length);
```

CSS uses this:
```css
.overview-main-cards {
  grid-template-columns: repeat(var(--overview-cards-count, 4), minmax(0, 1fr));
}
```

---

### 8. Products Slot

`scheduleInjectProductCards` listens for `product-cards:decorated` and builds a compact list inside `.overview-grid-products`:

- **Header row**: section heading (left) + "Browse All" CTA (right). The CTA falls back to `.carousel-cta a[href]` since `product-cards.js` moves it into the carousel nav before the event fires.
- **Scrollable list**: fixed `300px` height, `overflow-y: auto`. Each product is a row — title (left) + Lottie animation (right, 48×48px).
- **Lottie**: JSON stored on `data-lottie-json` attribute when `product-cards.js` builds its cards, so the overview can re-initialize animations without re-parsing source DOM.
- **Links**: rows are rendered as `<a>` tags when the source card is a link card, copying `href`, `target`, and `rel`.

---

### 9. Shared Utility: `text-link-button`

Extracted repeated "plain underline text link" styles into a `.text-link-button` utility class in `styles/lazy-styles.css`. Used in:

- `product-cards` compact variant CTA (matched by the existing long selector in the shared rule)
- `overview` products slot "Browse All" CTA (`.text-link-button` class applied in JS)

No build step needed — one set of declarations, two consumers, no duplication.

---

## Files Modified

| File | Change Summary |
|------|---------------|
| `blocks/overview/overview.js` | Core logic — switcher setup, event listeners, slot injection, carousel init, products slot |
| `blocks/overview/overview.css` | Layout grid, card styles, hero stat card, products slot, responsive breakpoints |
| `atomic/switcher/overview-switcher.js` | Refactored to return-only pattern, dual tabSets support, fullview default |
| `atomic/switcher/overview-switcher.css` | z-index fix, hero host positioning, specificity ordering |
| `blocks/hero/hero.js` | Added `hero:decorated` event dispatch |
| `blocks/numeralia/numeralia.js` | Added `numeralia:decorated` event dispatch, renamed CSS classes |
| `blocks/numeralia/numeralia.css` | Updated all class names to `numeralia-*` prefix |
| `blocks/cards/cards.js` | Added `cards:decorated` event dispatch |
| `blocks/product-cards/product-cards.js` | Added `product-cards:decorated` event dispatch; stored Lottie JSON on `data-lottie-json` for cloning |
| `scripts/s-and-p-global/s-and-p-carousel.js` | Added `vertical` option, Y-axis slide, ResizeObserver for hidden panels |
| `styles/s-and-p-global/s-and-p-carousel.css` | Added `.carousel-vertical` layout rules |
| `styles/lazy-styles.css` | Added `.text-link-button` shared utility class |

---

## TODO — Design Tokens

The following values are hardcoded and need proper design tokens created in the token system:

| Location | Value | Used For |
|----------|-------|----------|
| `overview.css` | `#132445` | Stat number color, stat description color, card title color |
| `overview.css` | `#B8EAF5` | Card background (light blue) |
| `overview.css` | `88px` | Stat number font size |
| `overview.css` | `189px` | Card min-height |
| `overview.css` | `263px` | Stat card min-height |
| `overview.css` | `421px` | Stat card min-width |
| `overview.css` | `300px` | Products slot fixed height |
| `overview.css` | `17px` | Products row top padding |
| `lazy-styles.css` | `0.75px` | `text-link-button` underline thickness (box-shadow) |

**Action needed:** Work with design system team to add tokens for the dark navy color (`#132445`), light blue card background (`#B8EAF5`), large display number size (`88px`), and dimension tokens.

---

## TODO — Pending Slots

| Slot | Status | Blocker |
|------|--------|---------|
| Insights panel | Not implemented | Waiting for content/block to be identified on page |
| Contact / Questions panel | Not implemented | Discussion needed — see below |

These slots already have placeholder containers in the DOM (`overview-grid-insights`, `overview-grid-contact`). Implementation will follow the same event-based injection pattern once source blocks are confirmed.

---

## TODO — Future Improvements

| Item | Priority | Notes |
|------|----------|-------|
| Clean up `slots.cards` parsing in `partitionBlockRows` | Low | Cards are now injected via event; the slot parsing is dead code |
| Stat carousel navigation behavior | Medium | Currently dots-only; autoplay/manual scroll behavior not finalized |
| Overview visible on `≤ 1024px` | Deferred | Currently hides the overview dashboard on mobile — responsive layout not designed yet |
| Grid column min-width tokens | Medium | `minmax(calc(13.75 * var(--font-size-300)), 420px)` in hero inner — placeholder values need review with design |
| Product card links in authored content | Low | 4th column (link cell) is currently empty in CMS; rows will automatically become `<a>` tags once links are authored |

---

## Open Discussion Points

### 1. Product Cards — Hover Description in Overview

In the **Full View** product card, hovering a card reveals the description text (handled by `product-cards.js`). The overview products slot currently shows only **title + Lottie** per row — description is omitted to keep the compact list tight.

**Question for lead:** Should the overview rows also show the description on hover? Options:
- **Option A — No hover description** (current): keep rows compact, description only available in Full View
- **Option B — Tooltip on hover**: show description in a tooltip when hovering the row title
- **Option C — Expand on click**: clicking a row expands inline to reveal description before navigating

Decision impacts whether overview rows should store/clone description text from the source card.

---

### 2. Contact / Embed Form Slot

The overview layout has a reserved `overview-grid-contact` slot in the right column. The page currently has an `embed-form` block for the contact form.

**Questions to discuss:**
- Should the contact form be embedded directly inside the overview panel, or should the right column show a simplified version (e.g. a teaser + link to the full form)?
- The `embed-form` block loads an AEM Forms iframe — is that appropriate inside the overview panel given the fixed layout constraints?
- Does the form need a `embed-form:decorated` event, or can overview inject a simplified CTA / summary into the slot without waiting for the form to load?

This needs alignment on both design intent and technical feasibility before implementation starts.
