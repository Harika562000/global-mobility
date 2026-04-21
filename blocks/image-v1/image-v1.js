function isExternalUrl(href) {
  try {
    const url = new URL(href, window.location.origin);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const figure = document.createElement('figure');
  figure.classList.add('image-v1-figure');

  // Row 0: image (rendered as <picture> by EDS; alt text already set on <img>)
  const picture = rows[0]?.querySelector('picture');

  // Row 1: caption (optional)
  const captionText = rows[1]?.textContent?.trim();

  // Row 2: image link (optional, rendered as <a> by EDS via aem-content)
  const linkHref = rows[2]?.querySelector('a')?.href || rows[2]?.textContent?.trim();

  if (picture) {
    if (linkHref) {
      const anchor = document.createElement('a');
      anchor.href = linkHref;
      if (isExternalUrl(linkHref)) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
      anchor.appendChild(picture);
      figure.appendChild(anchor);
    } else {
      figure.appendChild(picture);
    }
  }

  if (captionText) {
    const figcaption = document.createElement('figcaption');
    figcaption.classList.add('image-v1-caption');
    figcaption.textContent = captionText;
    figure.appendChild(figcaption);
  }

  block.innerHTML = '';
  block.appendChild(figure);
}
