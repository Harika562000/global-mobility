function animateCounter(element, targetValue, duration = 2000) {
  const numberMatch = targetValue.match(/(\d+)/);
  if (!numberMatch) return;

  const targetNumber = parseInt(numberMatch[0], 10);
  const suffix = targetValue.replace(numberMatch[0], '');
  // Create wrapper structure
  const wrapper = document.createElement('span');
  wrapper.className = 'numeralia-number-wrapper';
  const scrollContainer = document.createElement('span');
  scrollContainer.className = 'numeralia-number-scroll';

  const numbers = [];
  if (targetNumber < 10) {
    for (let i = 0; i <= targetNumber; i += 1) numbers.push(i);
  } else if (targetNumber <= 99) {
    for (let i = 0; i <= targetNumber; i += 1) numbers.push(i);
  } else {
    for (let i = 0; i <= targetNumber; i += 10) numbers.push(i);
    if (targetNumber % 10 !== 0) numbers.push(targetNumber);
  }

  const formatNum = (num) => {
    if (targetNumber < 10) return String(num);
    if (num < 10) return String(num).padStart(2, '0');
    return String(num);
  };

  const finalIndex = numbers.length - 1;
  numbers.forEach((num, idx) => {
    const numEl = document.createElement('span');
    numEl.className = 'numeralia-number-item';
    const isLast = idx === finalIndex;
    numEl.textContent = formatNum(num) + (isLast && suffix ? suffix : '');
    scrollContainer.appendChild(numEl);
  });
  wrapper.appendChild(scrollContainer);
  element.textContent = '';
  element.appendChild(wrapper);

  const stepDuration = duration / finalIndex;
  let currentIndex = 0;
  function animateStep() {
    if (currentIndex <= finalIndex) {
      scrollContainer.style.transform = `translateY(-${currentIndex * 100}%)`;
      currentIndex += 1;
      if (currentIndex <= finalIndex) {
        setTimeout(animateStep, stepDuration);
      }
    }
  }
  setTimeout(animateStep, 100);
}

function observeStats(statsSection) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const numbers = entry.target.querySelectorAll('.numeralia-number');
          numbers.forEach((numberEl) => {
            const targetValue = numberEl.getAttribute('data-target');
            if (targetValue && !numberEl.classList.contains('animated')) {
              numberEl.classList.add('animated');
              animateCounter(numberEl, targetValue);
            }
          });
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 },
  );

  observer.observe(statsSection);
}

function getValueCell(row) {
  if (!row) return null;
  return row.children.length > 1 ? row.children[1] : row.children[0] || row;
}

export default function decorate(block) {
  const children = [...block.children];
  if (children.length === 0) return;

  const statsSection = document.createElement('div');
  statsSection.className = 'stats';

  // Flat model: number1, description1, number2, description2, number3, description3
  const rows = children.map((row) => getValueCell(row));
  for (let i = 0; i < 6; i += 2) {
    const numberSource = rows[i];
    const descriptionSource = rows[i + 1];

    const numberText = numberSource?.textContent?.trim() || '';
    const descriptionHtml = descriptionSource?.innerHTML?.trim() || '';
    if (numberText || descriptionHtml) {
      const statItem = document.createElement('div');
      statItem.className = 'stat-item';

      const numberDiv = document.createElement('div');
      numberDiv.className = 'numeralia-number';
      numberDiv.setAttribute('data-target', numberText);
      statItem.append(numberDiv);

      const descriptionDiv = document.createElement('div');
      descriptionDiv.className = 'numeralia-description';
      descriptionDiv.innerHTML = descriptionHtml;
      statItem.append(descriptionDiv);

      statsSection.append(statItem);
    }
  }

  block.textContent = '';
  block.appendChild(statsSection);

  observeStats(statsSection);
  block.dispatchEvent(new CustomEvent('numeralia:decorated', { bubbles: true }));
}
