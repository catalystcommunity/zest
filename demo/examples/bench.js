// Measurements for the scale lab. Each function builds what it measures, measures it, removes it,
// and gives plain numbers. The page shows them, and e2e/scale.spec.js checks them against budgets.
import {BaseComponent, OpenShadowComponent, BasicDataService, EventBroker, flushRenders, defineElements} from '../../src/index.js';

const now = () => performance.now();
const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

// A light DOM node. It paints its value, one time per frame.
class LabNode extends BaseComponent {
  static renderTiming = 'frame';
  static properties = {value: {type: Number, default: 0}};
  static styles = 'lab-node, lab-micro-node { display: block; padding-inline-start: 1px; }';
  renders = 0;
  #text = null;
  connectedCallback() {
    super.connectedCallback();
    this.applyStyles();
  }
  render() {
    this.renders++;
    if (!this.#text) {
      this.#text = document.createElement('span');
      this.prepend(this.#text);
    }
    this.#text.textContent = String(this.value);
  }
}

// The same node, with the default timing: one render after each task that changed it
class LabMicroNode extends LabNode {
  static renderTiming = 'microtask';
}

// A shadow DOM node. Its children go in a slot, as in a container.
class LabShadowNode extends OpenShadowComponent {
  static renderTiming = 'frame';
  static properties = {value: {type: Number, default: 0}};
  static styles = ':host { display: block; padding-inline-start: 1px; } .frame { border-inline-start: 1px solid transparent; }';
  renders = 0;
  #text = null;
  connectedCallback() {
    super.connectedCallback();
    if (!this.#text) {
      this.applyStyles();
      const frame = document.createElement('div');
      frame.className = 'frame';
      this.#text = document.createElement('span');
      frame.append(this.#text, document.createElement('slot'));
      this.root.append(frame);
    }
  }
  render() {
    this.renders++;
    this.#text.textContent = String(this.value);
  }
}

export function defineLabElements() {
  defineElements({'lab-node': LabNode, 'lab-micro-node': LabMicroNode, 'lab-shadow-node': LabShadowNode});
}

function stage() {
  let host = document.getElementById('bench-stage');
  if (!host) {
    host = document.createElement('div');
    host.id = 'bench-stage';
    // Off the screen but laid out, so that layout is part of the cost
    host.style.cssText = 'position: fixed; inset-inline-start: -10000px; inset-block-start: 0; width: 800px; contain: strict; height: 600px; overflow: hidden;';
    document.body.append(host);
  }
  return host;
}

function nodeTag(kind, index) {
  if (kind === 'shadow') { return 'lab-shadow-node'; }
  if (kind === 'mixed') { return index % 2 ? 'lab-shadow-node' : 'lab-node'; }
  return 'lab-node';
}

// A chain of components, each one inside the one before it. Measures building, connecting, the
// first paint, layout, an event that each level hears, an event that only the top hears, and removal.
export function nesting({depth = 100, kind = 'mixed', events = 200} = {}) {
  defineLabElements();
  const host = stage();
  const container = document.createElement('div');
  let t = now();
  const nodes = [];
  let parent = container;
  for (let i = 0; i < depth; i++) {
    const node = document.createElement(nodeTag(kind, i));
    parent.append(node);
    nodes.push(node);
    parent = node;
  }
  const build = now() - t;

  t = now();
  host.append(container);
  const connect = now() - t;

  t = now();
  for (const node of nodes) { node.value = 1; }
  const painted = flushRenders();
  const firstRender = now() - t;

  t = now();
  void container.offsetHeight;
  const layout = now() - t;

  const deepest = nodes.at(-1);
  let heard = 0;
  const count = () => { heard++; };
  for (const node of nodes) { node.addEventListener('lab-ping', count); }
  t = now();
  for (let i = 0; i < events; i++) {
    deepest.dispatchEvent(new CustomEvent('lab-ping', {bubbles: true, composed: true}));
  }
  const allLevels = (now() - t) / events;
  const heardPerEvent = heard / events;
  for (const node of nodes) { node.removeEventListener('lab-ping', count); }

  nodes[0].addEventListener('lab-ping', count);
  t = now();
  for (let i = 0; i < events; i++) {
    deepest.dispatchEvent(new CustomEvent('lab-ping', {bubbles: true, composed: true}));
  }
  const topOnly = (now() - t) / events;

  // A change at the deepest level, painted in the next frame
  t = now();
  deepest.value = 2;
  flushRenders();
  const deepUpdate = now() - t;

  t = now();
  container.remove();
  const disconnect = now() - t;

  return {
    depth, kind, painted, heardPerEvent,
    buildMs: round(build), connectMs: round(connect), firstRenderMs: round(firstRender), layoutMs: round(layout),
    eventAllLevelsUs: round(allLevels * 1000, 1), eventTopOnlyUs: round(topOnly * 1000, 1),
    deepUpdateMs: round(deepUpdate, 3), disconnectMs: round(disconnect),
  };
}

// Many components side by side
export function breadth({count = 10000, kind = 'light'} = {}) {
  defineLabElements();
  const host = stage();
  const container = document.createElement('div');
  const memory = () => performance.memory?.usedJSHeapSize ?? null;
  const before = memory();
  let t = now();
  const fragment = document.createDocumentFragment();
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const node = document.createElement(nodeTag(kind, i));
    fragment.append(node);
    nodes.push(node);
  }
  container.append(fragment);
  const build = now() - t;
  t = now();
  host.append(container);
  const connect = now() - t;
  t = now();
  for (const node of nodes) { node.value = 1; }
  flushRenders();
  const firstRender = now() - t;
  t = now();
  void container.offsetHeight;
  const layout = now() - t;
  // Change 1% of them, as an application does
  t = now();
  for (let i = 0; i < count; i += 100) { nodes[i].value = 2; }
  flushRenders();
  const partialUpdate = now() - t;
  const after = memory();
  t = now();
  container.remove();
  const disconnect = now() - t;
  return {
    count, kind,
    buildMs: round(build), connectMs: round(connect), firstRenderMs: round(firstRender), layoutMs: round(layout),
    partialUpdateMs: round(partialUpdate), disconnectMs: round(disconnect),
    // Chromium gives a rough number unless it starts with --enable-precise-memory-info
    heapPerComponentBytes: before !== null && after > before ? Math.round((after - before) / count) : null,
  };
}

// How many bubbling, composed events a second, through a chain of this depth
export function eventThroughput({depth = 20, events = 20000} = {}) {
  defineLabElements();
  const host = stage();
  const container = document.createElement('div');
  let parent = container;
  const nodes = [];
  for (let i = 0; i < depth; i++) {
    const node = document.createElement(nodeTag('mixed', i));
    parent.append(node);
    nodes.push(node);
    parent = node;
  }
  host.append(container);
  let heard = 0;
  container.addEventListener('lab-ping', () => { heard++; });
  const deepest = nodes.at(-1);
  const t = now();
  for (let i = 0; i < events; i++) {
    deepest.dispatchEvent(new CustomEvent('lab-ping', {bubbles: true, composed: true, detail: i}));
  }
  const ms = now() - t;
  container.remove();
  return {depth, events, heard, ms: round(ms), eventsPerSecond: Math.round(events / (ms / 1000))};
}

// The event broker sends each event to each subscriber of that event
export function brokerThroughput({subscribers = 1000, events = 1000} = {}) {
  const broker = new EventBroker(new EventTarget());
  let calls = 0;
  for (let i = 0; i < subscribers; i++) {
    broker.SubscribeEvent('lab-broadcast', `subscriber-${i}`, () => { calls++; });
  }
  const t = now();
  for (let i = 0; i < events; i++) { broker.FireEvent('lab-broadcast', i); }
  const ms = now() - t;
  broker.cleanup();
  return {subscribers, events, calls, ms: round(ms), callsPerSecond: Math.round(calls / (ms / 1000))};
}

// Components that each show one key of a store. Each write must reach only the component of that key.
export function storeFanOut({components = 2000, writes = 2000} = {}) {
  defineLabElements();
  const host = stage();
  const store = new BasicDataService();
  const container = document.createElement('div');
  const nodes = [];
  let calls = 0;
  for (let i = 0; i < components; i++) {
    const node = document.createElement('lab-node');
    container.append(node);
    nodes.push(node);
  }
  host.append(container);
  const removals = nodes.map((node, i) => store.subscribe(({changes}) => {
    calls++;
    node.value = changes.at(-1).newValue;
  }, {collection: 'cells', keys: [i], isActive: () => node.isActive()}));
  flushRenders();
  for (const node of nodes) { node.renders = 0; }
  let t = now();
  for (let i = 0; i < writes; i++) { store.set('cells', i % components, i + 1); }
  const writeMs = now() - t;
  t = now();
  const painted = flushRenders();
  const paintMs = now() - t;
  for (const remove of removals) { remove(); }
  container.remove();
  return {
    components, writes, handlerCalls: calls, painted,
    writeMs: round(writeMs), paintMs: round(paintMs), usPerWrite: round(writeMs / writes * 1000, 1),
  };
}

// A storm: many tasks, each one changes each node. A frame component paints at the rate of the
// screen. A microtask component paints after each task.
export async function renderStorm({components = 500, tasks = 100} = {}) {
  defineLabElements();
  const host = stage();
  const results = {};
  for (const tag of ['lab-micro-node', 'lab-node']) {
    const container = document.createElement('div');
    const nodes = Array.from({length: components}, () => container.appendChild(document.createElement(tag)));
    host.append(container);
    await new Promise(resolve => requestAnimationFrame(resolve));
    flushRenders();
    for (const node of nodes) { node.renders = 0; }
    let frames = 0;
    let counting = true;
    const countFrames = () => { if (counting) { frames++; requestAnimationFrame(countFrames); } };
    requestAnimationFrame(countFrames);
    const t = now();
    // Each change is a task of its own, as a pointer or a socket gives
    const channel = new MessageChannel();
    await new Promise(resolve => {
      let sent = 0;
      channel.port1.onmessage = () => {
        sent++;
        for (const node of nodes) { node.value = sent; }
        if (sent < tasks) { channel.port2.postMessage(0); } else { resolve(); }
      };
      channel.port2.postMessage(0);
    });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const ms = now() - t;
    counting = false;
    channel.port1.close();
    const renders = nodes.reduce((sum, node) => sum + node.renders, 0);
    results[tag === 'lab-node' ? 'frame' : 'microtask'] = {
      renders, rendersPerComponent: round(renders / components, 1), frames, ms: round(ms),
      shownValue: Number(nodes[0].firstChild?.textContent),
    };
    container.remove();
  }
  return {components, tasks, ...results};
}

// Real controls of the toolkit, in a mix, as on a large form
const WIDGETS = ['push-button', 'check-box', 'toggle-switch', 'text-field', 'spin-box', 'slider-control', 'combo-box', 'progress-bar'];
export async function widgets({count = 2000} = {}) {
  const host = stage();
  const container = document.createElement('div');
  container.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;';
  let t = now();
  const elements = [];
  for (let i = 0; i < count; i++) {
    const tag = WIDGETS[i % WIDGETS.length];
    const element = document.createElement(tag);
    element.setAttribute('label', `${tag} ${i}`);
    if (tag === 'push-button') { element.textContent = `Button ${i}`; }
    if (tag === 'progress-bar' || tag === 'slider-control' || tag === 'spin-box') { element.setAttribute('value', String(i % 100)); }
    if (tag === 'combo-box') { element.options = ['One', 'Two', 'Three']; }
    container.append(element);
    elements.push(element);
  }
  const build = now() - t;
  t = now();
  host.append(container);
  const connect = now() - t;
  // Each control renders in a microtask or in the next frame
  t = now();
  await Promise.resolve();
  flushRenders();
  void container.offsetHeight;
  const firstPaint = now() - t;
  // Change the value of each tenth control, as a data update does
  t = now();
  for (let i = 0; i < count; i += 10) {
    const element = elements[i];
    if ('checked' in element) { element.checked = !element.checked; } else if ('value' in element) { element.value = element.localName === 'combo-box' ? 'Two' : String((i + 7) % 100); }
  }
  await Promise.resolve();
  flushRenders();
  void container.offsetHeight;
  const update = now() - t;
  const elementsInside = container.querySelectorAll('*').length + elements.reduce((sum, element) => sum + (element.shadowRoot?.querySelectorAll('*').length ?? 0), 0);
  t = now();
  container.remove();
  const disconnect = now() - t;
  return {
    count, elementsInside,
    buildMs: round(build), connectMs: round(connect), firstPaintMs: round(firstPaint), updateTenthMs: round(update), disconnectMs: round(disconnect),
    usPerControl: round((build + connect + firstPaint) / count * 1000, 1),
  };
}

// Runs a measurement a few times, and gives the median of each number
export function repeat(measure, options, times = 3) {
  const runs = Array.from({length: times}, () => measure(options));
  const result = {...runs[0]};
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'number' && key.match(/Ms$|Us$|PerSecond$|Bytes$/)) {
      result[key] = median(runs.map(run => run[key]));
    }
  }
  return result;
}

export const bench = {nesting, breadth, widgets, eventThroughput, brokerThroughput, storeFanOut, renderStorm, repeat};
