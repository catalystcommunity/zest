// A desktop application from Zest parts: a menu bar and a toolbar that share actions, a tree of
// folders, a table of records, a form for one record, a chart, and a status bar. The window holds
// the state, and each part shows it, as a form of a GUI toolkit does.
import {Action, ActionGroup, attachContextMenu, showNotice, showMessage, askText, askConfirm} from '../../src/index.js';
import {people} from '../sections/data-views.js';
import {el} from '../kit.js';

const money = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});
const REGIONS = {
  Americas: ['Boise', 'Denver', 'Lima', 'Quito'],
  Europe: ['Oslo', 'Riga', 'Ulm', 'Zagreb'],
  'Africa and Asia Pacific': ['Kyoto', 'Lagos', 'Perth', 'Tunis'],
};

function folderTree() {
  return [{
    id: 'all', label: 'All records', icon: '🗂', expanded: true,
    children: Object.entries(REGIONS).map(([region, cities]) => ({
      id: `region:${region}`, label: region, icon: '📁', expanded: true,
      children: cities.map(city => ({id: `city:${city}`, label: city, icon: '📄'})),
    })),
  }];
}

function citiesOf(folder) {
  if (!folder || folder === 'all') { return null; }
  if (folder.startsWith('region:')) { return new Set(REGIONS[folder.slice(7)]); }
  return new Set([folder.slice(5)]);
}

export function renderDesktopExample() {
  const state = {records: people(5000), folder: 'all', filter: '', nextId: 5000};

  // The parts of the window
  const menu = el('menu-bar', {label: 'Records application', 'shortcuts-for': 'desktop-window', 'data-testid': 'desktop-menu'});
  const tools = el('tool-bar', {label: 'Records tools', 'data-testid': 'desktop-tools'});
  const tree = el('tree-view', {label: 'Folders', 'data-testid': 'desktop-tree'});
  const table = el('table-view', {label: 'Records', 'data-testid': 'desktop-table', multiple: ''});
  const nameField = el('text-field', {label: 'Name', required: '', 'data-testid': 'desktop-name'});
  const cityField = el('combo-box', {label: 'City', 'data-testid': 'desktop-city'});
  const amountField = el('spin-box', {label: 'Amount', min: '0', step: '0.01', 'data-testid': 'desktop-amount'});
  const activeField = el('check-box', {label: 'Active', 'data-testid': 'desktop-active'});
  const saveButton = el('push-button', {variant: 'primary', 'data-testid': 'desktop-save'}, 'Save the record');
  const form = el('form-layout', {}, nameField, cityField, amountField, activeField);
  const detailsHint = el('p', {'data-testid': 'desktop-details-hint'}, 'Select one record in the table.');
  const chart = el('canvas-view', {label: 'Total amount for each city', 'data-testid': 'desktop-chart'});
  const tabs = el('tab-view', {label: 'Views of the records', 'data-testid': 'desktop-tabs'},
    el('tab-page', {label: 'Table'}, table),
    el('tab-page', {label: 'Details'}, detailsHint, form, el('div', {class: 'desktop-buttons'}, saveButton)),
    el('tab-page', {label: 'Chart'}, chart),
  );
  const split = el('split-view', {sizes: '[1,3]', class: 'desktop-split', 'data-testid': 'desktop-split'},
    el('div', {label: 'Folders', 'min-size': '120'}, tree),
    el('div', {label: 'Records'}, tabs),
  );
  const countPane = el('status-pane', {stretch: '', live: '', 'data-testid': 'desktop-count'});
  const totalPane = el('status-pane', {'data-testid': 'desktop-total'});
  const status = el('status-bar', {label: 'Status'}, countPane, totalPane);
  const window_ = el('div', {class: 'desktop-window', id: 'desktop-window', 'data-testid': 'desktop-window'}, menu, tools, split, status);

  cityField.options = Object.values(REGIONS).flat().sort();
  tree.items = folderTree();

  // What the table shows: the folder, then the filter
  const visible = () => {
    const cities = citiesOf(state.folder);
    const text = state.filter.toLowerCase();
    return state.records.filter(record => (!cities || cities.has(record.city)) && (!text || record.name.toLowerCase().includes(text)));
  };
  const selected = () => table.selectedItems ?? [];

  table.columns = [
    {key: 'name', label: 'Name', width: 200},
    {key: 'city', label: 'City', width: 110},
    {key: 'amount', label: 'Amount', type: 'number', width: 130, format: value => money.format(value)},
    {key: 'joined', label: 'Joined', type: 'date', width: 130},
    {key: 'active', label: 'Active', width: 90, format: value => (value ? 'Yes' : 'No')},
  ];

  // The actions. The menu, the toolbar, the context menu, and the shortcuts all use these.
  const sortGroup = new ActionGroup();
  const actions = {
    add: new Action({id: 'add', label: '&New record', shortcut: 'Alt+Shift+N', icon: '＋', run: () => {
      const record = {id: state.nextId++, name: 'New person', city: 'Denver', amount: 0, joined: new Date(), active: true};
      state.records.unshift(record);
      showAll({select: record});
      tabs.selected = 1;
      showNotice({text: 'A new record is in the table.'});
    }}),
    duplicate: new Action({id: 'duplicate', label: '&Duplicate', shortcut: 'Alt+Shift+D', icon: '⧉', run: () => {
      const copies = selected().map(record => ({...record, id: state.nextId++, name: `${record.name} (copy)`}));
      state.records.unshift(...copies);
      showAll({select: copies[0]});
    }}),
    remove: new Action({id: 'remove', label: 'De&lete', shortcut: 'Delete', icon: '🗑', run: async () => {
      const doomed = new Set(selected());
      if (doomed.size > 1 && !await askConfirm({title: 'Delete records', text: `Delete ${doomed.size} records?`, okLabel: 'Delete'})) { return; }
      state.records = state.records.filter(record => !doomed.has(record));
      table.selectedKeys = [];
      showAll();
    }}),
    filter: new Action({id: 'filter', label: '&Filter…', shortcut: 'Mod+Shift+F', icon: '🔍', run: async () => {
      const text = await askText({title: 'Filter the records', label: 'Name contains', value: state.filter});
      if (text === null) { return; }
      state.filter = text;
      showAll();
    }}),
    folders: new Action({id: 'folders', label: 'Show the &folders', checkable: true, checked: true, run: ({action}) => {
      if (action.checked) { split.expand(0); } else { split.collapse(0); }
    }}),
    byName: new Action({id: 'by-name', label: 'Sort by &name', group: sortGroup, run: () => table.sortBy('name', 'ascending')}),
    byAmount: new Action({id: 'by-amount', label: 'Sort by &amount', group: sortGroup, run: () => table.sortBy('amount', 'descending')}),
    about: new Action({id: 'about', label: '&About', run: () => showMessage({
      title: 'About this application', kind: 'info',
      text: 'Each part of this window is a Zest component. The menu, the toolbar, and the keys share one set of actions.',
    })}),
  };

  menu.items = [
    {label: '&File', items: [actions.add, {separator: true}, actions.filter]},
    {label: '&Edit', items: [actions.duplicate, actions.remove]},
    {label: '&View', items: [actions.folders, {separator: true}, actions.byName, actions.byAmount]},
    {label: '&Help', items: [actions.about]},
  ];
  tools.items = [actions.add, actions.duplicate, actions.remove, {separator: true}, actions.filter, actions.folders];
  attachContextMenu(table, () => [actions.duplicate, actions.remove, {separator: true}, actions.add], {label: 'Record', container: window_});

  // Each part shows the state. Nothing here makes all of the window again.
  function showSelection() {
    const records = selected();
    actions.duplicate.enabled = records.length > 0;
    actions.remove.enabled = records.length > 0;
    const one = records.length === 1 ? records[0] : null;
    form.hidden = !one;
    saveButton.hidden = !one;
    detailsHint.hidden = Boolean(one);
    if (one) {
      nameField.value = one.name;
      cityField.value = one.city;
      amountField.value = one.amount;
      activeField.checked = one.active;
    }
    const shown = table.items.length;
    countPane.textContent = `${shown.toLocaleString()} records, ${records.length.toLocaleString()} selected`;
  }

  function showAll({select} = {}) {
    const rows = visible();
    table.items = rows;
    if (select) {
      table.selectedKeys = [select.id];
      table.scrollToIndex(rows.indexOf(select));
    }
    totalPane.textContent = `Total ${money.format(rows.reduce((sum, record) => sum + record.amount, 0))}`;
    chart.invalidate();
    showSelection();
  }

  table.addEventListener('table-view-select', showSelection);
  table.addEventListener('table-view-activate', () => { tabs.selected = 1; });
  table.addEventListener('table-view-sort', (e) => {
    sortGroup.actions.forEach(action => { action.checked = e.detail.key === (action === actions.byName ? 'name' : 'amount') && Boolean(e.detail.direction); });
  });
  tree.addEventListener('tree-view-select', (e) => {
    state.folder = e.detail.key;
    showAll();
  });
  split.addEventListener('split-view-resize', (e) => { actions.folders.checked = !e.detail.collapsed.includes(0); });
  saveButton.addEventListener('click', () => {
    const [record] = selected();
    if (!record || !nameField.value.trim()) { nameField.focus(); return; }
    Object.assign(record, {name: nameField.value.trim(), city: cityField.value || record.city, amount: Number(amountField.value) || 0, active: activeField.checked});
    // One changed record paints one row. A city change can move it out of the folder.
    if (visible().includes(record)) { table.refreshItem(record); chart.invalidate(); showSelection(); } else { showAll(); }
    showNotice({text: `${record.name} is saved.`});
  });

  chart.draw = (context, {width, height}) => {
    const totals = new Map();
    for (const record of table.items ?? []) { totals.set(record.city, (totals.get(record.city) ?? 0) + record.amount); }
    const entries = [...totals].sort((a, b) => b[1] - a[1]);
    const style = getComputedStyle(chart);
    const text = style.color;
    const bar = style.getPropertyValue('--zest-color-highlight').trim() || 'Highlight';
    context.font = `${Math.max(11, Math.min(14, width / 40))}px ${style.fontFamily}`;
    context.fillStyle = text;
    if (!entries.length) { context.fillText('No records', 12, 24); return; }
    const max = entries[0][1];
    const labelWidth = Math.min(90, width * 0.3);
    const row = Math.min(28, (height - 8) / entries.length);
    entries.forEach(([city, total], i) => {
      const y = 4 + i * row;
      context.fillStyle = text;
      context.fillText(city, 4, y + row * 0.65);
      context.fillStyle = bar;
      const length = Math.max(1, (width - labelWidth - 100) * total / max);
      context.fillRect(labelWidth, y + 3, length, row - 6);
      context.fillStyle = text;
      context.fillText(money.format(total), labelWidth + length + 6, y + row * 0.65);
    });
  };

  // A narrow window puts the folders above the records
  const narrow = matchMedia('(max-width: 48em)');
  const orient = () => split.setAttribute('orientation', narrow.matches ? 'vertical' : 'horizontal');
  orient();
  narrow.addEventListener('change', orient);

  actions.byName.checked = false;
  showAll();
  return [
    el('p', {}, 'Use the menu, the toolbar, the context menu of the table, or the keys: Alt+Shift+N adds a record, Delete deletes the selection, and Ctrl+Shift+F (Command+Shift+F on a Mac) filters. F10 goes to the menu bar.'),
    window_,
  ];
}
