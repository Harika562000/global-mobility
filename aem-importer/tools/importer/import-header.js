import { createBlock } from './transformers/util.js';

function transform({ document, params, html }) {
  const elems = [];
  const url = new URL(params.originalURL);
  const path = url.pathname;
  const localePath = path.split('/').slice(0, 3).join('/');
  const siteName = path.split('/')[3];
  const siteNamePath = ['healthcare', 'supplychain'].includes(siteName) ? `${siteName}/` : '';

  const nav = document.getElementById('ups-navContainer');

  const skipNav = nav.querySelector('#ups-skipNav');
  skipNav?.remove();

  const barCode = nav.querySelector('#barcode-camera');
  barCode?.remove();

  const mobileRibbon = nav.querySelector('.navbar.util-nav.d-lg-none');
  mobileRibbon?.remove();

  const navBrand = nav.querySelector('#ups-header_logo');
  const navBrandImg = navBrand.querySelector('img');
  if (navBrandImg) {
    const brandImgSrc = navBrandImg.getAttribute('src');
    if (brandImgSrc === '/assets/resources/webcontent/images/ups-logo.svg') {
      const logo = document.createElement('span');
      logo.textContent = ':logo:';
      navBrandImg.replaceWith(logo);
    } else if (brandImgSrc === '/assets/resources/webcontent/healthcare/images/UPS_logo.svg') {
      navBrandImg.src = 'https://www.ups.com/assets/resources/webcontent/healthcare/images/UPS_Healthcare-Logo-Secondary-Horiz-RGB-2color-Blue_on_White.png';
    }
  }

  const brandRow = [[navBrand.cloneNode(true)]];
  const brandBlock = createBlock('Header Content', [brandRow], ['logo']);
  navBrand.replaceWith(brandBlock);

  const locator = nav.querySelector('.ups-location');
  if (locator) {
    locator.querySelector('.custom-icon-alert')?.remove();
    const locatorRow = [];
    if (locator.textContent.trim()) {
      locatorRow.push([locator.querySelector('a')]);
    } else {
      const p = document.createElement('p');
      p.textContent = 'Find UPS Closest Location';
      locatorRow.push([p]);
    }
    const locatorBlock = createBlock('Header Content', [locatorRow], ['locator']);
    locator.closest('nav').before(locatorBlock);
    locator.closest('nav').remove();
  }

  const ribbon = nav.querySelector('.ribbion-nav');
  if (ribbon) {
    ribbon.querySelectorAll('.nav-item').forEach((navItem) => {
      let block;
      if (navItem.classList.contains('header-alert-toggle')) {
        navItem.querySelector('.custom-icon-alert')?.remove();
        const alertRow = [[navItem.querySelector('a')]];
        block = createBlock('Header Content', [alertRow], ['alert']);
      } else if (navItem.classList.contains('ups-language')) {
        const langList = document.createElement('ul');
        navItem.querySelectorAll('.dropdown-menu a').forEach((a) => {
          const li = document.createElement('li');
          li.append(a);
          langList.append(li);
        });
        const langRow = [[langList]];
        block = createBlock('Header Content', [langRow], ['language']);
      } else {
        const utilRow = [];
        const dropDown = navItem.querySelector('.dropdown-menu');
        if (dropDown) {
          const ddTitle = navItem.querySelector('.dropdown-toggle').textContent;
          const ddTitleEl = document.createElement('p');
          ddTitleEl.textContent = ddTitle;

          const ddList = dropDown.querySelector('ul');
          utilRow.push([ddTitleEl, ddList]);
        } else {
          utilRow.push([navItem.querySelector('a')]);
        }
        block = createBlock('Header Content', [utilRow], ['utility-links']);
      }

      ribbon.before(block);
      navItem.remove();
    });
    ribbon.remove();
  }

  const mainNav = nav.querySelector('.main-nav');
  if (mainNav) {
    const navList = mainNav?.querySelector('ul');
    [...navList.children].forEach((navItem) => {
      const submenu = navItem.querySelector('.sub-menu');
      const rows = [];
      if (submenu) {
        const title = submenu.querySelector('.sub-menu-title');
        const titleEl = document.createElement('p');
        titleEl.textContent = title.textContent;
        submenu.querySelectorAll('.sub-menu-links').forEach((subMenu, i) => {
          const menuLinksRow = [[]];
          if (i === 0) {
            menuLinksRow[0].push(titleEl);
          }
          subMenu.querySelectorAll('a').forEach((a) => {
            const br = a.querySelector('br');
            if (br) {
              const iEl = br.nextSibling;
              br.remove();
              const em = document.createElement('em');
              em.textContent = iEl.textContent;
              iEl.replaceWith(em);
            }
          });
          menuLinksRow[0].push(subMenu);
          rows.push(menuLinksRow);
        });
      } else {
        const link = navItem.querySelector('a');
        rows.push([[link]]);
      }
      const block = createBlock('Header Content', rows);
      mainNav.before(block);
    });
    mainNav.remove();
  }

  const search = nav.querySelector('#ups-header-search');
  if (search) {
    const seachForm = search.querySelector('form.header-search');
    const searchLink = document.createElement('a');
    searchLink.href = seachForm.getAttribute('action');
    searchLink.textContent = searchLink.href.replace('http://localhost:3001', 'https://www.ups.com');

    const popTerms = document.createElement('ul');
    let popularTermsJson = {};
    const startIndex = html.indexOf('var popularTerms = ');
    if (startIndex > -1) {
      const endIndex = html.indexOf(';', startIndex);
      const popularTermsStr = html.substring(startIndex + 18, endIndex);
      popularTermsJson = JSON.parse(popularTermsStr);
      popularTermsJson?.popularTerms?.forEach((term) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = term.url;
        a.textContent = term.name;
        li.append(a);
        popTerms.append(li);
      });
    }

    const searchRow = [[searchLink], [popTerms]];
    const searchBlock = createBlock('Header Content', searchRow, ['search']);
    search.replaceWith(searchBlock);
  }

  const profile = nav.querySelector('.ups-user-actions');
  if (profile) {
    const profileRows = [];
    const loginLink = profile.querySelector('a');
    profileRows.push([[loginLink]]);

    if (siteNamePath === '') {
      const loggedInRow = [];
      const loggedInLinks = localePath.startsWith('/us') ? [
        { label: 'Account Dashboard', url: 'https://wwwapps.ups.com/ppc/dashboard.html?loc=locale#/dashBoard' },
        { label: 'View Shipping History', url: 'https://www.ups.com/ship/history?loc=locale' },
        { label: 'Accounts and Payment', url: 'https://wwwapps.ups.com/ppc/ppc.html/payment?loc=locale' },
        { label: 'View & Pay Bill', url: 'https://billing.ups.com/home' },
        { label: 'My Choice<sup>®</sup>', url: 'https://www.ups.com/us/en/track/ups-my-choice.page' },
        { label: 'My Choice<sup>®</sup> for Business', url: 'https://www.ups.com/us/en/business-solutions/inbound-outbound-shipments.page' },
        { label: 'Quantum View Administration', url: 'https://www.ups.com/qvadmin/admin?loc=locale' },
        { label: 'My Settings', url: 'https://www.campusship.ups.com/campusship/mysettings?loc=locale' },
        { label: 'Shipping Preferences', url: 'https://www.campusship.ups.com/cship/create?ActionOriginPair=PreferencesPage___StartSession&loc=locale' },
        { label: 'CampusShip Administration', url: 'https://www.campusship.ups.com/campusship/administration?loc=locale' },
        { label: 'Manage Returns', url: 'https://www.ups.com/shipping/returnsadmin?loc=locale' },
        { label: 'Log Out', url: 'https://www.ups.com/lasso/logout?returnto=/Home.page' },
      ] : [
        { label: 'My Profile', url: 'https://wwwapps.ups.com/ppc/ppc.html?loc=locale#/profilePage' },
        { label: 'Accounts and Payment', url: 'https://wwwapps.ups.com/ppc/ppc.html/payment?loc=locale' },
        { label: 'View & Pay Bill', url: 'https://billing.ups.com/home' },
        { label: 'My Choice<sup>®</sup>', url: 'https://www.ups.com/us/en/track/ups-my-choice.page' },
        { label: 'My Choice<sup>®</sup> for Business', url: 'https://www.ups.com/us/en/business-solutions/inbound-outbound-shipments.page' },
        { label: 'Quantum View Administration', url: 'https://www.ups.com/qvadmin/admin?loc=locale' },
        { label: 'My Settings', url: 'https://www.campusship.ups.com/campusship/mysettings?loc=locale' },
        { label: 'Shipping Preferences', url: 'https://www.campusship.ups.com/cship/create?ActionOriginPair=PreferencesPage___StartSession&loc=locale' },
        { label: 'CampusShip Administration', url: 'https://www.campusship.ups.com/campusship/administration?loc=locale' },
        { label: 'Manage Returns', url: 'https://www.ups.com/shipping/returnsadmin?loc=locale' },
        { label: 'Log Out', url: 'https://www.ups.com/lasso/logout?returnto=Home.page' },
      ];
      const loggedInList = document.createElement('ul');
      loggedInLinks.forEach((link) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = link.url;
        a.innerHTML = link.label;
        li.append(a);
        loggedInList.append(li);
      });
      loggedInRow.push(loggedInList);

      profileRows.push([loggedInRow]);
    }

    const profileBlock = createBlock('Header Content', profileRows, ['profile']);
    profile.replaceWith(profileBlock);
  }

  nav.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href.startsWith('/')) {
      a.href = `https://www.ups.com${href}`;
    }

    a.querySelectorAll('.ups-icon-link_newwindow').forEach((newWindow) => {
      newWindow.remove();
    });
    a.querySelectorAll('.sr-only').forEach((sr) => {
      sr.remove();
    });
  });

  elems.push({
    path: `/${localePath}/${siteNamePath}fragments/nav`,
    element: nav,
  });

  return elems;
}

export default {
  transform,
};
