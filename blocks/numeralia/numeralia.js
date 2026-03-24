function animateCounter(element, targetValue, duration = 2000) {
  const numberMatch = targetValue.match(/(\d+)/);
  if (!numberMatch) return;

  const targetNumber = parseInt(numberMatch[0], 10);
  const suffix = targetValue.replace(numberMatch[0], '');
  // Create wrapper structure
  const wrapper = document.createElement('span');
  wrapper.className = 'number-wrapper';
  const scrollContainer = document.createElement('span');
  scrollContainer.className = 'number-scroll';
  // Generate all numbers from 0 to target (in steps of 10)
  const numbers = [];
  for (let i = 0; i <= targetNumber; i += 10) {
    numbers.push(i);
  }
  // Add final number if it's not a multiple of 10
  if (targetNumber % 10 !== 0) {
    numbers.push(targetNumber);
  }
  // Create number elements
  numbers.forEach((num) => {
    const numEl = document.createElement('span');
    numEl.className = 'number-item';
    numEl.textContent = num.toString().padStart(2, '0');
    scrollContainer.appendChild(numEl);
  });
  wrapper.appendChild(scrollContainer);
  element.textContent = '';
  element.appendChild(wrapper);

  // Animate, then append suffix only after reaching the final value
  const finalIndex = numbers.length - 1;
  const stepDuration = duration / finalIndex;
  let currentIndex = 0;
  function animateStep() {
    if (currentIndex <= finalIndex) {
      scrollContainer.style.transform = `translateY(-${currentIndex * 100}%)`;
      currentIndex += 1;
      if (currentIndex <= finalIndex) {
        setTimeout(animateStep, stepDuration);
      } else if (suffix) {
        const suffixEl = document.createElement('span');
        suffixEl.className = 'number-suffix';
        suffixEl.textContent = suffix;
        element.appendChild(suffixEl);
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
          const numbers = entry.target.querySelectorAll('.number');
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
      numberDiv.className = 'number';
      numberDiv.setAttribute('data-target', numberText);
      statItem.append(numberDiv);

      const descriptionDiv = document.createElement('div');
      descriptionDiv.className = 'description';
      descriptionDiv.innerHTML = descriptionHtml;
      statItem.append(descriptionDiv);

      statsSection.append(statItem);
    }
  }

  block.textContent = '';
  block.appendChild(statsSection);

  observeStats(statsSection);
}
