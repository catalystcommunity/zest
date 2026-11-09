// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { defineDataViews, TableView, TreeView, tableSortOrder, type TableColumn, type TreeNode } from '@catalystcommunity/data-views';

interface Person { id: number; name: string; amount: number; joined: Date; }
const people: Person[] = [{id: 1, name: 'Ada', amount: 12.5, joined: new Date()}];

defineDataViews();
const table = document.createElement('table-view') as TableView<Person>;
const columns: TableColumn<Person>[] = [
    {key: 'name', label: 'Name', width: 180},
    {key: 'amount', label: 'Amount', type: 'number', format: (value: number) => value.toFixed(2)},
    {key: 'joined', label: 'Joined', type: 'date', sortValue: (person) => person.joined},
];
table.columns = columns;
table.items = people;
table.multiple = true;
table.addEventListener('table-view-activate', (e) => { console.log(e.detail.index, e.detail.column); });
table.addEventListener('table-view-sort', (e) => { if (e.detail.direction === 'descending') { e.preventDefault(); } });
table.sortBy('name', 'ascending');
const firstSelected: Person | undefined = table.selectedItems[0];
const order: number[] = tableSortOrder(people, columns[1], 'descending', 'en');

interface Folder extends TreeNode { id: string; label: string; children?: Folder[]; }
const tree = document.querySelector('tree-view') as TreeView<Folder> | null;
if (tree) {
    tree.checkboxes = true;
    tree.items = [{id: 'root', label: 'Root', hasChildren: true}];
    tree.loadChildren = async (node) => [{id: `${node.id}/a`, label: 'A'}];
    tree.addEventListener('tree-view-expand', (e) => { console.log(e.detail.expanded); });
    void tree.setExpanded(tree.items[0], true);
    const keys: unknown[] = tree.checkedKeys;
    void keys;
}

const list = document.createElement('list-view');
list.items = ['one', 'two'];
list.addEventListener('list-view-select', (e) => { console.log(e.detail.keys.length); });
list.scrollToIndex(1);
void [firstSelected, order];
