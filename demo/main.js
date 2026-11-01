import '@catalystcommunity/design-tokens/src/tokens.css';
import './style.css';

import {BasicDataRegistry, SimpleRouter} from '../src/index.js';
import {defineComponents} from './components.js';
import {renderSection, sections} from './gallery.js';

const dataRegistryName = 'appDataRegistry';
const registry = new BasicDataRegistry();
window[dataRegistryName] = registry;

registry.AddDataFunction('demoMenuDataFunc', function menuDataFunc() {
  return {
    menuConfig: {
      logo: {text: 'Zest'},
      sections: [
        {
          display: 'Demo',
          icon: '/caldo.svg',
          link: '/',
          items: [
            {display: 'Bookings', link: '/bookings'},
          ],
        },
        {
          display: 'Component Gallery',
          icon: '/icons8-open-source-150.png',
          link: '/gallery',
          items: sections.map(section => ({display: section.title, link: `/gallery/${section.id}`})),
        },
      ],
      gutter: {
        overrideTemplateId: 'demo-gutter',
      },
    },
  };
});

defineComponents();

const router = new SimpleRouter();
const page = document.createElement('main');
page.id = 'page';
const context = {registry, router, onRoute: null};

// A page keeps its state while the route stays on it, so a hash change does not wipe its logs
let shownPage = null;
function showPage(name, render) {
  if (shownPage === name) { return; }
  shownPage = name;
  context.onRoute = null;
  page.replaceChildren(...render());
  page.scrollTop = 0;
}

function heading(text) {
  const element = document.createElement('h1');
  element.textContent = text;
  return element;
}

router.registerRoute('/', () => {
  showPage('home', () => {
    const intro = document.createElement('p');
    intro.textContent = 'This small application uses Zest components together: the menu is a two-tier-menu that '
      + 'gets its data from a data registry, and a simple-router shows each page.';
    return [heading('Zest demo'), intro];
  });
}, ['/home']);

router.registerRoute('/bookings', () => {
  showPage('bookings', () => {
    const label = document.createElement('p');
    label.textContent = 'Select a date for a booking:';
    const picker = document.createElement('date-time-picker');
    picker.dataset.testid = 'booking-picker';
    const output = document.createElement('p');
    output.dataset.testid = 'booking-output';
    output.textContent = 'No booking date.';
    picker.addEventListener('date-changed', (e) => {
      output.textContent = e.detail.date ? `Booking on ${e.detail.date.toDateString()}.` : 'No booking date.';
    });
    return [heading('Bookings'), label, picker, output];
  });
});

router.registerRoute('/gallery', (routeData, state, changeType) => {
  const section = sections.find(candidate => candidate.id === routeData.path.split('/')[2]);
  if (section) {
    showPage(`gallery-${section.id}`, () => [renderSection(section, context)]);
    context.onRoute?.(routeData, state, changeType);
  } else {
    showPage('gallery', () => [heading('Component gallery'), ...sections.map(item => renderSection(item, context))]);
  }
});

router.registerRoute('/notfound', () => {
  shownPage = null;
  page.replaceChildren(heading('Page not found'));
}, [], true);

// The menu items are plain links, so the application decides to route them without a page load.
// The path of the event finds a link inside a shadow root too.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { return; }
  const link = e.composedPath().find(node => node instanceof HTMLAnchorElement && node.href);
  if (!link || link.origin !== location.origin || link.target) { return; }
  // A link only to a hash on this page is a native navigation, and the router hears it
  if (link.pathname === location.pathname && link.hash) { return; }
  e.preventDefault();
  router.changePage(link.pathname + link.search + link.hash);
});

const menu = document.createElement('shadow-two-tier-menu');
menu.id = 'menu';
menu.setAttribute('registry-name', dataRegistryName);
menu.setAttribute('data-register-func-name', 'demoMenuDataFunc');

document.querySelector('#app').append(menu, page);
