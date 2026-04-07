import { eyebrowDecorator, decorateTags } from '../../scripts/scripts.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

function getLabelCell(row) {
  if (!row || row.children.length < 2) return null;
  return row.children[0];
}

function getLabelText(row) {
  return getLabelCell(row)?.textContent?.trim().toLowerCase() || '';
}

function getTextValue(row) {
  return getValueCell(row)?.textContent?.trim() || '';
}

function rowHasButtonContent(row) {
  const scope = getValueCell(row) || row;
  return !!scope.querySelector('a, .button, .button-container');
}

function clonePicture(row) {
  const picture = (getValueCell(row) || row).querySelector('picture');
  if (picture) return picture.cloneNode(true);

  const img = (getValueCell(row) || row).querySelector('img');
  if (img) {
    const fallback = document.createElement('picture');
    fallback.appendChild(img.cloneNode(true));
    return fallback;
  }

  return null;
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

function findRowIndexByLabels(rows, labels, { from = 0, to = rows.length - 1 } = {}) {
  const normalized = labels.map((label) => label.toLowerCase());
  for (let i = from; i <= to; i += 1) {
    const label = getLabelText(rows[i]);
    if (normalized.some((entry) => label.includes(entry))) {
      return i;
    }
  }
  return -1;
}

function getVideoLink(row) {
  const scope = getValueCell(row) || row;
  const anchor = scope.querySelector('a');
  return anchor ? anchor.href : (scope.textContent?.trim() || '');
}

function getVideoClasses(row) {
  return getTextValue(row)
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function embedYoutube(url, autoplay, background) {
  const usp = new URLSearchParams(url.search);
  let suffix = '';
  if (background || autoplay) {
    const suffixParams = {
      autoplay: autoplay ? '1' : '0',
      mute: background ? '1' : '0',
      controls: background ? '0' : '1',
      disablekb: background ? '1' : '0',
      loop: background ? '1' : '0',
      playsinline: background ? '1' : '0',
    };
    const videoId = usp.get('v') || url.pathname.split('/').filter(Boolean).pop() || '';
    if (background && videoId) suffixParams.playlist = videoId;
    suffix = `?rel=0&${Object.entries(suffixParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  } else {
    suffix = '?rel=0';
  }

  let videoId = usp.get('v') ? encodeURIComponent(usp.get('v')) : '';
  if (url.origin.includes('youtu.be')) {
    [, videoId] = url.pathname.split('/');
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'hero-video-embed';
  wrapper.innerHTML = `<iframe src="https://www.youtube.com${videoId ? `/embed/${videoId}${suffix}` : `${url.pathname}${suffix}`}" style="border: 0;" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope" allowfullscreen scrolling="no" title="Content from Youtube" loading="lazy"></iframe>`;
  return wrapper;
}

function embedVimeo(url, autoplay, background) {
  const [, video] = url.pathname.split('/');
  let suffix = '';
  if (background || autoplay) {
    const suffixParams = {
      autoplay: autoplay ? '1' : '0',
      background: background ? '1' : '0',
      muted: background ? '1' : '0',
      loop: background ? '1' : '0',
    };
    suffix = `?${Object.entries(suffixParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'hero-video-embed';
  wrapper.innerHTML = `<iframe src="https://player.vimeo.com/video/${video}${suffix}" style="border: 0;" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Content from Vimeo" loading="lazy"></iframe>`;
  return wrapper;
}

function getVideoElement(source, autoplay, background) {
  const video = document.createElement('video');
  video.setAttribute('preload', background ? 'auto' : 'metadata');
  if (autoplay) video.setAttribute('autoplay', '');
  if (background) {
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.muted = true;
  } else {
    video.setAttribute('controls', '');
  }

  const sourceEl = document.createElement('source');
  sourceEl.setAttribute('src', source);
  sourceEl.setAttribute('type', `video/${source.split('.').pop()}`);
  video.append(sourceEl);

  if (background) {
    video.addEventListener('canplay', () => {
      video.muted = true;
      if (autoplay) video.play().catch(() => {});
    }, { once: true });
  }

  return video;
}

function loadVideoEmbed(container, link, autoplay, background) {
  if (!link || container.dataset.embedLoaded === 'true') {
    return;
  }

  const url = new URL(link);
  const isYoutube = link.includes('youtube') || link.includes('youtu.be');
  const isVimeo = link.includes('vimeo');

  if (isYoutube) {
    const embedWrapper = embedYoutube(url, autoplay, background);
    container.append(embedWrapper);
    embedWrapper.querySelector('iframe')?.addEventListener('load', () => {
      container.dataset.embedLoaded = 'true';
    }, { once: true });
  } else if (isVimeo) {
    const embedWrapper = embedVimeo(url, autoplay, background);
    container.append(embedWrapper);
    embedWrapper.querySelector('iframe')?.addEventListener('load', () => {
      container.dataset.embedLoaded = 'true';
    }, { once: true });
  } else {
    const videoEl = getVideoElement(link, autoplay, background);
    container.append(videoEl);
    videoEl.addEventListener('canplay', () => {
      container.dataset.embedLoaded = 'true';
    }, { once: true });
    videoEl.load();
  }
}

function buildVideoMedia(media, { background }) {
  const container = document.createElement('div');
  container.className = 'hero-video-media';
  container.dataset.embedLoaded = 'false';

  media.classes.forEach((className) => container.classList.add(className));

  const autoplay = media.classes.includes('autoplay');
  const showControls = media.classes.includes('show-controls');
  const effectiveBackground = autoplay && !showControls && background;
  const paneBackground = autoplay && !showControls && !background;
  const shouldUseBackgroundPlayback = effectiveBackground || paneBackground;

  const placeholder = media.placeholder ? media.placeholder.cloneNode(true) : null;
  if (placeholder && media.placeholderAlt && placeholder.querySelector('img')) {
    placeholder.querySelector('img').setAttribute('alt', media.placeholderAlt);
  }

  if (placeholder) {
    container.classList.add('placeholder');
    const wrapper = document.createElement('div');
    wrapper.className = 'hero-video-placeholder';
    wrapper.append(placeholder);

    if (!autoplay) {
      wrapper.insertAdjacentHTML(
        'beforeend',
        '<div class="hero-video-placeholder-play"><button type="button" title="Play"></button></div>',
      );
      wrapper.addEventListener('click', () => {
        wrapper.remove();
        loadVideoEmbed(container, media.link, true, false);
      });
    }

    container.append(wrapper);
  }

  if (!placeholder || autoplay) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        const playOnLoad = autoplay && !prefersReducedMotion.matches;
        loadVideoEmbed(container, media.link, playOnLoad, shouldUseBackgroundPlayback);
      }
    });
    observer.observe(container);
  }

  return container;
}

function buildImageMedia(media, eager = false) {
  const picture = media.picture ? media.picture.cloneNode(true) : null;
  if (!picture) return null;

  const img = picture.querySelector('img');
  if (img) {
    if (media.alt) img.setAttribute('alt', media.alt);
    if (eager) img.setAttribute('loading', 'eager');
  }

  return picture;
}

function getLegacyRowIndices(rows, isBlackColoredRight) {
  const hasVariationRow = !rows[0]?.querySelector('picture');
  const idx = hasVariationRow ? 1 : 0;
  const lastDataRow = rows.length - 1;
  const firstButtonRow = isBlackColoredRight ? 4 : idx + 4;

  const findLegacyLabel = (fromIdx, toIdx, labelPart) => {
    for (let i = fromIdx; i <= toIdx; i += 1) {
      const label = (rows[i]?.children[0]?.textContent || '').toLowerCase();
      if (label.includes(labelPart)) return i;
    }
    return -1;
  };

  let tagTitleIdx = isBlackColoredRight
    ? findLegacyLabel(firstButtonRow, lastDataRow, 'tag title')
    : -1;
  let tagVariationIdx = isBlackColoredRight
    ? ['tag variation', 'tag var', 'tagvariation'].reduce(
      (found, label) => (found >= 0 ? found : findLegacyLabel(firstButtonRow, lastDataRow, label)),
      -1,
    )
    : -1;

  if (isBlackColoredRight) {
    const knownVariations = ['outline', 'fill', 'glass', 'dark'];
    if (tagTitleIdx < 0) tagTitleIdx = lastDataRow;
    if (tagVariationIdx < 0) {
      const candidateIdx = tagTitleIdx - 1;
      const candidateText = getTextValue(rows[candidateIdx]).toLowerCase();
      if (candidateIdx >= firstButtonRow && knownVariations.includes(candidateText)) {
        tagVariationIdx = candidateIdx;
      }
    }
  }

  return isBlackColoredRight
    ? {
      heading: 2,
      description: 3,
      eyebrow: 1,
      firstButtonRow: 4,
      tag: tagTitleIdx >= 0 ? tagTitleIdx : lastDataRow,
      tagVariation: tagVariationIdx,
    }
    : {
      heading: idx + 2,
      description: idx + 3,
      eyebrow: -1,
      firstButtonRow,
      tag: lastDataRow,
      tagVariation: -1,
    };
}

function parseHeroRows(rows, { isBlackColoredRight }) {
  const indices = {
    mediaType: findRowIndexByLabels(rows, ['media type']),
    image: findRowIndexByLabels(rows, ['image'], { from: 0, to: rows.length - 1 }),
    imageAlt: findRowIndexByLabels(rows, ['image alt text']),
    video: findRowIndexByLabels(rows, ['video']),
    videoClasses: findRowIndexByLabels(rows, ['video options']),
    placeholder: findRowIndexByLabels(rows, ['placeholder image']),
    placeholderAlt: findRowIndexByLabels(rows, ['placeholder image alt text']),
    eyebrow: findRowIndexByLabels(rows, ['eyebrow text']),
    heading: findRowIndexByLabels(rows, ['heading']),
    description: findRowIndexByLabels(rows, ['sub-heading', 'description']),
  };

  const labeledMediaRows = new Set([
    indices.mediaType,
    indices.image,
    indices.imageAlt,
    indices.video,
    indices.videoClasses,
    indices.placeholder,
    indices.placeholderAlt,
  ].filter((idx) => idx >= 0));

  const firstPictureIdx = rows.findIndex((row, idx) => idx >= 0
    && !labeledMediaRows.has(idx)
    && !!(getValueCell(row) || row).querySelector('picture, img'));
  if (indices.image < 0 && firstPictureIdx >= 0) {
    indices.image = firstPictureIdx;
  }

  const mediaTypeValue = indices.mediaType >= 0 ? getTextValue(rows[indices.mediaType]).toLowerCase() : '';
  let mediaType = mediaTypeValue || 'image';
  if (mediaType !== 'video' && indices.video >= 0) mediaType = 'video';

  const legacy = getLegacyRowIndices(rows, isBlackColoredRight);
  if (indices.heading < 0) indices.heading = legacy.heading;
  if (indices.description < 0) indices.description = legacy.description;
  if (indices.eyebrow < 0) indices.eyebrow = legacy.eyebrow;

  let tagIdx = isBlackColoredRight
    ? findRowIndexByLabels(rows, ['tag title'], { from: legacy.firstButtonRow })
    : -1;
  let tagVariationIdx = isBlackColoredRight
    ? findRowIndexByLabels(rows, ['tag variation', 'tag var', 'tagvariation'], { from: legacy.firstButtonRow })
    : -1;

  if (isBlackColoredRight && tagIdx < 0) {
    tagIdx = legacy.tag;
    tagVariationIdx = legacy.tagVariation;
  }

  const reservedIndices = new Set([
    indices.mediaType,
    indices.image,
    indices.imageAlt,
    indices.video,
    indices.videoClasses,
    indices.placeholder,
    indices.placeholderAlt,
    indices.eyebrow,
    indices.heading,
    indices.description,
    tagIdx,
    tagVariationIdx,
  ].filter((idx) => idx >= 0));

  const ctaRows = rows.filter(
    (row, index) => !reservedIndices.has(index) && rowHasButtonContent(row),
  );

  return {
    mediaType,
    content: {
      heading: rows[indices.heading] || null,
      description: rows[indices.description] || null,
      eyebrow: indices.eyebrow >= 0 ? rows[indices.eyebrow] : null,
      ctaRows,
      tag: tagIdx >= 0 ? rows[tagIdx] : null,
      tagVariation: tagVariationIdx >= 0 ? rows[tagVariationIdx] : null,
    },
    media: mediaType === 'video'
      ? {
        type: 'video',
        link: indices.video >= 0 ? getVideoLink(rows[indices.video]) : '',
        classes: indices.videoClasses >= 0 ? getVideoClasses(rows[indices.videoClasses]) : [],
        placeholder: indices.placeholder >= 0 ? clonePicture(rows[indices.placeholder]) : null,
        placeholderAlt: indices.placeholderAlt >= 0 ? getTextValue(rows[indices.placeholderAlt]) : '',
      }
      : {
        type: 'image',
        picture: indices.image >= 0 ? clonePicture(rows[indices.image]) : null,
        alt: indices.imageAlt >= 0 ? getTextValue(rows[indices.imageAlt]) : '',
      },
  };
}

function decorateEmAccent(block, content, mediaElement) {
  const bgDiv = document.createElement('div');
  bgDiv.className = 'hero-em-accent-background';
  if (mediaElement) bgDiv.appendChild(mediaElement);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-em-accent-content';

  appendContent(content.heading, contentDiv, true);
  appendContent(content.description, contentDiv);
  content.ctaRows.forEach((row) => appendContent(row, contentDiv));

  block.appendChild(bgDiv);
  block.appendChild(contentDiv);
}

function decorateTwoColoredRight(block, content, mediaElement) {
  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-two-colored-right-content';

  appendContent(content.heading, contentDiv, true);
  appendContent(content.description, contentDiv);
  content.ctaRows.forEach((row) => appendContent(row, contentDiv));

  const mediaDiv = document.createElement('div');
  mediaDiv.className = 'hero-two-colored-right-image';
  if (mediaElement) mediaDiv.appendChild(mediaElement);

  block.appendChild(contentDiv);
  block.appendChild(mediaDiv);
}

function decorateBlackColoredRight(block, content, mediaElement) {
  const contentDiv = document.createElement('div');
  contentDiv.className = 'hero-black-colored-right-content';

  const tagText = getTextValue(content.tag);
  if (tagText) {
    const tagVariation = getTextValue(content.tagVariation) || 'dark';
    const table = document.createElement('table');
    const tr1 = document.createElement('tr');
    tr1.appendChild(document.createElement('td')).textContent = `tag (${tagVariation})`;
    const tr2 = document.createElement('tr');
    tr2.appendChild(document.createElement('td')).textContent = tagText;
    table.append(tr1, tr2);
    contentDiv.appendChild(table);
  }

  if (content.eyebrow) {
    const eyebrowCell = getValueCell(content.eyebrow);
    const eyebrowText = eyebrowCell?.textContent?.trim();
    if (eyebrowText) {
      const eyebrowP = eyebrowCell.querySelector('p');
      const formatted = eyebrowDecorator(eyebrowP || eyebrowText, 'accent-color');
      if (formatted) contentDiv.appendChild(formatted);
    }
  }

  appendContent(content.heading, contentDiv, true);
  appendContent(content.description, contentDiv);
  content.ctaRows.forEach((row) => appendContent(row, contentDiv));
  decorateTags(contentDiv);

  const mediaDiv = document.createElement('div');
  mediaDiv.className = 'hero-black-colored-right-image';
  if (mediaElement) mediaDiv.appendChild(mediaElement);

  block.appendChild(contentDiv);
  block.appendChild(mediaDiv);
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
  const parsed = parseHeroRows(rows, { isBlackColoredRight });

  const mediaElement = parsed.media.type === 'video'
    ? buildVideoMedia(parsed.media, { background: !isBlackColoredRight && !isTwoColoredRight })
    : buildImageMedia(parsed.media, !isBlackColoredRight && !isTwoColoredRight);

  if (isBlackColoredRight) {
    decorateBlackColoredRight(block, parsed.content, mediaElement);
  } else if (isTwoColoredRight) {
    decorateTwoColoredRight(block, parsed.content, mediaElement);
  } else {
    decorateEmAccent(block, parsed.content, mediaElement);
  }

  rows.forEach((row) => row.remove());
}
