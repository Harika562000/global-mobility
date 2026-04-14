import { eyebrowDecorator, decorateTags } from '../../scripts/scripts.js';
import { isVideoLink, setResolvedVideoSrc } from '../../scripts/s-and-p-global/media-decorator.js';

/**
 * Hero block: three variations (UE authoring reference).
 *
 * Variation summary (from UE authoring UI):
 * - Image as background: image, heading, description.
 * - Two-colored:        image, heading, description.
 * - Black-colored: image, tag, eyebrow, heading, description.
 *
 * The `image` reference field accepts both images and videos from DAM.
 * When a video asset is picked, EDS renders it as an <a href="...video.mp4">
 * instead of a <picture> — the same reference field covers both image and video.
 */

/**
 * Extracts a video <a> element from a row if the reference field
 * resolved to a video asset (produces an <a href>) rather than an image (<picture>).
 *
 * @param {Element} row
 * @returns {HTMLAnchorElement|null}
 */
function getVideoLink(row) {
  if (!row) return null;
  const anchors = [...row.querySelectorAll('a[href]')];
  return anchors.find((a) => isVideoLink(a.href)) || null;
}

/**
 * Creates a mute/unmute toggle button for the hero video overlay.
 *
 * @param {HTMLVideoElement} video
 * @returns {HTMLButtonElement}
 */
function createMuteToggle(video) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('hero-video-mute-btn');

  const update = () => {
    const muted = video.muted || video.volume === 0;
    btn.setAttribute('aria-label', muted ? 'Unmute video' : 'Mute video');
    btn.setAttribute('aria-pressed', String(muted));
    btn.classList.toggle('is-muted', muted);
  };

  btn.addEventListener('click', () => {
    video.muted = !video.muted;
    update();
  });
  video.addEventListener('volumechange', update);
  update();
  return btn;
}

/**
 * Builds a <video> element from the authored flags and src.
 * Used by all three variations.
 *
 * Rules:
 * - playOnce overrides autoplay + loop (plays once on viewport entry, then stops)
 * - autoplay + muted are required by browser autoplay policy
 * - showControls adds native browser controls
 * - When autoplay is on, a mute/unmute overlay button is also added so the end
 *   user can unmute
 *
 * @param {string}  src
 * @param {Object}  flags
 * @param {boolean} flags.autoplay
 * @param {boolean} flags.muted
 * @param {boolean} flags.loop
 * @param {boolean} flags.showControls
 * @param {boolean} flags.playOnce
 * @param {string}  [ariaLabel]
 * @returns {{ video: HTMLVideoElement, muteBtn: HTMLButtonElement|null }}
 */
function buildVideo(src, flags, ariaLabel = 'Hero video', block = null) {
  const {
    autoplay,
    muted,
    loop,
    showControls,
    playOnce,
  } = flags;

  // playOnce overrides autoplay/loop
  const effectiveAutoplay = playOnce ? false : autoplay;
  const effectiveLoop = playOnce ? false : loop;
  // Browsers require muted for autoplay — force it when autoplay or playOnce is on
  const effectiveMuted = (effectiveAutoplay || playOnce) ? true : muted;

  const video = document.createElement('video');
  video.setAttribute('aria-label', ariaLabel);
  video.setAttribute('preload', effectiveAutoplay || playOnce ? 'auto' : 'metadata');
  video.setAttribute('playsinline', ''); // required for autoplay on iOS/mobile
  video.style.setProperty('--video-object-fit', 'cover');

  // Always set both attribute and property for muted (browser quirk)
  if (effectiveMuted) {
    video.setAttribute('muted', '');
    video.muted = true;
  }
  if (effectiveLoop) video.setAttribute('loop', '');
  if (showControls) video.setAttribute('controls', '');
  if (effectiveAutoplay) video.setAttribute('autoplay', '');

  const source = document.createElement('source');
  setResolvedVideoSrc(source, src);
  const ext = src.split('?')[0].split('.').pop().toLowerCase();
  const mimeMap = {
    mp4: 'video/mp4', mov: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
  };
  source.setAttribute('type', mimeMap[ext] || 'video/mp4');
  video.append(source);

  if (playOnce) {
    // Ensure video is paused on load — only plays once when component enters viewport
    video.pause();
    // Play once when ≥25% of this specific hero block enters the viewport.
    // `block` is passed in so we always observe the correct instance even when
    // multiple hero blocks exist on the same page.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25 },
    );
    // Stop after first play-through
    video.addEventListener('ended', () => video.pause(), { once: true });
    // Use the passed block reference — never rely on video.closest() which
    // returns null before the video is inserted into the DOM.
    requestAnimationFrame(() => observer.observe(block || video));
  } else if (effectiveAutoplay) {
    // Programmatic play after DOM insertion — reliable across all browsers
    requestAnimationFrame(() => {
      video.play().catch(() => {});
    });
  }

  // Mute/unmute button when video starts muted (autoplay or playOnce)
  const muteBtn = effectiveMuted ? createMuteToggle(video) : null;
  return { video, muteBtn };
}

/** Get the value cell (content) from a row; UE often uses row = [label, value]. */
function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

function appendContent(row, target, fallbackHeading = false) {
  if (!row) return;
  const cell = getValueCell(row);
  const scope = cell || row;
  const contentSelector = 'h1, h2, h3, h4, h5, h6, p';
  let elements = scope.querySelectorAll(contentSelector);
  if (elements.length === 0 && scope.querySelector(':scope > div')) {
    const inner = scope.querySelector(':scope > div');
    elements = inner.querySelectorAll(contentSelector);
  }
  if (elements.length) {
    elements.forEach((el) => target.appendChild(el));
  } else {
    const text = scope.textContent?.trim();
    if (text) {
      const el = fallbackHeading ? document.createElement('h2') : document.createElement('p');
      el.textContent = text;
      target.appendChild(el);
    } else {
      const source = scope.querySelector(':scope > div') || scope;
      while (source.firstChild) {
        target.appendChild(source.firstChild);
      }
    }
  }
}

function decorateEmAccent(block, rows, picture, videoLink, rowIndices, videoFlags) {
  const bgDiv = document.createElement('div');
  bgDiv.className = 'hero-em-accent-background';
  let muteBtn = null;
  if (videoLink) {
    const built = buildVideo(videoLink.href, videoFlags, 'Hero background video', block);
    bgDiv.appendChild(built.video);
    muteBtn = built.muteBtn;
  } else if (picture) {
    picture.querySelector('img')?.setAttribute('loading', 'eager');
    bgDiv.appendChild(picture);
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-em-accent-content';

  appendContent(rows[rowIndices.heading], contentDiv, true);
  appendContent(rows[rowIndices.description], contentDiv);

  for (let r = rowIndices.firstButtonRow; r < rows.length; r += 1) {
    if (rows[r]) appendContent(rows[r], contentDiv);
  }

  block.appendChild(bgDiv);
  block.appendChild(contentDiv);
  // Mute button appended directly on the block (above the gradient ::before overlay)
  if (muteBtn) block.appendChild(muteBtn);
}

function decorateTwoColoredRight(block, rows, picture, videoLink, rowIndices, videoFlags) {
  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-two-colored-right-content';

  appendContent(rows[rowIndices.heading], contentDiv, true);
  appendContent(rows[rowIndices.description], contentDiv);

  const imageDiv = document.createElement('div');
  imageDiv.className = 'hero-two-colored-right-image';
  if (videoLink) {
    const { video, muteBtn } = buildVideo(videoLink.href, videoFlags, 'Hero video', block);
    imageDiv.appendChild(video);
    if (muteBtn) imageDiv.appendChild(muteBtn);
  } else if (picture) {
    imageDiv.appendChild(picture);
  }

  block.appendChild(contentDiv);
  block.appendChild(imageDiv);
}

function decorateBlackColoredRight(block, rows, picture, videoLink, rowIndices, videoFlags) {
  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-black-colored-right-content';

  const tagRow = rows[rowIndices.tag];
  const tagText = getValueCell(tagRow)?.textContent?.trim();
  if (tagText) {
    const variationRow = rowIndices.tagVariation >= 0 ? rows[rowIndices.tagVariation] : null;
    const tagVariation = (variationRow ? getValueCell(variationRow)?.textContent?.trim() : '') || 'dark';
    const table = document.createElement('table');
    const tr1 = document.createElement('tr');
    tr1.appendChild(document.createElement('td')).textContent = `tag (${tagVariation})`;
    const tr2 = document.createElement('tr');
    tr2.appendChild(document.createElement('td')).textContent = tagText;
    table.append(tr1, tr2);
    contentDiv.appendChild(table);
  }

  if (rowIndices.eyebrow >= 0) {
    const eyebrowRow = rows[rowIndices.eyebrow];
    const eyebrowCell = getValueCell(eyebrowRow);
    const eyebrowText = eyebrowCell?.textContent?.trim();
    if (eyebrowText) {
      const eyebrowP = eyebrowCell?.querySelector('p');
      const formatted = eyebrowDecorator(eyebrowP || eyebrowText, 'accent-color');
      if (formatted) contentDiv.appendChild(formatted);
    }
  }

  appendContent(rows[rowIndices.heading], contentDiv, true);
  appendContent(rows[rowIndices.description], contentDiv);

  for (let r = rowIndices.firstButtonRow; r < rowIndices.tag; r += 1) {
    // Tag variation is used only for tag styling; don't render it as body text.
    if (r !== rowIndices.tagVariation && rows[r]) {
      appendContent(rows[r], contentDiv);
    }
  }
  decorateTags(contentDiv);

  const imageDiv = document.createElement('div');
  imageDiv.className = 'hero-black-colored-right-image';
  if (videoLink) {
    const { video, muteBtn } = buildVideo(videoLink.href, videoFlags, 'Hero video', block);
    imageDiv.appendChild(video);
    if (muteBtn) imageDiv.appendChild(muteBtn);
  } else if (picture) {
    imageDiv.appendChild(picture);
  }

  block.appendChild(contentDiv);
  block.appendChild(imageDiv);
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const section = block.closest('.section');
  if (section && section.classList.contains('bg-light-grey')) {
    section.classList.add('hero-section');
  }

  const isBlackColoredRight = block.classList.contains('hero-black-colored-right');
  const isTwoColoredRight = block.classList.contains('hero-two-colored-right');

  const lastDataRow = rows.length - 1;

  // Find the media row — the first row that contains a <picture> or a video <a href>.
  // Boolean/text control fields (autoplay, muted, loop, etc.) appear before the image
  // field in the UE panel and produce plain-text rows with no media content.
  const mediaIdx = rows.findIndex((r) => (
    r.querySelector('picture')
    || [...r.querySelectorAll('a[href]')].find((a) => isVideoLink(a.href))
  ));
  const idx = mediaIdx >= 0 ? mediaIdx : 0;

  // Detect whether the reference field resolved to a video or an image.
  const mediaRow = rows[idx];
  const videoLink = getVideoLink(mediaRow);

  let picture = null;
  if (!videoLink) {
    picture = mediaRow?.querySelector('picture') || null;
  }

  // Apply alt text from the row immediately following the media row
  const altText = getValueCell(rows[idx + 1])?.textContent?.trim();
  if (picture && altText) {
    const img = picture.querySelector('img');
    if (img) img.setAttribute('alt', altText);
  }

  // firstButtonRow: scan forward from mediaIdx + 2 (skip media + alt rows)
  // For black-colored-right the heading is at idx+2 and description at idx+3
  const firstButtonRow = idx + 4;
  const findRowByLabel = (dataRows, fromIdx, toIdx, labelPart) => {
    const lower = (labelPart || '').toLowerCase();
    for (let i = fromIdx; i <= toIdx; i += 1) {
      const label = (dataRows[i]?.children[0]?.textContent || '').toLowerCase();
      if (label.includes(lower)) return i;
    }
    return -1;
  };
  let tagTitleIdx = isBlackColoredRight
    ? findRowByLabel(rows, firstButtonRow, lastDataRow, 'tag title')
    : -1;
  let tagVariationIdx = isBlackColoredRight
    ? ['tag variation', 'tag var', 'tagvariation'].reduce(
      (found, label) => (
        found >= 0 ? found : findRowByLabel(rows, firstButtonRow, lastDataRow, label)
      ),
      -1,
    )
    : -1;

  // UE nested "tag" container rows are sometimes unlabeled; fall back to tail rows.
  if (isBlackColoredRight) {
    const knownVariations = ['outline', 'fill', 'glass', 'dark'];
    const isKnownTagVariation = (val) => knownVariations
      .includes((val || '').trim().toLowerCase());

    // If we couldn't find the labeled rows, assume the last row is tag title
    // and the row before it is variation.
    if (tagTitleIdx < 0) tagTitleIdx = lastDataRow;
    if (tagVariationIdx < 0) {
      const candidateIdx = tagTitleIdx - 1;
      const candidateText = getValueCell(rows[candidateIdx])?.textContent?.trim();
      if (candidateIdx >= firstButtonRow && isKnownTagVariation(candidateText)) {
        tagVariationIdx = candidateIdx;
      }
    }
  }
  const rowIndices = isBlackColoredRight
    ? {
      eyebrow: 1,
      heading: 2,
      description: 3,
      tagVariation: tagVariationIdx,
      tag: tagTitleIdx >= 0 ? tagTitleIdx : lastDataRow,
      firstButtonRow: 4,
    }
    : {
      eyebrow: -1,
      heading: idx + 2,
      description: idx + 3,
      tagVariation: -1,
      tag: lastDataRow,
      firstButtonRow,
    };

  // Single authoring flag: "Play one time".
  // UE renders boolean fields as a single-cell <div> containing only "true" or "false"
  // (no label). The row may appear at any position (depends on variation / empty CTA rows).
  // Scan all rows, take the first match, read + remove it.
  let playOnce = false;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const val = rows[i]?.textContent?.trim().toLowerCase();
    if (val === 'true' || val === 'false') {
      playOnce = val === 'true';
      rows[i].remove();
      rows.splice(i, 1);
      break;
    }
  }

  const videoFlags = {
    autoplay: !playOnce,
    muted: true,
    loop: !playOnce,
    showControls: false,
    playOnce,
  };

  if (isBlackColoredRight) {
    decorateBlackColoredRight(block, rows, picture, videoLink, rowIndices, videoFlags);
  } else if (isTwoColoredRight) {
    decorateTwoColoredRight(block, rows, picture, videoLink, rowIndices, videoFlags);
  } else {
    decorateEmAccent(block, rows, picture, videoLink, rowIndices, videoFlags);
  }

  rows.forEach((r) => r.remove());
}
