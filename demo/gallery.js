// One section for each package. e2e/gallery.spec.js fails when a package has no section here,
// and drives each control below in a real browser.
import {BasicDataRegistry, BasicDataService, CheckCleanupCall, EventBroker, SimpleRouter} from '../src/index.js';

function el(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}

function card(testId, title, ...children) {
  return el('div', {class: 'card', 'data-testid': testId}, el('h3', {}, title), ...children);
}

function button(testId, label, onClick) {
  const element = el('button', {type: 'button', 'data-testid': testId}, label);
  element.addEventListener('click', onClick);
  return element;
}

function makeLog(testId) {
  const element = el('div', {class: 'log', 'data-testid': testId});
  element.add = (line) => {
    element.textContent += line + '\n';
    element.scrollTop = element.scrollHeight;
  };
  return element;
}

const sampleMenuConfig = {
  logo: {text: 'Menu'},
  sections: [
    {
      display: 'First section',
      icon: '/caldo.svg',
      link: '/gallery/two-tier-menu#first',
      items: [
        {display: 'Item with a link', link: '/gallery/two-tier-menu#item'},
        {display: 'Item with an icon', icon: '/icons8-open-source-150.png'},
      ],
    },
    {
      display: 'Second section',
      items: [{display: 'Plain item'}],
    },
  ],
  gutter: {overrideTemplateId: 'gallery-gutter'},
};

function baseComponentsSection(registry) {
  const observed = el('gallery-observed', {'data-testid': 'observed-output'});
  const observedInput = el('input', {'data-testid': 'observed-input', value: 'hello', 'aria-label': 'shown-text'});
  observedInput.addEventListener('input', () => observed.setAttribute('shown-text', observedInput.value));

  const lifecycleLog = makeLog('data-log');
  const holder = el('div', {'data-testid': 'data-holder'});
  let registerCount = 0;
  if (!registry.galleryRegister) {
    registry.AddDataFunction('galleryRegister', (id, data) => {
      registerCount++;
      lifecycleLog.add(`register ${id} with ${data}`);
      return {
        message: `register call ${registerCount}`,
        unregisterFunc: (unregisterId) => lifecycleLog.add(`unregister ${unregisterId}`),
      };
    });
  }
  const dataElement = el('gallery-data', {
    'registry-name': 'appDataRegistry',
    'data-register-func-name': 'galleryRegister',
    'register-data': 'someData',
    'instance-id': 'gallery-instance',
  });

  return [
    card('base-default', 'BaseComponent: default template, which its default styles hide', el('gallery-base')),
    card('base-override', 'BaseComponent: override template and styles', el('gallery-base', {
      'override-template-id': 'gallery-base-template',
      'override-style-template-id': 'gallery-red-styles',
    })),
    card('shadow-override', 'OpenShadowComponent: override template and styles', el('gallery-shadow', {
      'override-template-id': 'gallery-base-template',
      'override-style-template-id': 'gallery-red-styles',
    })),
    card('observed', 'Observed attributes: changeAttributes', observedInput, observed),
    card('data-lifecycle', 'DataComponent: register and unregister', holder,
      el('div', {class: 'controls'},
        button('data-add', 'Add to the page', () => holder.append(dataElement)),
        button('data-remove', 'Remove from the page', () => dataElement.remove()),
      ),
      lifecycleLog,
    ),
  ];
}

function dataRegistrySection() {
  const registry = new BasicDataRegistry();
  const log = makeLog('registry-log');
  const attempt = (action) => {
    try {
      log.add(action());
    } catch (e) {
      log.add(`Error: ${e.message}`);
    }
  };
  return [
    card('registry', 'AddDataFunction and call',
      el('div', {class: 'controls'},
        button('registry-add', 'Add sayHello', () => attempt(() => {
          registry.AddDataFunction('sayHello', (id) => `hello ${id}`);
          return 'added sayHello';
        })),
        button('registry-call', 'Call sayHello', () => attempt(() => registry.sayHello('world'))),
        button('registry-bad', 'Add something that is not a function', () => attempt(() => {
          registry.AddDataFunction('notFunction', 'text');
          return 'added notFunction';
        })),
      ),
      log,
    ),
  ];
}

function dataServiceSection() {
  const service = new BasicDataService();
  service.set('counters', 'count', 0);
  const readerA = el('div', {'data-testid': 'service-reader-a'}, 'Reader A: 0');
  const readerB = el('div', {'data-testid': 'service-reader-b'}, 'Reader B: no even number yet');
  const log = makeLog('service-log');
  service.subscribe(({changes}) => {
    readerA.textContent = `Reader A: ${changes[0].newValue}`;
  }, {collection: 'counters', keys: ['count']});
  service.subscribe(({changes}) => {
    readerB.textContent = `Reader B: ${changes[0].newValue}`;
  }, {collection: 'counters', keys: ['count'], filter: change => change.newValue % 2 === 0});
  service.subscribe(({collection, changes}) => {
    log.add(`${collection}: ${changes.map(change => `${change.key} ${change.oldValue} -> ${change.newValue}`).join(', ')}`);
  });

  const bus = new EventTarget();
  service.listen(bus, 'counter-reset', (detail, store) => {
    store.set('counters', 'count', detail.to);
    store.set('counters', 'resets', (store.get('counters', 'resets') ?? 0) + 1);
  });
  return [
    card('service', 'One store, and readers that decide what they care about',
      el('div', {class: 'controls'},
        button('service-increment', 'Add one to the store', () => {
          service.set('counters', 'count', service.get('counters', 'count') + 1);
        }),
        button('service-reset', 'Send a reset event', () => {
          bus.dispatchEvent(new CustomEvent('counter-reset', {detail: {to: 0}}));
        }),
      ),
      readerA, readerB, log,
    ),
  ];
}

const TOKEN_COLORS = [
  ['window', 'window-text'], ['face', 'face-text'], ['field', 'field-text'], ['highlight', 'highlight-text'],
];

function swatches() {
  return el('div', {class: 'swatches'}, ...TOKEN_COLORS.map(([background, text]) => {
    const swatch = el('div', {class: 'swatch'}, `--zest-color-${background}`);
    swatch.style.background = `var(--zest-color-${background})`;
    swatch.style.color = `var(--zest-color-${text})`;
    return swatch;
  }));
}

function designTokensSection() {
  const sample = (attributes = {}) => el('div', {class: 'controls', ...attributes},
    el('date-time-picker', {label: 'Sample date', value: '2026-03-14'}),
    el('button', {type: 'button'}, 'A button'),
  );
  const dark = el('div', {'data-testid': 'tokens-dark', style: 'color-scheme: dark; background: var(--zest-color-window); color: var(--zest-color-window-text); padding: 1em;'}, swatches(), sample());
  const light = el('div', {'data-testid': 'tokens-light', style: 'color-scheme: light; background: var(--zest-color-window); color: var(--zest-color-window-text); padding: 1em;'}, swatches(), sample());
  return [
    card('tokens-light-card', 'Light, on one part of the page', light),
    card('tokens-dark-card', 'Dark, on one part of the page', dark),
    card('tokens-override', 'A parent element changes one token',
      sample({'data-testid': 'tokens-override-sample', style: '--zest-color-highlight: #7a2e8e; --zest-color-focus: #7a2e8e;'})),
    card('tokens-small', 'A smaller font makes each control smaller',
      sample({'data-testid': 'tokens-small-sample', style: 'font-size: 0.875rem;'})),
  ];
}

function dateTimePickerSection(context) {
  const log = makeLog('picker-log');
  const listen = (element, name) => {
    element.addEventListener('date-changed', (e) => {
      log.add(`${name}: ${e.detail.value || 'cleared'}`);
    });
    return element;
  };
  const picker = (testId, attributes = {}, tag = 'date-time-picker') =>
    listen(el(tag, {'data-testid': `${testId}-element`, ...attributes}), testId);
  const show = (testId, title, attributes, tag) => card(testId, title, picker(testId, attributes, tag));

  // Data from a registry, and from an event: the picker asks for each month when the view moves
  const dataLog = makeLog('picker-data-log');
  const bookedDays = (year, month) => ({
    [`${year}-${String(month).padStart(2, '0')}-10`]: {disabled: true, className: 'booked', title: 'Full', label: 'Full', badge: '×'},
    [`${year}-${String(month).padStart(2, '0')}-12`]: {title: '2 places left', label: '2 places left', badge: '2'},
  });
  let days = {};
  const loaded = el('date-time-picker', {
    'data-testid': 'picker-data-element', 'registry-name': 'appDataRegistry',
    'data-register-func-name': 'galleryAvailability', 'initial-date': '2024-03-15', 'instance-id': 'availability',
  });
  if (!context.registry.galleryAvailability) {
    context.registry.AddDataFunction('galleryAvailability', (id) => {
      dataLog.add(`register ${id}`);
      days = bookedDays(2024, 3);
      return {
        pickerConfig: {getDayInfo: (iso) => days[iso] ?? null},
        unregisterFunc: () => {},
      };
    });
  }
  loaded.addEventListener('date-view-changed', (e) => {
    dataLog.add(`load ${e.detail.year}-${e.detail.month}`);
    days = bookedDays(e.detail.year, e.detail.month);
    loaded.updateConfig({});
  });

  // Each date-changed event reaches the document, so a broker hears each picker on the page
  const brokerLog = makeLog('picker-broker-log');
  const broker = new EventBroker();
  broker.SubscribeEvent('date-changed', 'gallery-picker', (_name, detail) => {
    brokerLog.add(`${detail.instanceId}: ${detail.value}`);
  });
  const heard = el('date-time-picker', {'data-testid': 'picker-broker-element', 'instance-id': 'heard-by-broker'});

  const output = el('output', {'data-testid': 'picker-form-output'}, 'Not submitted');
  const form = el('form', {'data-testid': 'picker-form'},
    el('label', {for: 'gallery-form-picker'}, 'Appointment '),
    el('date-time-picker', {id: 'gallery-form-picker', name: 'appointment', mode: 'datetime', required: '', value: '2024-03-15T09:00', 'data-testid': 'picker-form-element'}),
    el('div', {class: 'controls'},
      el('button', {type: 'submit', 'data-testid': 'picker-form-submit'}, 'Submit'),
      el('button', {type: 'reset', 'data-testid': 'picker-form-reset'}, 'Reset'),
    ),
    output,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    output.textContent = JSON.stringify(Object.fromEntries(new FormData(form)));
  });
  const fieldset = el('fieldset', {'data-testid': 'picker-fieldset'},
    el('legend', {}, 'A fieldset'),
    el('date-time-picker', {'data-testid': 'picker-fieldset-element'}),
  );
  const fieldsetToggle = button('picker-fieldset-toggle', 'Disable the fieldset', () => { fieldset.disabled = !fieldset.disabled; });

  const presets = picker('picker-presets', {selection: 'range', 'initial-date': '2024-03-15'});
  presets.updateConfig({presets: [
    {label: 'First week of March', value: '2024-03-01/2024-03-07'},
    {label: 'All of April', value: '2024-04-01/2024-04-30'},
  ]});

  const dialog = el('dialog', {'data-testid': 'picker-dialog'},
    el('p', {}, 'A picker in a modal dialog'),
    picker('picker-dialog-picker', {'initial-date': '2024-03-15'}),
    el('div', {class: 'controls'}, button('picker-dialog-close', 'Close the dialog', () => dialog.close())),
  );

  return [
    show('picker-light', 'Date, in the light DOM', {}),
    show('picker-shadow', 'Date, in a shadow root', {}, 'shadow-date-time-picker'),
    show('picker-initial', 'initial-date="2024-03-15"', {'initial-date': '2024-03-15'}),
    show('picker-bad-initial', 'initial-date that it cannot read', {'initial-date': 'not a date'}),
    show('picker-datetime', 'Date and time', {mode: 'datetime', 'initial-date': '2024-03-15', 'minute-step': '15'}),
    show('picker-datetime-shadow', 'Date and time, in a shadow root', {mode: 'datetime', 'initial-date': '2024-03-15'}, 'shadow-date-time-picker'),
    show('picker-time', 'Time', {mode: 'time'}),
    show('picker-time-seconds', 'Time, 24 hours with seconds', {mode: 'time', 'twenty-four-hour-format': '', 'include-seconds': '', 'value': '13:45:10'}),
    show('picker-time-limits', 'Time, 09:00 to 17:00 every 30 minutes', {mode: 'time', min: '09:00', max: '17:00', 'minute-step': '30', 'twenty-four-hour-format': ''}),
    show('picker-time-list', 'Time, from a list', {mode: 'time', 'time-view': 'list', 'minute-step': '30', 'twenty-four-hour-format': ''}),
    show('picker-time-slots', 'Time, from slots', {mode: 'time', 'time-slots': '09:00,10:30,14:00,16:30', 'twenty-four-hour-format': ''}),
    show('picker-month', 'Month', {mode: 'month', 'initial-date': '2024-03-15'}),
    show('picker-week', 'Week', {mode: 'week', 'initial-date': '2024-03-15'}),
    show('picker-year', 'Year', {mode: 'year', 'initial-date': '2024-03-15'}),
    show('picker-range', 'Range of dates, on two months', {selection: 'range', months: '2', 'initial-date': '2024-03-15'}),
    show('picker-range-datetime', 'Range of dates and times', {mode: 'datetime', selection: 'range', 'initial-date': '2024-03-15', 'twenty-four-hour-format': ''}),
    show('picker-range-time', 'Range of times', {mode: 'time', selection: 'range', 'twenty-four-hour-format': ''}),
    show('picker-range-limits', 'Range of 2 to 5 days, with a day not available', {selection: 'range', 'initial-date': '2024-03-15', 'min-range-days': '2', 'max-range-days': '5', 'disabled-dates': '2024-03-20'}),
    show('picker-multiple', 'Multiple dates', {selection: 'multiple', 'initial-date': '2024-03-15'}),
    show('picker-limits', 'March 10 to 25, no weekends', {min: '2024-03-10', max: '2024-03-25', 'disabled-weekdays': '0,6', 'initial-date': '2024-03-15'}),
    show('picker-window', 'Date and time, in a daily window', {mode: 'datetime', 'min-time': '09:00', 'max-time': '17:00', 'default-time': '09:00', 'initial-date': '2024-03-15', 'twenty-four-hour-format': ''}),
    card('picker-inline', 'Inline, with week numbers', picker('picker-inline', {inline: '', 'show-week-numbers': '', 'initial-date': '2024-03-15'})),
    card('picker-inline-datetime', 'Inline, date and time', picker('picker-inline-datetime', {inline: '', mode: 'datetime', 'initial-date': '2024-03-15', 'twenty-four-hour-format': ''})),
    show('picker-disabled', 'Disabled', {disabled: '', value: '2024-03-15'}),
    show('picker-readonly', 'Read only', {readonly: '', value: '2024-03-15'}),
    show('picker-no-typing', 'No typing', {'no-typing': '', 'initial-date': '2024-03-15'}),
    show('picker-german', 'German', {locale: 'de-DE', mode: 'datetime', 'initial-date': '2024-03-15'}),
    show('picker-japanese', 'Japanese', {locale: 'ja-JP', format: 'long', 'initial-date': '2024-03-15'}),
    card('picker-arabic', 'Arabic, right to left', el('div', {dir: 'rtl'}, picker('picker-arabic', {locale: 'ar-EG', 'initial-date': '2024-03-15'}))),
    show('picker-iso', 'ISO format', {format: 'iso', 'initial-date': '2024-03-15'}),
    show('picker-zone', 'A fixed time zone: Tokyo', {mode: 'datetime', 'time-zone': 'Asia/Tokyo', 'initial-date': '2024-03-15', 'twenty-four-hour-format': ''}),
    show('picker-zone-select', 'A time zone that the user selects', {mode: 'datetime', 'time-zone-selectable': '', 'initial-date': '2024-03-15'}),
    card('picker-presets', 'Presets from data', presets),
    card('picker-data', 'Data from a registry, loaded for each month', loaded, dataLog),
    card('picker-broker', 'Heard by an EventBroker', heard, brokerLog),
    card('picker-in-form', 'In a form', form),
    card('picker-in-fieldset', 'In a fieldset', fieldset, fieldsetToggle),
    card('picker-clipped', 'In a box that clips', el('div', {style: 'overflow: hidden; height: 3em;', 'data-testid': 'picker-clip-box'}, picker('picker-clipped', {'initial-date': '2024-03-15'}))),
    card('picker-in-dialog', 'In a modal dialog', button('picker-dialog-open', 'Open the dialog', () => dialog.showModal()), dialog),
    card('picker-events', 'date-changed events', log),
  ];
}

function eventBrokerSection() {
  const broker = new EventBroker();
  const log = makeLog('broker-log');
  const stats = el('div', {'data-testid': 'broker-stats'});
  const showStats = () => {
    const {count, added, removed} = broker.subscriberStats;
    stats.textContent = `count ${count}, added ${added}, removed ${removed}`;
  };
  showStats();
  const subscribe = (name) => () => {
    broker.SubscribeEvent('gallery-event', name, (eventName, detail) => log.add(`${name} heard ${eventName}: ${detail.value}`));
    showStats();
  };
  let fired = 0;
  return [
    card('broker', 'Subscribe, fire, unsubscribe', 
      el('div', {class: 'controls'},
        button('broker-sub-a', 'Subscribe A', subscribe('A')),
        button('broker-sub-b', 'Subscribe B', subscribe('B')),
        button('broker-unsub-a', 'Unsubscribe A', () => {
          log.add(`unsubscribe A: ${broker.UnsubscribeEvent('gallery-event', 'A')}`);
          showStats();
        }),
        button('broker-fire', 'Fire', () => broker.FireEvent('gallery-event', {value: ++fired})),
        button('broker-cleanup', 'Clean up', () => {
          CheckCleanupCall(broker);
          showStats();
        }),
      ),
      stats, log,
    ),
  ];
}

function menuGutterSection() {
  return [
    card('gutter-light', 'Light DOM, override template', el('menu-gutter', {'override-template-id': 'gallery-gutter'})),
    card('gutter-shadow', 'Shadow DOM, override template', el('shadow-menu-gutter', {'override-template-id': 'gallery-gutter'})),
  ];
}

function menuItemSection() {
  const live = el('menu-item', {display: 'Change me', 'data-testid': 'item-live-element'});
  const liveDisplay = el('input', {'data-testid': 'item-live-input', value: 'Change me', 'aria-label': 'display'});
  liveDisplay.addEventListener('input', () => live.setAttribute('display', liveDisplay.value));
  return [
    card('item-link', 'Link, icon, and text', el('menu-item', {
      href: '/gallery/menu-item#linked', icon: '/caldo.svg', display: 'Linked item',
    })),
    card('item-plain', 'Text only', el('menu-item', {display: 'Plain item'})),
    card('item-html', 'Text that looks like HTML', el('menu-item', {display: '<b>not bold</b>'})),
    card('item-shadow', 'Shadow DOM', el('shadow-menu-item', {
      href: '/gallery/menu-item#shadow', icon: '/caldo.svg', display: 'Shadow item',
    })),
    card('item-live', 'Change an attribute', liveDisplay, el('div', {}, live)),
  ];
}

function menuLogoSection() {
  return [
    card('logo-image', 'Image', el('menu-logo', {logo: '/cslogo.png', alt: 'Catalyst Squad'})),
    card('logo-text', 'Text', el('menu-logo', {'logo-text': 'Zest'})),
    card('logo-link', 'Link with an image and text', el('menu-logo', {
      logo: '/caldo.svg', 'logo-text': 'Home', href: '/',
    })),
    card('logo-shadow', 'Shadow DOM', el('shadow-menu-logo', {logo: '/caldo.svg', 'logo-text': 'Shadow logo'})),
  ];
}

function simpleRouterSection(context) {
  const log = makeLog('router-log');
  const pairs = el('div', {'data-testid': 'router-pairs'});
  const base = '/gallery/simple-router';
  context.onRoute = (routeData, _state, changeType) => {
    log.add(`route ${changeType} ${routeData.path}${routeData.hash}`);
    pairs.textContent = JSON.stringify([...context.router.parsePathPairs(routeData.path, 2)]);
  };
  // A router of its own, with a location that only this card can see
  const fakeLocation = {
    location: {href: 'https://zest.test/start'},
    history: {pushState: (_state, _title, path) => { fakeLocation.location.href = new URL(path, fakeLocation.location.href).href; }},
  };
  const isolatedLog = makeLog('router-isolated-log');
  const isolated = new SimpleRouter();
  isolated.cleanup();
  isolated.locationProvider = fakeLocation;
  isolated.eventSender = () => {};
  isolated.registerRoute('/home', (routeData) => isolatedLog.add(`home route for ${routeData.path}`), ['/start-again']);
  isolated.registerRoute('/notfound', (routeData) => isolatedLog.add(`default route for ${routeData.path}`), [], true);
  return [
    card('router-url', 'The router of this page', 
      el('div', {class: 'controls'},
        button('router-push', 'changePage to key value pairs', () => context.router.changePage(`${base}/userid/17/address/12`, {from: 'gallery'})),
        button('router-back', 'history.back', () => history.back()),
        button('router-hash', 'Change location.hash', () => { location.hash = 'hash-' + Date.now(); }),
      ),
      el('a', {href: `${base}/from/link`, 'data-testid': 'router-link'}, 'A plain link that the page routes'),
      pairs, log,
    ),
    card('router-isolated', 'Route matching, with a fake location',
      el('div', {class: 'controls'},
        button('router-iso-home', 'Go to /home/more', () => isolated.changePage('/home/more')),
        button('router-iso-equiv', 'Go to /start-again', () => isolated.changePage('/start-again')),
        button('router-iso-partial', 'Go to /homepage', () => isolated.changePage('/homepage')),
      ),
      isolatedLog,
    ),
  ];
}

function twoTierMenuSection(context) {
  const log = makeLog('menu-log');
  const registry = context.registry;
  if (!registry.galleryMenu) {
    registry.AddDataFunction('galleryMenu', (id) => {
      log.add(`register ${id}`);
      return {
        menuConfig: sampleMenuConfig,
        unregisterFunc: (unregisterId) => log.add(`unregister ${unregisterId}`),
      };
    });
  }
  const makeMenu = (tag, id) => el(tag, {
    'registry-name': 'appDataRegistry',
    'data-register-func-name': 'galleryMenu',
    'instance-id': id,
  });
  const light = makeMenu('two-tier-menu', 'light-menu');
  const lightBox = el('div', {class: 'menu-box', 'data-testid': 'menu-light-box'}, light);
  return [
    card('menu-light', 'Light DOM, default styles', lightBox,
      el('div', {class: 'controls'},
        button('menu-remove', 'Remove from the page', () => light.remove()),
        button('menu-add', 'Add to the page', () => lightBox.append(light)),
      ),
      log,
    ),
    card('menu-shadow', 'Shadow DOM, default styles', el('div', {class: 'menu-box'}, makeMenu('shadow-two-tier-menu', 'shadow-menu'))),
  ];
}

export const sections = [
  {id: 'base-components', title: 'Base components', render: (context) => baseComponentsSection(context.registry)},
  {id: 'basic-data-registry', title: 'Basic data registry', render: dataRegistrySection},
  {id: 'basic-data-service', title: 'Basic data service', render: dataServiceSection},
  {id: 'date-time-picker', title: 'Date time picker', render: dateTimePickerSection},
  {id: 'design-tokens', title: 'Design tokens', render: designTokensSection},
  {id: 'event-broker', title: 'Event broker', render: eventBrokerSection},
  {id: 'menu-gutter', title: 'Menu gutter', render: menuGutterSection},
  {id: 'menu-item', title: 'Menu item', render: menuItemSection},
  {id: 'menu-logo', title: 'Menu logo', render: menuLogoSection},
  {id: 'simple-router', title: 'Simple router', render: simpleRouterSection},
  {id: 'two-tier-menu', title: 'Two tier menu', render: twoTierMenuSection},
];

export function renderSection(section, context) {
  return el('section', {class: 'section', 'data-testid': `section-${section.id}`},
    el('h2', {}, section.title, ' ', el('span', {class: 'package-name'}, `@catalystcommunity/${section.id}`)),
    el('div', {class: 'cards'}, ...section.render(context)),
  );
}
