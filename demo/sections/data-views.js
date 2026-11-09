// The gallery section of @catalystcommunity/data-views. definitions are the tags that the demo defines.
import {ListView, ShadowListView, TreeView, ShadowTreeView, TableView, ShadowTableView} from '../../src/index.js';
import {button, card, el, makeLog} from '../kit.js';

export const definitions = {
  'list-view': ListView,
  'shadow-list-view': ShadowListView,
  'tree-view': TreeView,
  'shadow-tree-view': ShadowTreeView,
  'table-view': TableView,
  'shadow-table-view': ShadowTableView,
};

// The same data each time, so that the tests can find a row
function random(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const FIRST = ['Ada', 'Grace', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Alan', 'Frances', 'Edsger', 'Hedy'];
const LAST = ['Lovelace', 'Hopper', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson', 'Perlman', 'Turing', 'Allen', 'Dijkstra', 'Lamarr'];
const CITIES = ['Denver', 'Lagos', 'Oslo', 'Kyoto', 'Lima', 'Perth', 'Quito', 'Riga', 'Tunis', 'Ulm', 'Zagreb', 'Boise'];

export function people(count) {
  const next = random(7);
  const pick = (list) => list[Math.floor(next() * list.length)];
  const start = Date.UTC(2015, 0, 1);
  return Array.from({length: count}, (_, id) => ({
    id,
    name: `${pick(FIRST)} ${pick(LAST)}`,
    city: pick(CITIES),
    amount: Math.round(next() * 1000000) / 100,
    joined: new Date(start + Math.floor(next() * 4000) * 86400000),
    active: next() > 0.3,
  }));
}

const money = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});

// A file system that is not real. A folder gets its children after a short wait, as from a server.
function folder(path, depth) {
  return {id: path, label: path.split('/').at(-1), icon: '📁', hasChildren: depth < 6};
}
function loadFolder(node) {
  const depth = node.id.split('/').length;
  return new Promise(resolve => setTimeout(() => resolve([
    ...['src', 'docs', 'assets'].map(name => folder(`${node.id}/${name}`, depth)),
    ...Array.from({length: 4}, (_, i) => ({id: `${node.id}/file-${i + 1}.txt`, label: `file-${i + 1}.txt`, icon: '📄'})),
  ]), 250));
}

let styled = false;

function render() {
  if (!styled) {
    styled = true;
    ListView.addStyles(`.zest-list-view .city { flex: none; color: var(--_secondary-text); font-size: 0.875em; }
.zest-list-view [aria-selected="true"] .city { color: inherit; }`);
  }
  const log = makeLog('data-views-log');
  const listen = (element, names) => {
    for (const name of names) {
      element.addEventListener(name, (e) => {
        const {keys, key, index, expanded, checked, direction, width} = e.detail;
        const parts = [name, key ?? index, expanded ?? checked ?? direction ?? width, keys && `(${keys.length} selected)`];
        log.add(parts.filter(part => part !== undefined && part !== null && part !== '').join(' '));
      });
    }
  };

  const tree = el('shadow-tree-view', {label: 'Files', checkboxes: '', 'data-testid': 'data-views-tree'});
  tree.loadChildren = loadFolder;
  tree.items = [
    {id: 'home', label: 'home', icon: '🏠', hasChildren: true, expanded: false},
    {id: 'projects', label: 'projects', icon: '📁', expanded: true, children: [
      folder('projects/zest', 1),
      folder('projects/reactorcide', 1),
      {id: 'projects/notes.md', label: 'notes.md', icon: '📄'},
    ]},
    {id: 'readme.txt', label: 'readme.txt', icon: '📄'},
  ];
  listen(tree, ['tree-view-select', 'tree-view-expand', 'tree-view-activate', 'tree-view-check']);

  const items = people(100000);
  const list = el('list-view', {label: 'People', multiple: '', 'data-testid': 'data-views-list'});
  list.items = items;
  list.itemText = (item) => item.name;
  list.renderItem = (item, row) => {
    if (!row.firstChild) {
      row.innerHTML = '<span class="zest-label"></span><span class="city"></span>';
    }
    row.children[0].textContent = `${item.id + 1}. ${item.name}`;
    row.children[1].textContent = item.city;
  };
  listen(list, ['list-view-select', 'list-view-activate']);

  const table = el('table-view', {label: 'People and amounts', multiple: '', 'data-testid': 'data-views-table'});
  table.columns = [
    {key: 'id', label: 'ID', type: 'number', width: 80, format: (value) => String(value + 1)},
    {key: 'name', label: 'Name', width: 180},
    {key: 'city', label: 'City', width: 110},
    {key: 'amount', label: 'Amount', type: 'number', width: 130, format: (value) => money.format(value)},
    {key: 'joined', label: 'Joined', type: 'date', width: 140},
    {key: 'active', label: 'Active', type: 'boolean', width: 80, align: 'center'},
  ];
  table.locale = 'en-US';
  table.items = items;
  listen(table, ['table-view-select', 'table-view-activate', 'table-view-sort', 'table-view-resize']);

  // One item changes. Only its rows render again.
  const change = button('data-views-change-row', 'Add $100 to person 1', () => {
    items[0].amount += 100;
    items[0].name = items[0].name.endsWith('★') ? items[0].name : `${items[0].name} ★`;
    table.refreshItem(items[0]);
    list.refreshItem(items[0]);
    log.add(`changed person 1 to ${money.format(items[0].amount)}`);
  });

  return [
    card('data-views-tree-card', 'Tree view: folders load when they open, with check boxes (shadow DOM)', tree),
    card('data-views-list-card', 'List view: 100,000 people, multiple selection', list),
    el('div', {class: 'card wide', 'data-testid': 'data-views-table-card'},
      el('h3', {}, 'Table view: 100,000 rows. Select a header to sort. Drag the edge of a header to resize.'),
      table,
      el('div', {class: 'controls'}, change),
    ),
    card('data-views-log-card', 'Events', log),
  ];
}

export const section = {id: 'data-views', title: 'Data views', render};
