// The gallery section of @catalystcommunity/actions. It has no components, so it shows one set of
// actions that native buttons and a shortcut map share.
import {Action, ActionGroup, ShortcutMap, formatShortcut, ariaShortcut} from '../../src/index.js';
import {card, el, makeLog} from '../kit.js';

export const definitions = {};

function actionButton(action, testId) {
  const element = el('button', {type: 'button', 'data-testid': testId});
  const show = () => {
    element.textContent = action.label;
    element.disabled = !action.enabled;
    if (action.checkable) { element.setAttribute('aria-pressed', String(action.checked)); }
    if (action.shortcut) {
      element.setAttribute('aria-keyshortcuts', ariaShortcut(action.shortcut));
      element.title = formatShortcut(action.shortcut);
    }
  };
  action.addEventListener('change', show);
  element.addEventListener('click', () => action.trigger(element));
  show();
  return element;
}

function render() {
  const log = makeLog('actions-log');
  const counter = el('output', {'data-testid': 'actions-count'}, '0');
  let count = 0;
  const add = new Action({id: 'add', label: 'Add one', shortcut: 'Mod+Shift+A', run: ({source}) => {
    counter.textContent = String(++count);
    log.add(`add from ${source?.dataset?.testid ?? source?.localName ?? 'code'}`);
  }});
  const lock = new Action({id: 'lock', label: 'Lock adding', checkable: true, run: () => {
    add.enabled = !lock.checked;
    log.add(lock.checked ? 'locked' : 'unlocked');
  }});
  const group = new ActionGroup();
  const sizes = ['Small', 'Medium', 'Large'].map(label => new Action({id: label.toLowerCase(), label, group, run: () => log.add(`size ${label}`)}));
  sizes[1].checked = true;

  const area = el('div', {class: 'controls', tabindex: '0', role: 'group', 'aria-label': 'Shortcut area', 'data-testid': 'actions-area'},
    actionButton(add, 'actions-add'), actionButton(lock, 'actions-lock'), counter);
  const map = new ShortcutMap([add]);
  map.attach(area);

  return [
    card('actions-shared', 'One action, many controls',
      el('p', {}, `Focus this box and press ${formatShortcut(add.shortcut)}, or select the button. Lock adding disables the action, so the button and the shortcut both stop.`),
      area,
      log,
    ),
    card('actions-group', 'A group with one checked action',
      el('div', {class: 'controls', role: 'group', 'aria-label': 'Size'}, ...sizes.map(action => actionButton(action, `actions-size-${action.id}`))),
    ),
  ];
}

export const section = {id: 'actions', title: 'Actions', render};
