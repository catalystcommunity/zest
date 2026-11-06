// The scale lab: each measurement has a button, and its results go into a table. The numbers come
// from this browser on this computer, so compare them only with numbers from the same place.
import {BaseComponent, OpenShadowComponent, defineElements} from '../../src/index.js';
import {bench} from './bench.js';
import {card, el} from '../kit.js';

// Three levels for the routing demonstration: light, shadow, light
class RoutePanel extends BaseComponent {}
class RouteShadowPanel extends OpenShadowComponent {
  connectedCallback() {
    super.connectedCallback();
    if (!this.root.firstChild) {
      this.root.innerHTML = '<div part="frame" style="padding: 0.5em; border: 1px dashed currentColor;"><button type="button" class="inner">Button in the shadow root</button><slot></slot></div>';
    }
  }
}

function table(testId, columns) {
  const body = el('tbody');
  const element = el('div', {class: 'scale-table', role: 'region', tabindex: '0', 'aria-label': `${testId} results`},
    el('table', {'data-testid': testId}, el('thead', {}, el('tr', {}, ...columns.map(([, label]) => el('th', {scope: 'col'}, label)))), body));
  element.add = (result) => {
    body.append(el('tr', {}, ...columns.map(([key]) => el('td', {}, result[key] === null || result[key] === undefined ? '—' : String(result[key])))));
  };
  return element;
}

function runner(testId, label, run) {
  const status = el('span', {role: 'status', 'data-testid': `${testId}-status`});
  const go = el('button', {type: 'button', 'data-testid': testId}, label);
  go.addEventListener('click', async () => {
    go.disabled = true;
    status.textContent = 'Measuring…';
    // Let the status paint before the work holds the page
    await new Promise(resolve => setTimeout(resolve, 30));
    try {
      await run();
      status.textContent = 'Done.';
    } catch (e) {
      status.textContent = `Failed: ${e.message}`;
      throw e;
    } finally {
      go.disabled = false;
    }
  });
  return el('div', {class: 'controls'}, go, status);
}

function numberInput(testId, label, value) {
  const input = el('input', {type: 'number', min: '1', value: String(value), 'data-testid': testId});
  return {input, element: el('label', {class: 'scale-field'}, `${label} `, input)};
}

function nestingCard() {
  const depth = numberInput('scale-depth', 'Depth', 500);
  const kind = el('select', {'data-testid': 'scale-kind'}, ...['mixed', 'light', 'shadow'].map(value => el('option', {value}, value)));
  const results = table('scale-nesting-results', [
    ['depth', 'Depth'], ['kind', 'Kind'], ['connectMs', 'Connect ms'], ['firstRenderMs', 'First paint ms'], ['layoutMs', 'Layout ms'],
    ['eventAllLevelsUs', 'Event, each level hears, µs'], ['eventTopOnlyUs', 'Event, top hears, µs'], ['deepUpdateMs', 'Deep update ms'], ['disconnectMs', 'Remove ms'],
  ]);
  return card('scale-nesting', 'Nesting',
    el('p', {}, 'A chain of components, each one inside the one before it. Mixed puts a shadow root at each second level, so each event crosses many shadow boundaries.'),
    el('p', {}, 'Limit: Chromium stops the tab during layout at about 1,750 levels of the flat tree, also with plain div elements. A shadow node here adds two levels, so about 850 shadow nodes is the limit there. Firefox laid out 12,000 levels. A real window has less than 50 levels.'),
    el('div', {class: 'controls'}, depth.element, el('label', {class: 'scale-field'}, 'Kind ', kind)),
    runner('scale-run-nesting', 'Measure nesting', () => {
      results.add(bench.repeat(bench.nesting, {depth: Number(depth.input.value), kind: kind.value}));
    }),
    runner('scale-run-depths', 'Measure 10 to 1,000 levels', () => {
      for (const levels of [10, 100, 250, 500, 1000]) { results.add(bench.repeat(bench.nesting, {depth: levels, kind: kind.value})); }
    }),
    results,
  );
}

function breadthCard() {
  const count = numberInput('scale-count', 'Components', 10000);
  const results = table('scale-breadth-results', [
    ['count', 'Count'], ['kind', 'Kind'], ['buildMs', 'Make ms'], ['connectMs', 'Connect ms'], ['firstRenderMs', 'First paint ms'],
    ['layoutMs', 'Layout ms'], ['partialUpdateMs', 'Change 1% ms'], ['disconnectMs', 'Remove ms'], ['heapPerComponentBytes', 'Heap bytes each'],
  ]);
  return card('scale-breadth', 'Many components',
    el('p', {}, 'Components side by side. The heap column needs Chromium.'),
    count.element,
    runner('scale-run-breadth', 'Measure light and shadow', () => {
      for (const kind of ['light', 'shadow']) { results.add(bench.repeat(bench.breadth, {count: Number(count.input.value), kind}, 1)); }
    }),
    results,
  );
}

function widgetsCard() {
  const count = numberInput('scale-widget-count', 'Controls', 2000);
  const results = table('scale-widget-results', [
    ['count', 'Controls'], ['elementsInside', 'Elements'], ['buildMs', 'Make ms'], ['connectMs', 'Connect ms'],
    ['firstPaintMs', 'First paint ms'], ['updateTenthMs', 'Change 10% ms'], ['disconnectMs', 'Remove ms'], ['usPerControl', 'µs each'],
  ]);
  return card('scale-widgets', 'Real controls',
    el('p', {}, 'Buttons, check boxes, switches, text fields, spin boxes, sliders, combo boxes, and progress bars in one grid, as on a very large form.'),
    count.element,
    runner('scale-run-widgets', 'Measure controls', async () => {
      results.add(await bench.widgets({count: Number(count.input.value)}));
    }),
    results,
  );
}

function eventsCard() {
  const results = table('scale-event-results', [['name', 'Measurement'], ['size', 'Size'], ['ms', 'ms'], ['rate', 'Per second']]);
  return card('scale-events', 'Events',
    el('p', {}, 'DOM events that bubble through 20 levels and leave each shadow root, an event broker that sends one event to many subscribers, and a store with one subscriber for each key.'),
    runner('scale-run-events', 'Measure events', () => {
      const dom = bench.eventThroughput({depth: 20, events: 20000});
      results.add({name: 'DOM event through 20 levels', size: `${dom.events} events`, ms: dom.ms, rate: dom.eventsPerSecond.toLocaleString()});
      const broker = bench.brokerThroughput({subscribers: 1000, events: 1000});
      results.add({name: 'Broker, 1,000 subscribers', size: `${broker.calls} calls`, ms: broker.ms, rate: broker.callsPerSecond.toLocaleString()});
      const store = bench.storeFanOut({components: 5000, writes: 5000});
      results.add({name: 'Store, 5,000 components, one key each', size: `${store.writes} writes, ${store.handlerCalls} calls, ${store.painted} paints`, ms: store.writeMs, rate: Math.round(store.writes / (store.writeMs / 1000)).toLocaleString()});
    }),
    results,
  );
}

function stormCard() {
  const results = table('scale-storm-results', [['timing', 'Timing'], ['renders', 'Renders'], ['rendersPerComponent', 'Renders each'], ['frames', 'Frames'], ['ms', 'ms']]);
  return card('scale-storm', 'Render storm',
    el('p', {}, 'Each of 100 tasks changes each of 500 components, as a pointer or a data stream does. A microtask component paints after each task. A frame component paints one time in each frame, so the number of renders follows the screen, not the number of changes.'),
    runner('scale-run-storm', 'Measure the storm', async () => {
      const storm = await bench.renderStorm({components: 500, tasks: 100});
      results.add({timing: 'microtask', ...storm.microtask});
      results.add({timing: 'frame', ...storm.frame});
    }),
    results,
  );
}

function routingCard() {
  defineElements({'route-panel': RoutePanel, 'route-shadow-panel': RouteShadowPanel});
  const log = el('ol', {class: 'log', 'data-testid': 'scale-route-log', 'aria-live': 'polite'});
  const handle = el('input', {type: 'checkbox', 'data-testid': 'scale-route-handle'});
  const outer = el('route-panel', {'data-level': 'outer window'});
  const middle = el('route-shadow-panel', {'data-level': 'shadow panel'});
  const inner = el('route-panel', {'data-level': 'inner panel'});
  const leaf = el('button', {type: 'button', 'data-testid': 'scale-route-leaf'}, 'Button in the inner panel');
  inner.append(leaf);
  middle.append(inner);
  outer.append(middle);
  for (const level of [inner, middle, outer]) {
    level.addEventListener('click', (e) => {
      const target = e.target.dataset?.level ?? e.target.className ?? e.target.localName;
      log.append(el('li', {}, `${level.dataset.level} hears the click. Its target is: ${target || e.target.localName}.`));
      if (level === middle && handle.checked) {
        e.stopPropagation();
        log.append(el('li', {}, 'The shadow panel handles the click, so it goes no higher.'));
      }
    });
  }
  const clear = el('button', {type: 'button'}, 'Clear the log');
  clear.addEventListener('click', () => log.replaceChildren());
  return card('scale-routing', 'Event routing',
    el('p', {}, 'A click bubbles from the control to each parent, as in a window of a GUI toolkit. Outside a shadow root, the target is the shadow host, so a parent sees the component, not its parts. A level can handle the event and stop it.'),
    el('label', {}, handle, ' The shadow panel handles each click'),
    outer, clear, log,
  );
}

export function renderScaleLab() {
  return [
    el('p', {}, 'Each measurement runs in this tab. Close other tabs for steady numbers. The e2e tests run smaller sizes and check them against budgets.'),
    el('div', {class: 'cards'}, nestingCard(), breadthCard(), widgetsCard(), eventsCard(), stormCard(), routingCard()),
  ];
}
