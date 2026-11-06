// The gallery section of @catalystcommunity/controls. definitions are the tags that the demo defines.
import {controlTags, shadowControlTags} from '../../src/index.js';
import {button, card, el, makeLog} from '../kit.js';

export const definitions = {...controlTags, ...shadowControlTags};

const fruits = ['Apple', 'Apricot', 'Banana', 'Blueberry', 'Cherry', 'Grape', 'Lemon', 'Mango', 'Orange', 'Peach', 'Pear', 'Plum'];
const sizes = [{value: 's', label: 'Small'}, {value: 'm', label: 'Medium'}, {value: 'l', label: 'Large'}, {value: 'xl', label: 'Extra large', disabled: true}];

// The demo styles have no rule for a column of controls
const STACK = 'display: flex; flex-direction: column; align-items: flex-start; gap: 0.75em; min-width: 0;';
const COLUMN = 'display: flex; flex-direction: column; gap: 1em; min-width: 0;';
const stack = (...children) => el('div', {style: STACK}, ...children);

function withData(element, data) {
  Object.assign(element, data);
  return element;
}

function controlsSection() {
  const log = makeLog('controls-log');
  const watch = (container) => {
    for (const type of ['input', 'change']) {
      container.addEventListener(type, (e) => {
        const target = e.target;
        const id = target.dataset?.testid;
        if (!id) { return; }
        const name = target.localName;
        const value = /check-box|toggle-switch/.test(name) ? target.checked
          : name.endsWith('push-button') ? target.pressed
          : target.multiple ? JSON.stringify(target.values) : target.value;
        log.add(`${id} ${type} ${value}`);
      });
    }
    return container;
  };

  const counter = el('output', {'data-testid': 'button-count'}, 'Clicks: 0');
  let clicks = 0;
  const counted = el('push-button', {'data-testid': 'button-default'}, 'Count');
  counted.addEventListener('click', () => { counter.textContent = `Clicks: ${++clicks}`; });

  const buttons = card('controls-buttons', 'Push buttons',
    el('div', {class: 'controls'},
      counted,
      el('push-button', {variant: 'primary', 'data-testid': 'button-primary'}, 'Save'),
      el('push-button', {variant: 'danger', 'data-testid': 'button-danger'}, 'Delete'),
      el('push-button', {variant: 'flat', 'data-testid': 'button-flat'}, 'Flat'),
      el('push-button', {disabled: '', 'data-testid': 'button-disabled'}, 'Disabled'),
      el('push-button', {icon: '/caldo.svg', 'data-testid': 'button-icon'}, 'With an icon'),
      el('push-button', {toggle: '', 'data-testid': 'button-toggle'}, 'Bold'),
      el('shadow-push-button', {variant: 'primary', 'data-testid': 'button-shadow'}, 'In a shadow root'),
    ),
    counter,
  );

  const checks = card('controls-checks', 'Check boxes and switches',
    stack(
      el('check-box', {'data-testid': 'check-plain'}, 'Send me email'),
      el('check-box', {checked: '', 'data-testid': 'check-checked'}, 'Checked'),
      el('check-box', {indeterminate: '', 'data-testid': 'check-mixed'}, 'Some of the items'),
      el('check-box', {disabled: '', 'data-testid': 'check-disabled'}, 'Disabled'),
      el('shadow-check-box', {'data-testid': 'check-shadow'}, 'In a shadow root'),
      el('toggle-switch', {'data-testid': 'switch-plain', 'show-state': ''}, 'Wi-Fi'),
      el('toggle-switch', {checked: '', 'data-testid': 'switch-on'}, 'Bluetooth'),
      el('shadow-toggle-switch', {'data-testid': 'switch-shadow', 'show-state': ''}, 'Airplane mode, in a shadow root'),
    ),
  );

  const radios = card('controls-radios', 'Radio groups', stack(
    el('radio-group', {label: 'Delivery', value: 'standard', 'data-testid': 'radio-children'},
      el('radio-button', {value: 'standard'}, 'Standard'),
      el('radio-button', {value: 'express'}, 'Express'),
      el('radio-button', {value: 'drone', disabled: ''}, 'Drone (not available)'),
      el('radio-button', {value: 'pickup'}, 'Pick up'),
    ),
    withData(el('radio-group', {label: 'Size', orientation: 'horizontal', 'data-testid': 'radio-options'}), {options: sizes}),
    withData(el('shadow-radio-group', {label: 'Color, in a shadow root', 'data-testid': 'radio-shadow'}), {options: ['Red', 'Green', 'Blue']}),
  ));

  const texts = card('controls-text', 'Text fields',
    stack(
      el('text-field', {label: 'Name', helper: 'As it is on your card.', autocomplete: 'name', 'data-testid': 'text-name'}),
      el('text-field', {label: 'Email', type: 'email', required: '', autocomplete: 'email', 'data-testid': 'text-email'}),
      el('text-field', {label: 'Password', type: 'password', minlength: '8', autocomplete: 'new-password', helper: 'Use 8 characters or more.', 'data-testid': 'text-password'}),
      el('text-field', {label: 'Search', type: 'search', placeholder: 'Find a component', 'data-testid': 'text-search'}),
      el('text-field', {label: 'Price', 'prefix-text': '$', 'suffix-text': 'USD', pattern: '\\d+(\\.\\d{2})?', inputmode: 'decimal', helper: 'For example 12.50', 'data-testid': 'text-price'}),
      el('shadow-text-field', {label: 'Code, in a shadow root', maxlength: '6', 'data-testid': 'text-shadow'}),
    ),
  );

  const areas = card('controls-area', 'Text areas', stack(
    el('text-area', {label: 'Comments', maxlength: '120', rows: '3', 'data-testid': 'area-count'}),
    el('text-area', {label: 'Notes, that grow with the text', autogrow: '', rows: '2', 'data-testid': 'area-grow'}),
  ));

  const spins = card('controls-spin', 'Spin boxes',
    stack(
      el('spin-box', {label: 'Quantity', min: '0', max: '20', value: '1', 'data-testid': 'spin-quantity'}),
      el('spin-box', {label: 'Weight in kg, German format', min: '0', step: '0.25', value: '1234.5', locale: 'de-DE', 'data-testid': 'spin-weight'}),
      el('shadow-spin-box', {label: 'Percent, in a shadow root', min: '0', max: '100', step: '5', value: '50', 'data-testid': 'spin-shadow'}),
    ),
  );

  const sliders = card('controls-sliders', 'Sliders', el('div', {style: COLUMN},
    el('slider-control', {label: 'Volume', value: '30', 'show-value': '', unit: '%', 'data-testid': 'slider-volume'}),
    withData(el('slider-control', {label: 'Rating', min: '1', max: '5', value: '3', ticks: '', 'show-value': '', 'data-testid': 'slider-rating'}),
      {marks: [{value: 1, label: 'Bad'}, {value: 3, label: 'OK'}, {value: 5, label: 'Good'}]}),
    el('div', {class: 'controls'},
      el('slider-control', {label: 'Bass', orientation: 'vertical', value: '60', 'show-value': '', 'data-testid': 'slider-vertical'}),
      el('shadow-slider-control', {label: 'Treble, in a shadow root', orientation: 'vertical', value: '40', 'show-value': '', 'data-testid': 'slider-shadow'}),
    ),
  ));

  const progress = el('progress-bar', {label: 'Upload', value: '20', 'show-value': '', 'data-testid': 'progress-value'});
  const progressCard = card('controls-progress', 'Progress bars', el('div', {style: COLUMN},
    progress,
    el('div', {class: 'controls'},
      button('progress-more', 'Add 20%', () => { progress.value = (progress.value + 20) % 120; }),
    ),
    el('progress-bar', {label: 'Connecting', 'show-value': '', 'data-testid': 'progress-busy'}),
    el('shadow-progress-bar', {label: 'In a shadow root', value: '75', 'show-value': '', 'data-testid': 'progress-shadow'}),
  ));

  const fromChildren = el('combo-box', {label: 'Country, from option elements', 'data-testid': 'combo-children'},
    el('option', {value: 'ca'}, 'Canada'),
    el('option', {value: 'mx'}, 'Mexico'),
    el('option', {value: 'us', selected: ''}, 'United States'),
  );
  const combos = card('controls-combo', 'Combo boxes',
    stack(
      withData(el('combo-box', {label: 'Fruit', placeholder: 'Select a fruit', 'data-testid': 'combo-select'}), {options: fruits}),
      withData(el('combo-box', {label: 'Fruit, type to filter', editable: '', placeholder: 'Type a fruit', 'data-testid': 'combo-editable'}), {options: fruits}),
      fromChildren,
      withData(el('shadow-combo-box', {label: 'Size, in a shadow root', 'data-testid': 'combo-shadow'}), {options: sizes}),
    ),
  );

  const lists = card('controls-lists', 'List boxes', el('div', {style: COLUMN},
    withData(el('list-box', {label: 'One fruit', 'data-testid': 'list-single'}), {options: fruits}),
    withData(el('list-box', {label: 'Many fruits', multiple: '', 'data-testid': 'list-multiple'}), {options: fruits}),
  ));

  const output = el('output', {'data-testid': 'controls-form-output'}, 'Not sent yet.');
  const form = el('form', {'data-testid': 'controls-form', style: STACK},
    el('text-field', {label: 'Your name', name: 'name', required: '', autocomplete: 'name', 'data-testid': 'form-name'}),
    el('check-box', {name: 'subscribe', value: 'yes', 'data-testid': 'form-subscribe'}, 'Subscribe'),
    el('toggle-switch', {name: 'dark', 'data-testid': 'form-dark'}, 'Dark theme'),
    withData(el('radio-group', {label: 'Plan', name: 'plan', required: '', 'data-testid': 'form-plan'}), {options: ['Free', 'Team', 'Business']}),
    el('spin-box', {label: 'Seats', name: 'seats', min: '1', max: '50', value: '3', 'data-testid': 'form-seats'}),
    el('slider-control', {label: 'Priority', name: 'priority', min: '1', max: '5', value: '2', ticks: '', 'show-value': '', 'data-testid': 'form-priority'}),
    withData(el('combo-box', {label: 'Fruit', name: 'fruit', 'data-testid': 'form-fruit'}), {options: fruits}),
    withData(el('list-box', {label: 'Toppings', name: 'toppings', multiple: '', 'data-testid': 'form-toppings'}), {options: ['Cream', 'Nuts', 'Sprinkles']}),
    el('text-area', {label: 'Message', name: 'message', 'data-testid': 'form-message'}),
    el('div', {class: 'controls'},
      el('push-button', {type: 'submit', variant: 'primary', 'data-testid': 'form-submit'}, 'Send'),
      el('push-button', {type: 'reset', 'data-testid': 'form-reset'}, 'Reset'),
    ),
    output,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {};
    for (const [key, value] of new FormData(form)) {
      data[key] = key in data ? [].concat(data[key], value) : value;
    }
    output.textContent = JSON.stringify(data);
  });
  form.addEventListener('reset', () => { output.textContent = 'Reset.'; });
  const formCard = card('controls-form-card', 'A form with each control', form);

  const all = [buttons, checks, radios, texts, areas, spins, sliders, progressCard, combos, lists, formCard];
  for (const item of all) { watch(item); }
  return [...all, card('controls-log-card', 'Events', log)];
}

export const section = {
  id: 'controls',
  title: 'Controls',
  render: controlsSection,
};
