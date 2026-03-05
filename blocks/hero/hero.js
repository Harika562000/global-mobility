import { eyebrowDecorator } from '../../scripts/scripts.js';
import { decorateButtons } from '../../scripts/aem.js';
 
export default function decorate(block) {
  const heading = block.querySelector('h1, h2, h3, h4, h5, h6');
  if (!heading) return;
 
  /* Inject hero-section class so block CSS stays decoupled from global section classes */
  const section = block.closest('.section');
  if (section && section.classList.contains('bg-light-grey')) {
    section.classList.add('hero-section');
  }
 
  const isBlackColoredRight = block.classList.contains('hero-black-colored-right');
  const isTwoColoredRight = block.classList.contains('hero-two-colored-right');
  const isEmAccent = !isTwoColoredRight && heading.querySelector('em') !== null;
 
  let imageWrapper = null;
 
  if (isBlackColoredRight) {
    const allParagraphs = block.querySelectorAll('p');
    let imageParagraph = null;
 
    allParagraphs.forEach((p) => {
      if (p.querySelector('picture')) {
        imageParagraph = p;
      }
    });
 
    if (imageParagraph) {
      const picture = imageParagraph.querySelector('picture');
      if (picture) {
        picture.remove();
        if (!imageParagraph.textContent.trim()) {
          imageParagraph.remove();
        }
        imageWrapper = document.createElement('div');
        imageWrapper.className = 'hero-black-colored-right-image';
        imageWrapper.appendChild(picture);
      }
    }
  } else {
    let pictureHeading = heading;
    if (isTwoColoredRight) {
      const allHeadings = block.querySelectorAll('h1, h2, h3, h4, h5, h6');
      allHeadings.forEach((h) => {
        if (h.querySelector('picture')) {
          pictureHeading = h;
        }
      });
    }
 
    const picture = pictureHeading.querySelector('picture');
    if (picture) {
      picture.remove();
 
      if (isEmAccent) {
        imageWrapper = document.createElement('div');
        imageWrapper.className = 'hero-em-accent-background';
        imageWrapper.appendChild(picture);
      } else if (isTwoColoredRight) {
        imageWrapper = document.createElement('div');
        imageWrapper.className = 'hero-two-colored-right-image';
        imageWrapper.appendChild(picture);
      }
    }
  }
 
  const contentWrapper = document.createElement('div');
  if (isEmAccent) {
    contentWrapper.className = 'hero-em-accent-content';
  } else if (isTwoColoredRight) {
    contentWrapper.className = 'hero-two-colored-right-content';
  } else if (isBlackColoredRight) {
    contentWrapper.className = 'hero-black-colored-right-content';
  }
 
  /* Flatten nested AEM div structure into content wrapper */
  const children = Array.from(block.children);
  children.forEach((child) => {
    if (child !== imageWrapper && !child.classList.contains('hero-em-accent-background') && !child.classList.contains('hero-two-colored-right-image') && !child.classList.contains('hero-black-colored-right-image')) {
      if (child.tagName === 'DIV') {
        const nestedChildren = Array.from(child.children);
        nestedChildren.forEach((nestedChild) => {
          if (nestedChild.tagName === 'DIV') {
            const deepChildren = Array.from(nestedChild.children);
            deepChildren.forEach((deepChild) => {
              contentWrapper.appendChild(deepChild);
            });
          } else {
            contentWrapper.appendChild(nestedChild);
          }
        });
      } else {
        contentWrapper.appendChild(child);
      }
    }
  });
 
  const allParagraphs = contentWrapper.querySelectorAll('p');
  let eyebrowElement = null;
 
  allParagraphs.forEach((p) => {
    const noPicture = !p.querySelector('picture');
    const noButton = !p.querySelector('a.button');
    const noStrong = !p.querySelector('strong');
    const noEm = !p.querySelector('em');
    const noEyebrowClass = !p.classList.contains('eye-brow-text');
    if (noPicture && noButton && noStrong && noEm && noEyebrowClass) {
      const headingElement = contentWrapper.querySelector('h1, h2, h3, h4, h5, h6');
      const pos = p.compareDocumentPosition(headingElement);
      const isFollowing = Math.floor(pos / Node.DOCUMENT_POSITION_FOLLOWING) % 2 === 1;
      if (headingElement && isFollowing) {
        eyebrowElement = p;
      }
    }
  });
 
  if (eyebrowElement) {
    const eyebrowText = eyebrowElement.textContent.trim();
    if (eyebrowText) {
      const formattedEyebrow = eyebrowDecorator(eyebrowElement, 'accent-color');
      if (formattedEyebrow) {
        eyebrowElement.replaceWith(formattedEyebrow);
      }
    }
  }
 
  block.innerHTML = '';
 
  if (isEmAccent) {
    if (imageWrapper) {
      block.appendChild(imageWrapper);
    }
    block.appendChild(contentWrapper);
  } else if (isTwoColoredRight || isBlackColoredRight) {
    block.appendChild(contentWrapper);
    if (imageWrapper) {
      block.appendChild(imageWrapper);
    }
  }
 
  if (isEmAccent || isBlackColoredRight) {
    const paragraphs = contentWrapper.querySelectorAll('p');
    paragraphs.forEach((p) => {
      if (p.querySelector('a')) return;
 
      const strong = p.querySelector('strong');
      if (strong && !strong.querySelector('a') && isEmAccent) {
        const buttonText = strong.textContent.trim();
        if (buttonText) {
          const link = document.createElement('a');
          link.href = '#';
          link.title = buttonText;
          link.textContent = buttonText;
          strong.innerHTML = '';
          strong.appendChild(link);
        }
      }
 
      const em = p.querySelector('em');
      if (em && isBlackColoredRight && !em.querySelector('a')) {
        const buttonText = em.textContent.trim();
        if (buttonText) {
          const link = document.createElement('a');
          link.href = '#';
          link.title = buttonText;
          link.textContent = buttonText;
          em.innerHTML = '';
          em.appendChild(link);
        }
      }
    });
 
    decorateButtons(contentWrapper);
 
    const allButtons = [...contentWrapper.querySelectorAll('a.button')];
    if (isEmAccent) {
      allButtons.forEach((button, index) => {
        if (index === 0) {
          button.classList.remove('secondary', 'inverted');
          button.classList.add('primary');
        } else if (index === 1) {
          button.classList.remove('primary', 'secondary');
          button.classList.add('inverted');
        }
      });
    }
  }
}
