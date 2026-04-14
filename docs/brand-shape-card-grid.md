# Brand Shape Card Grid

A dark-background section block that displays a heading, eyebrow label, and a fixed set of 3 cards. Each card contains an image, an optional brand logo, body text, and an optional CTA with a right-pointing arrow. On mobile the cards can either stack inline (default) or swipe as a carousel (slider variation).

---

## Block Name

`brand-shape-card-grid`

---

## Variations / CSS Classes

| Variation | CSS class | Description |
|-----------|-----------|-------------|
| Default (Inline) | *(none)* | Cards stack vertically on mobile (≤ 509 px), show 2-up at 510 px, and display as a 3-column grid on desktop (≥ 1025 px). |
| Slider | `slider` | On mobile the cards render as a touch-swipeable carousel with a peek of the next card. On desktop (≥ 1025 px) they revert to the 3-column grid. |

---

## Authoring Structure

The block is authored using a parent + child item pattern in the Universal Editor.

### Parent block fields

| Field | Label | Required | Notes |
|-------|-------|----------|-------|
| `classes` | Mobile Variation | No | Select **Default (Inline)** or **Slider** |
| `eyebrow` | Eyebrow | Yes | Short uppercase label above the heading (e.g. *OUR DIVISIONS*) |
| `heading` | Heading | Yes | Main section heading (rich text; use an h2/h3) |

### Child item fields (`brand-shape-card-grid-item`) — always 3 items

| Field | Label | Required | Notes |
|-------|-------|----------|-------|
| `cardImage` | Card Image | Yes | Full-width image at the top of the card |
| `cardImageAlt` | Card Image Alt Text | No | Accessibility alt text for the card image |
| `logo` | Logo (Optional) | No | Brand logo displayed inside the card body |
| `logoAlt` | Logo Alt Text | No | Accessibility alt text for the logo |
| `cardTitle` | Card Title / Description | Yes | Body text displayed inside the card (rich text) |
| `cardLink` | CTA Link | No | Makes the entire card a clickable link (same tab) |
| `ctaText` | CTA Text | No | Optional label shown next to the arrow at the bottom |

---

## Responsive Behaviour

| Breakpoint | Behaviour |
|------------|-----------|
| 360 – 509 px | Single-column stack (default) or single-card carousel with peek (slider) |
| 510 – 1024 px | 2-column grid (default) or 2-card carousel (slider) |
| 1025 px+ | 3-column equal-width grid (both variations) |

---

## User Interaction

- **Hover on a card** — box-shadow lifts, card image scales slightly, arrow shifts right.
- **Click on a card** — navigates to the linked page in the **same tab** (no `target="_blank"`).
- **Swipe on mobile (slider variation)** — touch drag or pointer drag to reveal adjacent cards.

---

## Document Authoring (DA / Google Docs / Word)

When authoring the block in a document table, use the following row layout:

| Row | Column 1 | Column 2 | Column 3 | Column 4 |
|-----|----------|----------|----------|----------|
| 1 | `Brand Shape Card Grid (slider)` | | | |
| 2 | Eyebrow text (plain text) | | | |
| 3 | Heading (h2 or h3) | | | |
| 4 | Card 1 image | Card 1 logo | Card 1 body text | CTA link / text |
| 5 | Card 2 image | Card 2 logo | Card 2 body text | CTA link / text |
| 6 | Card 3 image | Card 3 logo | Card 3 body text | CTA link / text |

> Omit `(slider)` from the block name for the inline / default variation.
> The logo column can be left empty if no logo is needed.

---

## Example

```
Brand Shape Card Grid (slider)

OUR DIVISIONS

## Clarity for the decisions that move the world

| [car.jpg] | [carfax-logo.png] | For consumers who want the most reliable vehicle information | [CARFAX](/carfax) |
| [car.jpg] | [carfax-logo.png] | For consumers who want the most reliable vehicle information | [CARFAX](/carfax) |
| [car.jpg] | [carfax-logo.png] | For consumers who want the most reliable vehicle information | [CARFAX](/carfax) |
