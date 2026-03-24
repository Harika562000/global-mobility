/*
 * Video Block (UE)
 * Show a video referenced by a link.
 * UE model field order: uri, classes, placeholder_image, placeholder_imageAlt.
 * https://www.hlx.live/developer/block-collection/video
 */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
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
    suffix = `&${Object.entries(suffixParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  }
  let vid = usp.get('v') ? encodeURIComponent(usp.get('v')) : '';
  const embed = url.pathname;
  if (url.origin.includes('youtu.be')) {
    [, vid] = url.pathname.split('/');
  }

  const temp = document.createElement('div');
  temp.innerHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
      <iframe src="https://www.youtube.com${vid ? `/embed/${vid}?rel=0&v=${vid}${suffix}` : embed}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" 
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; picture-in-picture" allowfullscreen="" scrolling="no" title="Content from Youtube" loading="lazy"></iframe>
    </div>`;
  return temp.children.item(0);
}

function embedVimeo(url, autoplay, background) {
  const [, video] = url.pathname.split('/');
  let suffix = '';
  if (background || autoplay) {
    const suffixParams = {
      autoplay: autoplay ? '1' : '0',
      background: background ? '1' : '0',
    };
    suffix = `?${Object.entries(suffixParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  }
  const temp = document.createElement('div');
  temp.innerHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
      <iframe src="https://player.vimeo.com/video/${video}${suffix}" 
      style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" 
      frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen  
      title="Content from Vimeo" loading="lazy"></iframe>
    </div>`;
  return temp.children.item(0);
}

function getVideoElement(source, autoplay, background) {
  const video = document.createElement('video');
  video.setAttribute('controls', '');
  if (autoplay) video.setAttribute('autoplay', '');
  if (background) {
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    video.removeAttribute('controls');
    video.addEventListener('canplay', () => {
      video.muted = true;
      if (autoplay) video.play();
    });
  }

  const sourceEl = document.createElement('source');
  sourceEl.setAttribute('src', source);
  sourceEl.setAttribute('type', `video/${source.split('.').pop()}`);
  video.append(sourceEl);

  return video;
}

function createAutoplayVideo(source) {
  const video = document.createElement('video');
  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.setAttribute('preload', 'auto');
  video.muted = true;

  const sourceEl = document.createElement('source');
  sourceEl.setAttribute('src', source);
  sourceEl.setAttribute('type', `video/${source.split('.').pop()}`);
  video.append(sourceEl);
  return video;
}

const loadVideoEmbed = (block, link, autoplay, background) => {
  if (block.dataset.embedLoaded === 'true') {
    return;
  }
  const url = new URL(link);

  const isYoutube = link.includes('youtube') || link.includes('youtu.be');
  const isVimeo = link.includes('vimeo');

  if (isYoutube) {
    const embedWrapper = embedYoutube(url, autoplay, background);
    block.append(embedWrapper);
    embedWrapper.querySelector('iframe').addEventListener('load', () => {
      block.dataset.embedLoaded = true;
    });
  } else if (isVimeo) {
    const embedWrapper = embedVimeo(url, autoplay, background);
    block.append(embedWrapper);
    embedWrapper.querySelector('iframe').addEventListener('load', () => {
      block.dataset.embedLoaded = true;
    });
  } else {
    const videoEl = getVideoElement(link, autoplay, background);
    block.append(videoEl);
    videoEl.addEventListener('canplay', () => {
      block.dataset.embedLoaded = true;
    });
  }
};

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  let link = '';
  let placeholder = null;
  let hasAutoplay = false;
  let placeholderAlt = '';

  if (rows.length >= 1) {
    const [uriRow, placeholderRow, altRow] = rows;
    const uriCell = getValueCell(uriRow);
    const uriScope = uriCell || uriRow;
    const anchor = uriScope?.querySelector('a');
    link = anchor ? anchor.href : (uriScope?.textContent?.trim() || '');
    hasAutoplay = block.classList.contains('autoplay');
    if (placeholderRow) {
      const placeCell = getValueCell(placeholderRow);
      const scope = placeCell || placeholderRow;
      const pic = scope.querySelector('picture');
      if (pic) placeholder = pic.cloneNode(true);
      else {
        const img = scope.querySelector('img');
        if (img) {
          placeholder = document.createElement('picture');
          placeholder.appendChild(img.cloneNode(true));
        }
      }
    }
    if (altRow) {
      const altCell = getValueCell(altRow);
      placeholderAlt = (altCell || altRow).textContent?.trim() || '';
    }

    block.textContent = '';
    if (hasAutoplay) block.classList.add('autoplay');
    if (link) {
      const a = document.createElement('a');
      a.href = link;
      block.appendChild(a);
    }
    if (placeholder) {
      if (placeholderAlt && placeholder.querySelector('img')) {
        placeholder.querySelector('img').setAttribute('alt', placeholderAlt);
      }
      block.appendChild(placeholder);
    }
  } else {
    const anchor = block.querySelector('a');
    link = anchor ? anchor.href : '';
    placeholder = block.querySelector('picture');
    hasAutoplay = block.classList.contains('autoplay');
  }

  block.querySelector('a')?.remove();
  block.dataset.embedLoaded = false;
  const section = block.closest('.section.video-container');
  placeholder = block.querySelector('picture');

  const isEmbedVideo = section && section.querySelector('.embed-video');
  const hasSectionTitle = section && section.querySelector(':scope > .section-title-wrapper');

  if (isEmbedVideo && hasSectionTitle) {
    const videoWrapperEl = section.querySelector(':scope > .video-wrapper');
    const sectionTitleEl = section.querySelector(':scope > .section-title-wrapper');
    if (videoWrapperEl && sectionTitleEl) {
      section.insertBefore(sectionTitleEl, videoWrapperEl);
    }
  } else if (section && !isEmbedVideo && hasSectionTitle) {
    const videoWrapperEl = section.querySelector(':scope > .video-wrapper');
    if (videoWrapperEl) {
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'video-content-wrapper';
      [...section.children].forEach((child) => {
        if (!child.classList.contains('video-wrapper')) {
          contentWrapper.append(child);
        }
      });
      section.insertBefore(contentWrapper, videoWrapperEl);
    }

    const eyebrow = section.querySelector('.eye-brow-text.accent-color.margin-bottom-400');
    if (eyebrow) eyebrow.classList.remove('accent-color', 'margin-bottom-400');

    const ext = link ? link.split('.').pop().toLowerCase() : '';

    if (link && ext === 'mp4') {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          block.classList.remove('autoplay');
          block.querySelector('picture')?.remove();
          const videoEl = createAutoplayVideo(link);
          block.append(videoEl);
          videoEl.load();
          block.dataset.embedLoaded = true;
        }
      });
      observer.observe(block);
    } else if (link && (ext === 'gif' || ext === 'webp')) {
      const img = document.createElement('img');
      img.src = link;
      img.setAttribute('loading', 'lazy');
      img.setAttribute('alt', '');
      block.append(img);
      block.dataset.embedLoaded = true;
    } else if (placeholder) {
      block.append(placeholder);
      block.dataset.embedLoaded = true;
    }
    return;
  }

  const autoplay = block.classList.contains('autoplay');
  const showControls = block.classList.contains('show-controls');
  const background = autoplay && !showControls;

  if (placeholder) {
    block.classList.add('placeholder');
    const wrapper = document.createElement('div');
    wrapper.className = 'video-placeholder';
    wrapper.append(placeholder);

    if (!autoplay) {
      wrapper.insertAdjacentHTML(
        'beforeend',
        '<div class="video-placeholder-play"><button type="button" title="Play"></button></div>',
      );
      wrapper.addEventListener('click', () => {
        wrapper.remove();
        loadVideoEmbed(block, link, true, false);
      });
    }
    block.append(wrapper);
  }

  if (!placeholder || autoplay) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        const playOnLoad = autoplay && !prefersReducedMotion.matches;
        loadVideoEmbed(block, link, playOnLoad, background);
      }
    });
    observer.observe(block);
  }
}
