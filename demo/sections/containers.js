// The gallery section of @catalystcommunity/containers. definitions are the tags that the demo defines.
import {card, el, button, makeLog} from '../kit.js';
import {containerTags, showMessage, askConfirm, askText} from '../../src/index.js';

export const definitions = {...containerTags};

function wide(element) {
  element.classList.add('wide');
  return element;
}

function field(id, label, input) {
  input.id = id;
  return [el('label', {for: id}, label), input];
}

function listOf(...items) {
  return el('ul', {}, ...items.map(item => el('li', {}, item)));
}

function tabsCard(log) {
  const view = el('tab-view', {label: 'Project', 'data-testid': 'tabs-main'});
  // A split inside a tab, and a split inside that split
  const inner = el('split-view', {orientation: 'vertical', sizes: '[2,1]', 'data-testid': 'split-inner', style: 'min-height: 14em'},
    el('div', {label: 'Editor', class: 'pane', style: 'padding: 0 0.5em'}, el('p', {}, 'The editor pane. Drag the line below it, or use the arrow keys on it.')),
    el('div', {label: 'Output', class: 'pane', style: 'padding: 0 0.5em'}, el('p', {}, 'The output pane.')),
  );
  const outer = el('split-view', {sizes: '[1,2]', 'data-testid': 'split-outer', style: 'min-height: 16em'},
    el('div', {label: 'Files', class: 'pane', style: 'padding: 0 0.5em', 'min-size': '60'}, listOf('index.html', 'main.js', 'style.css')),
    inner,
  );
  const form = el('form-layout', {'data-testid': 'form-layout'},
    ...field('container-name', 'Name', el('input', {value: 'Zest'})),
    ...field('container-kind', 'Kind', el('select', {}, el('option', {}, 'Library'), el('option', {}, 'Application'))),
    el('p', {span: ''}, 'A child with span uses both columns.'),
  );
  view.append(
    el('tab-page', {label: 'Layout', id: 'tab-layout'}, outer),
    el('tab-page', {label: 'Settings', id: 'tab-settings'},
      el('group-box', {label: 'Project', 'data-testid': 'group-plain'}, form),
    ),
    el('tab-page', {label: 'Disabled', disabled: ''}, el('p', {}, 'You cannot select this page.')),
    el('tab-page', {label: 'About'}, el('p', {}, 'Each container holds the children of the application in slots.')),
  );
  view.addEventListener('tab-view-select', e => log.add(`tab-view-select ${e.detail.label}`));
  view.addEventListener('split-view-resize', e => log.add(`split-view-resize ${e.detail.sizes.map(Math.round).join(',')}`));
  return wide(card('containers-tabs', 'Tab view with a split view in it, and a split view in that', view));
}

function closableCard(log) {
  let count = 0;
  const view = el('tab-view', {label: 'Documents', closable: '', 'data-testid': 'tabs-closable'});
  const add = () => {
    count++;
    view.append(el('tab-page', {label: `Document ${count}`}, el('p', {}, `The text of document ${count}.`)));
  };
  for (let i = 0; i < 6; i++) { add(); }
  view.addEventListener('tab-view-close', e => {
    if (e.detail.label === 'Document 1') {
      e.preventDefault();
      log.add('tab-view-close Document 1 cancelled');
      return;
    }
    log.add(`tab-view-close ${e.detail.label}`);
  });
  const placement = el('select', {id: 'containers-placement', 'data-testid': 'tabs-placement'},
    ...['top', 'bottom', 'start', 'end'].map(value => el('option', {value}, value)));
  placement.addEventListener('change', () => view.setAttribute('placement', placement.value));
  return card('containers-closable', 'Tabs that close: Delete on a tab, or its × (Document 1 refuses)',
    el('div', {class: 'controls'}, el('label', {for: 'containers-placement'}, 'Placement'), placement, button('tabs-add', 'Add a tab', add)),
    view,
  );
}

function groupsCard(log) {
  const checkable = el('group-box', {label: 'Use a proxy', checkable: '', 'data-testid': 'group-checkable'},
    el('form-layout', {}, ...field('proxy-host', 'Host', el('input', {value: 'proxy.example'})), ...field('proxy-port', 'Port', el('input', {value: '8080', inputmode: 'numeric'}))),
  );
  checkable.addEventListener('group-box-check', e => log.add(`group-box-check ${e.detail.checked}`));
  const collapsible = el('group-box', {label: 'Advanced', collapsible: '', collapsed: '', 'data-testid': 'group-collapsible'},
    el('p', {}, 'Settings that most users do not need.'));
  collapsible.addEventListener('group-box-toggle', e => log.add(`group-box-toggle ${e.detail.collapsed}`));
  return card('containers-groups', 'Group boxes', el('box-layout', {direction: 'column'}, checkable, collapsible));
}

function accordionCard(log) {
  const view = el('accordion-view', {'data-testid': 'accordion'},
    el('accordion-section', {label: 'General', open: ''}, el('p', {}, 'Only one section is open at a time.')),
    el('accordion-section', {label: 'Appearance'}, el('p', {}, 'The up and down arrows go between the headings.')),
    el('accordion-section', {label: 'Shortcuts'}, el('p', {}, 'Home and End go to the first and the last heading.')),
  );
  view.addEventListener('accordion-section-toggle', e => log.add(`accordion-section-toggle ${e.composedPath()[0].label} ${e.detail.open}`));
  return card('containers-accordion', 'Accordion', view);
}

function scrollCard() {
  const area = el('scroll-area', {label: 'Release notes', 'data-testid': 'scroll-area', style: 'height: 12em'},
    el('strong', {slot: 'header'}, 'Release notes'),
    ...Array.from({length: 12}, (_, i) => el('p', {}, `Change ${i + 1}: a small fix.`)),
    el('span', {slot: 'footer'}, '12 changes'),
  );
  return card('containers-scroll', 'Scroll area with a header and a footer', area);
}

function dialogsCard(log) {
  const custom = el('dialog-window', {label: 'Save changes?', kind: 'question', 'data-testid': 'dialog-custom'},
    el('p', {}, 'The document has changes that are not saved.'),
    el('button', {slot: 'buttons', value: 'save', 'data-default': '', type: 'button'}, 'Save'),
    el('button', {slot: 'buttons', value: 'discard', type: 'button'}, 'Do not save'),
    el('button', {slot: 'buttons', value: 'cancel', type: 'button'}, 'Cancel'),
  );
  const modeless = el('dialog-window', {label: 'Find', 'data-testid': 'dialog-modeless'},
    el('form-layout', {}, ...field('find-text', 'Find', el('input', {}))),
    el('button', {slot: 'buttons', value: 'close', type: 'button'}, 'Close'),
  );
  const saving = savingDialog(log);
  const run = (name, start) => async () => log.add(`${name}: ${JSON.stringify(await start())}`);
  return card('containers-dialogs', 'Dialogs',
    el('div', {class: 'controls'},
      button('dialog-open-custom', 'Save changes', run('custom', () => custom.showModal())),
      button('dialog-open-modeless', 'Find (modeless)', run('modeless', () => modeless.show())),
      button('dialog-message', 'Message', run('message', () => showMessage({title: 'Done', text: 'The file is saved.'}))),
      button('dialog-error', 'Error', run('error', () => showMessage({title: 'Cannot open', text: 'The file is not there.', kind: 'error'}))),
      button('dialog-confirm', 'Confirm', run('confirm', () => askConfirm({title: 'Delete', text: 'Delete the file?', okLabel: 'Delete'}))),
      button('dialog-confirm-danger', 'Confirm (danger)', run('danger', () => askConfirm({
        title: 'Delete the project?', text: 'The project and its files go away. You cannot undo this.', okLabel: 'Delete', kind: 'warning', danger: true,
      }))),
      button('dialog-open-saving', 'Save on a server', run('saving', () => saving.showModal())),
      button('dialog-ask', 'Ask for text', run('ask', () => askText({title: 'Rename', label: 'New name', value: 'notes.txt', required: true}))),
    ),
    custom, modeless, saving,
  );
}

// A dialog that stays open while the application saves, and after an error. dialog-window-before-close
// stops the close, and close() closes it after the save.
function savingDialog(log) {
  const fail = el('input', {type: 'checkbox', id: 'saving-fail', 'data-testid': 'dialog-saving-fail', checked: ''});
  const status = el('p', {role: 'status', 'data-testid': 'dialog-saving-status', style: 'margin: 0; min-height: 1.5em'});
  const dialog = el('dialog-window', {label: 'Rename the project', 'data-testid': 'dialog-saving'},
    el('form-layout', {}, ...field('saving-name', 'Name', el('input', {value: 'Zest'}))),
    el('p', {style: 'display: flex; align-items: center; gap: 0.5em'}, fail, el('label', {for: 'saving-fail'}, 'The server gives an error')),
    status,
    el('push-button', {slot: 'buttons', value: 'save', variant: 'primary', 'data-default': '', 'data-testid': 'dialog-saving-save'}, 'Save'),
    el('push-button', {slot: 'buttons', value: 'cancel', 'data-testid': 'dialog-saving-cancel'}, 'Cancel'),
  );
  dialog.addEventListener('dialog-window-before-close', async (e) => {
    log.add(`dialog-window-before-close ${JSON.stringify({value: e.detail.value, reason: e.detail.reason})}`);
    if (e.detail.value !== 'save') {
      status.textContent = '';
      return;
    }
    e.preventDefault();
    const save = e.detail.button;
    save.disabled = true;
    status.textContent = 'Saving…';
    await new Promise(resolve => setTimeout(resolve, 300));
    save.disabled = false;
    if (fail.checked) {
      status.textContent = 'Error: the server did not save the name. Try again.';
      return;
    }
    status.textContent = '';
    dialog.close('save');
  });
  return dialog;
}

function windowsCard(log) {
  const area = el('window-area', {label: 'Documents', 'data-testid': 'window-area'},
    el('floating-window', {label: 'Notes', x: '16', y: '16', width: '260', height: '180', 'data-testid': 'window-notes'},
      el('p', {}, 'Drag the title bar to move. Drag the corner to change the size.')),
    el('floating-window', {label: 'Tasks', x: '120', y: '60', width: '240', height: '170', 'data-testid': 'window-tasks'},
      listOf('Write the tests', 'Look at a screenshot')),
    el('floating-window', {label: 'Help', x: '220', y: '110', width: '260', height: '160', 'data-testid': 'window-help'},
      el('p', {}, 'Alt+F7 moves and Alt+F8 sizes with the arrow keys. The ⠿ button does the same with clicks.')),
  );
  for (const name of ['floating-window-move', 'floating-window-resize', 'floating-window-state', 'floating-window-close']) {
    area.addEventListener(name, e => log.add(`${name} ${e.composedPath()[0].label} ${JSON.stringify(e.detail)}`));
  }
  return wide(card('containers-windows', 'Window area with three windows',
    el('div', {class: 'controls'},
      button('windows-cascade', 'Cascade', () => area.cascade()),
      button('windows-tile', 'Tile', () => area.tile()),
    ),
    area,
  ));
}

function statusCard() {
  const clock = el('status-pane', {width: '9em', 'data-testid': 'status-clock'}, 'Line 1, column 1');
  const message = el('status-pane', {stretch: '', live: '', 'data-testid': 'status-message'}, 'Ready');
  const bar = el('status-bar', {label: 'Editor status', 'data-testid': 'status-bar'}, message, clock, el('status-pane', {}, 'UTF-8'));
  const box = el('box-layout', {direction: 'column', gap: 'none', style: 'border: 1px solid; border-radius: 0.375em; overflow: hidden'},
    el('box-layout', {align: 'center', style: 'padding: 0.5em', wrap: ''},
      el('label', {for: 'status-input', stretch: ''}, 'Type to change the status'),
      el('input', {id: 'status-input', 'data-testid': 'status-input', stretch: ''}),
    ),
    bar,
  );
  box.querySelector('input').addEventListener('input', (e) => {
    message.textContent = e.target.value ? `Typed ${e.target.value.length} characters` : 'Ready';
    clock.textContent = `Line 1, column ${e.target.value.length + 1}`;
  });
  return card('containers-status', 'Status bar, in a box layout', box);
}

export const section = {
  id: 'containers',
  title: 'Containers',
  render: () => {
    const log = makeLog('containers-log');
    return [
      tabsCard(log),
      closableCard(log),
      groupsCard(log),
      accordionCard(log),
      scrollCard(),
      dialogsCard(log),
      windowsCard(log),
      statusCard(),
      card('containers-events', 'Events', log),
    ];
  },
};
