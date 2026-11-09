// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { Action } from '@catalystcommunity/actions';
import { attachContextMenu, attachToolTip, defineMenus, escapeMnemonic, menuEntries, showNotice, type MenuItems } from '@catalystcommunity/menus';

defineMenus();
const save = new Action({id: 'save', label: '&Save', shortcut: 'Mod+S', icon: '💾', run: () => {}});
const wrap = new Action({id: 'wrap', label: '&Word wrap', checkable: true, run: ({action}) => { console.log(action.checked); }});
const recent: MenuItems = ['a.txt', 'R&D.txt'].map(name => ({label: name, run: () => {}, mnemonic: false as const}));

const bar = document.createElement('menu-bar');
bar.shortcutsFor = 'document';
bar.items = [
    {label: '&File', items: [save, {separator: true}, {label: 'Open &recent', items: recent}]},
    {label: '&View', items: [wrap, {action: {label: escapeMnemonic('R&D'), run: () => {}}}]},
];
bar.addEventListener('popup-menu-select', (e) => { console.log(e.detail.id); });
bar.openMenu('File');

const tools = document.createElement('tool-bar');
tools.iconsOnly = true;
tools.mnemonics = false;
tools.items = [save, {separator: true}, wrap];
tools.addEventListener('tool-bar-select', (e) => { console.log(e.detail.action.label); });

const button = document.createElement('menu-button');
button.label = 'Account';
button.items = [{label: 'Sign out', run: () => {}}];
button.addEventListener('menu-button-select', (e) => { console.log(e.detail.id); });

const menu = document.createElement('popup-menu');
menu.items = [save, wrap];
document.body.append(menu);
menu.open({anchor: button, placement: 'bottom-start'}).addEventListener('popup-menu-close', (e) => { console.log(e.detail.reason); });

const removeMenu = attachContextMenu(document.body, (event) => (event.shiftKey ? null : [save]), {label: 'Document', mnemonics: false});
const removeTip = attachToolTip(button, () => 'Account (Ctrl+A)', {placement: 'top'});
const hasMnemonic: boolean = menuEntries([save]).every(entry => entry.type !== 'action' || entry.mnemonic);

const notice = showNotice({text: 'The file was deleted.', kind: 'success', action: {label: 'Undo', run: () => {}, mnemonic: false}});
void notice.closed.then((reason) => { if (reason === 'action') { removeMenu(); removeTip(); } });
void hasMnemonic;
