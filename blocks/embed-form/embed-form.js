import { eyebrowDecorator } from '../../scripts/scripts.js';
import { fetchForm, createForm, loadFormBlockStyles } from '../form/form.js';

// Reroute .af.dermis calls to the AEM publisher (main-thread fetches only)
const AF_PUBLISH_BASE = 'https://publish-p184787-e1941710.adobeaemcloud.com'; // Change as needed
(function interceptAfDermisFetch() {
  const originalFetch = window.fetch;
  window.fetch = function afDermisFetch(...args) {
    const [url, options] = args;
    let urlStr = '';
    if (typeof url === 'string') {
      urlStr = url;
    } else if (url instanceof Request) {
      urlStr = url.url;
    }
    if (urlStr.includes('.af.dermis')) {
      let newUrl;
      try {
        const u = new URL(urlStr, window.location.origin);
        newUrl = AF_PUBLISH_BASE + u.pathname + u.search;
      } catch (e) {
        newUrl = AF_PUBLISH_BASE + urlStr;
      }
      const rerouted = url instanceof Request ? new Request(newUrl, url) : newUrl;
      return originalFetch(rerouted, options);
    }
    return originalFetch.apply(this, args);
  };
}());

// Panels with these names are NOT steps (hidden, success, error)
const NON_STEP_PANEL_NAMES = [
  'form_fragment_hidden',
  'form_fragment_success',
  'form_fragment_error',
];

function initStepDots(form) {
  const allPanels = [...form.querySelectorAll(':scope > .panel-wrapper')];
  const stepPanels = allPanels.filter((p) => {
    const name = p.getAttribute('name') || '';
    return !NON_STEP_PANEL_NAMES.includes(name);
  });

  if (stepPanels.length <= 1) return;

  const stepsContainer = document.createElement('div');
  stepsContainer.className = 'form-steps';

  stepPanels.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = `step-dot${i === 0 ? ' active' : ''}`;
    stepsContainer.append(dot);
  });

  form.append(stepsContainer);

  // Hide dots when a success or error panel becomes visible
  const terminalPanels = [...form.querySelectorAll(':scope > .panel-wrapper')].filter(
    (p) => !stepPanels.includes(p),
  );
  if (terminalPanels.length) {
    const visibilityObserver = new MutationObserver(() => {
      const terminalVisible = terminalPanels.some(
        (p) => p.dataset.visible === 'true' || p.style.display !== 'none',
      );
      stepsContainer.setAttribute('data-visible', !terminalVisible);
    });
    terminalPanels.forEach((p) => {
      visibilityObserver.observe(p, { attributes: true, attributeFilter: ['data-visible', 'style'] });
    });
  }

  // Update dots based on which panel is actually visible
  // This ensures dots only move when validation passes and panel actually switches
  const updateDotsBasedOnVisibility = () => {
    // Find the panel that is NOT hidden (data-visible != 'false')
    const visiblePanel = stepPanels.find(
      (p) => p.dataset.visible !== 'false',
    );
    if (!visiblePanel) return;

    const visibleIndex = stepPanels.indexOf(visiblePanel);
    stepsContainer.querySelectorAll('.step-dot').forEach((dot, idx) => {
      dot.classList.toggle('active', idx === visibleIndex);
    });
  };

  // Watch for panel visibility changes and update dots accordingly
  const panelVisibilityObserver = new MutationObserver(() => {
    updateDotsBasedOnVisibility();
  });

  stepPanels.forEach((panel) => {
    panelVisibilityObserver.observe(panel, {
      attributes: true,
      attributeFilter: ['data-visible', 'style'],
    });
  });

  // Set initial dot state
  updateDotsBasedOnVisibility();
}

function initFloatingLabels(form) {
  const fieldWrappers = [
    ...form.querySelectorAll('.text-wrapper, .email-wrapper'),
  ];
  const syncFns = [];
  fieldWrappers.forEach((wrapper) => {
    const input = wrapper.querySelector('input');
    const label = wrapper.querySelector('label');
    if (!input || !label) return;

    const syncState = () => {
      wrapper.classList.toggle('has-value', input.value.trim() !== '');
    };

    input.addEventListener('input', syncState);
    input.addEventListener('change', syncState);
    syncFns.push(syncState);
    syncState();
  });

  // The rule engine sets prefill values programmatically (no DOM events).
  // Re-sync once the worker signals all initial values are applied (removes 'loading').
  if (form.classList.contains('loading')) {
    const observer = new MutationObserver(() => {
      if (!form.classList.contains('loading')) {
        observer.disconnect();
        syncFns.forEach((fn) => fn());
      }
    });
    observer.observe(form, { attributes: true, attributeFilter: ['class'] });
  }

  // Also re-sync when panels become visible, as values may have been
  // populated programmatically by the rule engine in hidden panels.
  const panels = [...form.querySelectorAll(':scope > .panel-wrapper')];
  if (panels.length > 1) {
    const panelObserver = new MutationObserver(() => {
      syncFns.forEach((fn) => fn());
    });
    panels.forEach((panel) => {
      panelObserver.observe(panel, { attributes: true, attributeFilter: ['data-visible', 'style'] });
    });
  }
}

function initCustomDropdowns(form) {
  form.querySelectorAll('.drop-down-wrapper select').forEach((select) => {
    const wrapper = select.parentElement;
    const options = [...select.options].filter((opt) => !opt.disabled);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'custom-select-value';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.append(valueSpan);
    trigger.insertAdjacentHTML(
      'beforeend',
      '<svg class="custom-select-chevron" viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    );

    const panel = document.createElement('ul');
    panel.className = 'custom-select-panel';
    panel.setAttribute('role', 'listbox');
    options.forEach((opt) => {
      const li = document.createElement('li');
      li.className = 'custom-select-option';
      li.setAttribute('role', 'option');
      li.dataset.value = opt.value;
      li.textContent = opt.text;
      panel.append(li);
    });

    const customSelect = document.createElement('div');
    customSelect.className = 'custom-select';
    customSelect.append(trigger, panel);

    // Keep native select in DOM (AEM needs it); hide it visually
    select.style.display = 'none';
    select.setAttribute('aria-hidden', 'true');
    select.insertAdjacentElement('afterend', customSelect);

    const syncState = () => {
      const sel = options.find((o) => o.value === select.value);
      valueSpan.textContent = sel ? sel.text : '';
      wrapper.classList.toggle('has-value', !!sel);
      panel.querySelectorAll('.custom-select-option').forEach((li) => {
        li.classList.toggle('selected', li.dataset.value === select.value);
        li.setAttribute('aria-selected', String(li.dataset.value === select.value));
      });
    };
    syncState();
    select.addEventListener('change', syncState);

    // Re-sync after rule engine applies prefill values (removes 'loading' class).
    if (form.classList.contains('loading')) {
      const observer = new MutationObserver(() => {
        if (!form.classList.contains('loading')) {
          observer.disconnect();
          syncState();
        }
      });
      observer.observe(form, { attributes: true, attributeFilter: ['class'] });
    }

    const closeDropdown = () => {
      customSelect.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      wrapper.classList.remove('is-open');
    };
    const openDropdown = () => {
      customSelect.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      wrapper.classList.add('is-open');
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (customSelect.classList.contains('open')) closeDropdown();
      else openDropdown();
    });

    panel.addEventListener('click', (e) => {
      const li = e.target.closest('.custom-select-option');
      if (!li) return;
      select.value = li.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncState();
      closeDropdown();
    });

    document.addEventListener('click', () => closeDropdown());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDropdown(); });
  });
}

function initConnectPanel(form) {
  const panel = form.querySelector('.field-connect-panel');
  if (!panel) return;

  const radioGroup = panel.querySelector('.field-radio-preference');
  if (!radioGroup) return;

  const radioWrappers = [...radioGroup.querySelectorAll('.radio-wrapper')];

  // Match each radio value to its field wrapper
  const fieldMap = {
    email: panel.querySelector('.field-contact-email'),
    phone: panel.querySelector('.field-contact-phone'),
  };

  // Build paired rows: [radio] [field]
  const pairsContainer = document.createElement('div');
  pairsContainer.className = 'connect-pairs';

  radioWrappers.forEach((radioWrapper) => {
    const radioInput = radioWrapper.querySelector('input[type="radio"]');
    const fieldWrapper = fieldMap[radioInput?.value];
    if (!fieldWrapper) return;

    const row = document.createElement('div');
    row.className = 'connect-row';
    row.dataset.mode = radioInput.value;
    row.append(radioWrapper, fieldWrapper);
    pairsContainer.append(row);
  });

  // Keep the fieldset in the DOM (it is the .field-wrapper ancestor the rule engine
  // relies on for radio inputs). Clear its children and put pairsContainer inside it.
  const legend = radioGroup.querySelector(':scope > legend');
  radioGroup.replaceChildren(...(legend ? [legend] : []), pairsContainer);

  const syncState = () => {
    pairsContainer.querySelectorAll('.connect-row').forEach((row) => {
      const radioInput = row.querySelector('input[type="radio"]');
      const fieldInput = row.querySelector('input:not([type="radio"])');
      const isActive = radioInput?.checked;
      if (fieldInput) fieldInput.disabled = !isActive;
      row.classList.toggle('is-disabled', !isActive);
    });
  };

  panel.addEventListener('change', (e) => {
    if (e.target.type === 'radio') syncState();
  });

  // Default to first radio (email) if nothing is pre-checked
  const anyChecked = radioWrappers.some((rw) => rw.querySelector('input[type="radio"]')?.checked);
  if (!anyChecked) {
    const firstRadio = radioWrappers[0]?.querySelector('input[type="radio"]');
    if (firstRadio) firstRadio.checked = true;
  }
  syncState();
}

function injectPanelIcon(form, panelName, iconName) {
  const panel = form.querySelector(`fieldset[name="${panelName}"]`);
  if (!panel) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'image-wrapper';

  const img = document.createElement('img');
  img.src = `${window.hlx?.codeBasePath || ''}/icons/${iconName}.svg`;
  img.alt = '';
  wrapper.append(img);

  const firstText = panel.querySelector('.plain-text-wrapper');
  if (firstText) {
    panel.insertBefore(wrapper, firstText);
  } else {
    panel.prepend(wrapper);
  }
}

function initFormButtons(form) {
  form.querySelectorAll('.button-wrapper button').forEach((btn) => {
    const isSubmit = btn.closest('.submit-wrapper') !== null || btn.type === 'submit';
    const label = btn.textContent.trim();

    const a = document.createElement('a');
    a.href = '#';
    a.className = `button ${isSubmit ? 'primary' : 'secondary'}`;
    a.textContent = label;
    a.title = label;
    a.setAttribute('aria-label', label);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      btn.click();
    });

    // Keep original button in DOM (hidden) so AEM's event handlers remain attached
    btn.setAttribute('aria-hidden', 'true');
    btn.insertAdjacentElement('beforebegin', a);
  });
}

export function initEmbedFormDomEnhancements(formEl) {
  if (!formEl) return;
  initStepDots(formEl);
  initFloatingLabels(formEl);
  initCustomDropdowns(formEl);
  initConnectPanel(formEl);
  initFormButtons(formEl);
  injectPanelIcon(formEl, 'form_fragment_success', 'check-mark');
  injectPanelIcon(formEl, 'form_fragment_error', 'x-mark');
}

export default async function decorate(block) {
  const rows = [...block.children];
  if (rows.length === 0) return;

  const [logoRow, eyebrowRow, headlineRow, descriptionRow] = rows;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';

  if (logoRow) {
    logoRow.classList.add('logo');
    contentDiv.append(logoRow);
  }
  if (eyebrowRow) {
    const eyebrow = eyebrowDecorator(eyebrowRow);
    if (eyebrow) {
      contentDiv.append(eyebrow);
    } else {
      contentDiv.append(eyebrowRow);
    }
  }
  if (headlineRow) {
    headlineRow.classList.add('headline');
    contentDiv.append(headlineRow);
  }
  if (descriptionRow) {
    descriptionRow.classList.add('description');
    contentDiv.append(descriptionRow);
  }

  const formDiv = document.createElement('div');
  formDiv.className = 'form';

  block.replaceChildren(contentDiv, formDiv);

  // The 5th row contains the "Adaptive Form" aem-content reference field,
  // serialised by EDS as an <a href> link to the form path.
  const formLinkRow = rows[4];
  const formLink = formLinkRow?.querySelector('a[href]');
  if (formLink?.href) {
    block.dataset.embedFormDefinitionUrl = formLink.href;
  }

  if (formLink) {
    const formDef = await fetchForm(formLink.href);
    if (formDef) {
      loadFormBlockStyles(formDef);
      const afModule = await import('../form/rules/index.js');
      if (afModule?.initAdaptiveForm) {
        const form = await afModule.initAdaptiveForm(formDef, createForm);
        if (form) formDiv.append(form);
      }
    }
  }

  // Initialise step dots, floating labels and button anchors once the adaptive form has rendered.
  const formEl = formDiv.querySelector('form');
  if (formEl) {
    initEmbedFormDomEnhancements(formEl);
  } else {
    const observer = new MutationObserver(() => {
      const rendered = formDiv.querySelector('form');
      if (rendered) {
        observer.disconnect();
        initEmbedFormDomEnhancements(rendered);
      }
    });
    observer.observe(formDiv, { childList: true, subtree: true });
  }

  block.dispatchEvent(new CustomEvent('embed-form:decorated', { bubbles: true }));
}
