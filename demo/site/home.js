// The home page of the demo site: what Zest is, a live component and its source, and where to go next.
// The page uses Zest components itself.
import {showNotice} from '../../src/index.js';
import {el} from '../kit.js';
import {examples} from '../examples/index.js';
import {TemperatureConverter} from './temperature-converter.js';
import converterSource from './temperature-converter.js?raw';

const INSTALL = 'npm install @catalystcommunity/zest';

const FAMILIES = [
  {id: 'controls', title: 'Controls', text: 'Buttons, check boxes, switches, radio groups, text fields, spin boxes, sliders, combo boxes, and list boxes. Each one operates in a form.'},
  {id: 'containers', title: 'Containers', text: 'Group boxes, tabs, splitters, accordions, dialogs, floating windows, status bars, and layouts.'},
  {id: 'menus', title: 'Menus', text: 'Menu bars, popup and context menus, toolbars that move extra items into a menu, tooltips, and notices.'},
  {id: 'actions', title: 'Actions', text: 'One command with a label, a shortcut, and a state, for menus, toolbars, and keys together.'},
  {id: 'data-views', title: 'Data views', text: 'Lists, trees, and tables that make only the rows that you can see.'},
  {id: 'spreadsheet', title: 'Spreadsheet', text: 'Typed cells, formulas, undo, copy and paste, and the keyboard of a spreadsheet application.'},
  {id: 'media', title: 'Media', text: 'Video and audio players with accessible controls, a canvas view, and an image view.'},
  {id: 'calendar-view', title: 'Dates and times', text: 'A calendar with day, week, and month views, and a date and time picker for each locale.'},
  {id: 'base-components', title: 'Base components', text: 'Typed properties, renders in the next frame, shared observers, and cleanup on disconnect.'},
];

const MEASUREMENTS = [
  {name: 'Components nested in one tree', value: '1,000 levels connect in 3.5 ms'},
  {name: 'Events that bubble through 20 levels', value: 'About 290,000 each second'},
  {name: 'Calls through the event broker', value: 'About 2,000,000 each second'},
  {name: 'Renders for 50,000 changes to 500 components', value: '500, one for each component'},
  {name: 'Controls on one page', value: '10,000 open in about 0.9 s'},
  {name: 'A list of 1,000,000 items', value: 'Opens in about 1 ms'},
];

function link(href, text, className = 'site-link') {
  return el('a', {href, class: className}, text);
}

function hero() {
  return el('header', {class: 'site-hero'},
    el('h1', {}, 'Zest'),
    el('p', {class: 'site-lead'},
      'Web components for applications. Make a page as you make a desktop application: '
      + 'put controls in containers, connect them to actions, and let each component paint only when it changes.'),
    el('p', {class: 'site-lead'}, 'Zest needs no framework and no build step. Each component is a standard custom element.'),
    el('div', {class: 'site-actions'},
      link('/gallery', 'Open the component gallery', 'site-link primary'),
      link('/examples', 'See the examples')));
}

function liveExample() {
  if (!customElements.get('temperature-converter')) {
    customElements.define('temperature-converter', TemperatureConverter);
  }
  const tabs = el('tab-view', {label: 'A Zest component', 'data-testid': 'site-live'},
    el('tab-page', {label: 'Result'},
      el('p', {}, 'Change one value. The other value follows.'),
      el('temperature-converter', {'data-testid': 'site-converter'})),
    el('tab-page', {label: 'Source'},
      el('pre', {class: 'site-code', tabindex: '0', 'aria-label': 'The source of the temperature converter'},
        el('code', {}, converterSource))));
  return el('section', {class: 'site-section', 'aria-labelledby': 'site-live-heading'},
    el('h2', {id: 'site-live-heading'}, 'Write a component'),
    el('p', {}, 'A component declares its typed properties. A change to a property asks for one render. '
      + 'The component uses other Zest components as its parts.'),
    tabs);
}

function families() {
  return el('section', {class: 'site-section', 'aria-labelledby': 'site-families-heading'},
    el('h2', {id: 'site-families-heading'}, 'What is in Zest'),
    el('div', {class: 'site-families'}, ...FAMILIES.map(family =>
      el('group-box', {label: family.title, 'data-testid': `site-family-${family.id}`},
        el('p', {}, family.text),
        link(`/gallery/${family.id}`, `Open ${family.title.toLowerCase()} in the gallery`)))));
}

function exampleList() {
  return el('section', {class: 'site-section', 'aria-labelledby': 'site-examples-heading'},
    el('h2', {id: 'site-examples-heading'}, 'Examples'),
    el('p', {}, 'Each example is an application that uses many components together.'),
    el('ul', {class: 'example-list'}, ...examples.map(item => el('li', {},
      link(`/examples/${item.id}`, item.title), ': ', item.description))));
}

function measurements() {
  const table = el('table-view', {label: 'Measurements', class: 'site-measurements', 'data-testid': 'site-measurements'});
  table.columns = [
    {key: 'name', label: 'Measurement', width: 400},
    {key: 'value', label: 'Result in Chromium', width: 280},
  ];
  table.items = MEASUREMENTS;
  return el('section', {class: 'site-section', 'aria-labelledby': 'site-scale-heading'},
    el('h2', {id: 'site-scale-heading'}, 'Scale'),
    el('p', {}, 'The scale lab measures these numbers in your browser. A frame-timed component renders a maximum of one time in each frame, '
      + 'so a storm of changes paints at the rate of the screen.'),
    table,
    el('p', {}, link('/examples/scale-lab', 'Measure them in the scale lab')));
}

function install() {
  const copy = el('push-button', {'data-testid': 'site-copy'}, 'Copy');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(INSTALL);
      showNotice({text: 'The command is on the clipboard.', kind: 'success'});
    } catch {
      showNotice({text: 'The browser did not let the page use the clipboard. Select the command and copy it.', kind: 'warning'});
    }
  });
  return el('section', {class: 'site-section', 'aria-labelledby': 'site-install-heading'},
    el('h2', {id: 'site-install-heading'}, 'Install'),
    el('div', {class: 'site-install'}, el('pre', {class: 'site-code'}, el('code', {}, INSTALL)), copy),
    el('p', {}, 'Install one package, or the umbrella package that has all of them. Then define the tags that you use:'),
    el('pre', {class: 'site-code', tabindex: '0', 'aria-label': 'How to define the tags'}, el('code', {},
      "import {defineControls, defineContainers} from '@catalystcommunity/zest';\n\ndefineControls();\ndefineContainers();")),
    el('p', {},
      link('https://github.com/catalystcommunity/zest', 'The source on GitHub'), ' · ',
      link('https://www.npmjs.com/package/@catalystcommunity/zest', 'The package on npm')));
}

export function renderHome() {
  return [el('div', {class: 'site-home', 'data-testid': 'site-home'},
    hero(), liveExample(), families(), exampleList(), measurements(), install())];
}
