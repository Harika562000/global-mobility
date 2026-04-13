# Hero Video Block

A full-bleed native `<video>` block powered by the shared **media-decorator** pipeline.
Supports two variants: a silent autoplay background video and a poster-with-modal playback mode.

---

## Table of Contents

- [Variants](#variants)
- [Authoring in Universal Editor](#authoring-in-universal-editor)
- [Document-based Authoring](#document-based-authoring)
- [Architecture](#architecture)
- [CSS Custom Properties](#css-custom-properties)
- [Accessibility](#accessibility)
- [Extending to Other Blocks](#extending-to-other-blocks)

---

## Variants

| Block class | Behaviour |
|---|---|
| _(none)_ | `hero` – full-bleed, autoplay, muted, looping background video |
| `hero-modal` | Poster image shown inline; clicking the play button opens the video in a modal |

### Additional modifier classes (combinable with any variant)

| Class | Effect |
|---|---|
| `autoplay` | Force autoplay (overrides variant default) |
| `loop` | Force loop |
| `show-controls` | Show native browser controls (disables custom overlay buttons) |

---

## Authoring in Universal Editor

1. Insert a **Hero Video** block on your page.
2. In the **Variant & Options** multiselect choose the desired variant and any playback modifiers.
3. Set the **Video Source** field to the DAM path of your video asset (`.mp4`, `.mov`, `.webm`, or `.ogg`).
4. For `hero-modal`: set a **Poster Image** and alt text — the poster is shown before the user clicks play.
5. Optionally override the accessible label with the **Accessible Label** field.

---

## Document-based Authoring

Author a table with the block name in the header cell:

### Default hero (autoplay background)

| Hero Video |
|---|
| `https://example.com/assets/hero.mp4` |

### Hero Modal (poster + play-in-modal)

| Hero Video (Hero Modal) |  |
|---|---|
| `https://example.com/assets/hero.mp4` | _(picture element)_ |

> **Tip:** Place a `<picture>` / `<img>` element in the second cell of the same row. The decorator
> automatically detects and promotes it as the poster image.

---

## Architecture

```
hero-video/
  hero-video.js     ← thin block decorator; delegates to media-decorator
  hero-video.css    ← block-specific layout overrides
  _hero-video.json  ← Universal Editor block model

scripts/
  media-config.js   ← centralised variant config (MEDIA_CONFIG, getVariantConfig)
  media-decorator.js ← shared DOM transformation pipeline
  video-modal.js    ← opens a <video> inside the modal infrastructure

styles/
  media.css         ← shared video-wrapper, controls, and modal video styles
```

### Decoration flow

```
decorate(block)
  └─ resolveVariant(block)         → 'hero' | 'hero-modal'
  └─ resolveOverrides(block)       → { autoplay, loop, controls, … }
  └─ loadCSS(hero-video.css)
  └─ decorateMedia(block, variant, overrides)
       └─ loadCSS(media.css)
       └─ getVariantConfig(variant, overrides)  → merged opts
       └─ querySelectorAll('a[href]')            → video links
       └─ For each video link:
            ├─ modalPlayback=false → buildVideoWrapper(<video>, poster, opts)
            └─ modalPlayback=true  → buildModalPlaybackWrapper(src, poster, opts)
                                        └─ on click → openVideoModal(src, opts, trigger)
```

---

## CSS Custom Properties

The decorator sets `--video-object-fit` as an inline custom property on each `<video>` element.
Override it in block CSS or with an inline style:

```css
/* Use contain instead of cover for a specific instance */
.my-block .video-wrapper video {
  --video-object-fit: contain;
}
```

### Token references used by `styles/media.css`

| Token | Usage |
|---|---|
| `--color-white` | Button borders, icon colours |
| `--color-brand-300` | Focus rings, play-trigger hover |
| `--color-black` | Modal video background |
| `--color-grey-400` | Muted speaker icon (muted state) |
| `--spacing-300` / `--spacing-400` | Controls positioning |
| `--radius-round` | Circular buttons |
| `--font-family-primary` | Button font |
| `--body-font-size-xs` | Button font size |

---

## Accessibility

- The `<video>` element carries an `aria-label` sourced from `MEDIA_CONFIG[variant].ariaLabel` (overridable per instance via the `ariaLabel` field in UE).
- The block element receives `role="region"` and a matching `aria-label`.
- Custom play/pause and mute/unmute buttons use `aria-label` and `aria-pressed` state attributes that update dynamically.
- The modal play trigger returns keyboard focus to the originating button on close (via `triggerEl.focus()`).
- The `<dialog>` element handles ESC-to-close natively.
- Autoplay is suppressed in Universal Editor edit mode (`isEditMode()`) to avoid disruptive behaviour during content authoring.

---

## Extending to Other Blocks

Any block that needs to embed a video can reuse the pipeline without writing a custom block:

```js
import { decorateMedia } from '../../scripts/media-decorator.js';

export default async function decorate(block) {
  // 'teaser', 'text-media', 'carousel', 'default' are pre-defined variants
  await decorateMedia(block, 'teaser');
}
```

To add a brand-new variant, add an entry to `MEDIA_CONFIG` in `scripts/media-config.js`:

```js
export const MEDIA_CONFIG = {
  // … existing entries …
  'my-variant': {
    autoplay: false,
    muted: true,
    loop: false,
    preload: 'metadata',
    controls: false,
    customControls: true,
    modalPlayback: false,
    ariaLabel: 'My variant video',
    objectFit: 'cover',
  },
};
```

Then call `decorateMedia(block, 'my-variant')` from your block's `decorate` function.
