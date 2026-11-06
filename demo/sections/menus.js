// The gallery section of @catalystcommunity/menus. definitions are the tags that the demo defines.
import {
  Action, ActionGroup,
  MenuBar, ShadowMenuBar, PopupMenu, ShadowPopupMenu, MenuButton, ShadowMenuButton, ToolBar, ShadowToolBar,
  ToolTip, NoticeArea, attachContextMenu, attachToolTip, showNotice,
} from '../../src/index.js';
import {button, card, el, makeLog} from '../kit.js';

export const definitions = {
  'menu-bar': MenuBar,
  'shadow-menu-bar': ShadowMenuBar,
  'popup-menu': PopupMenu,
  'shadow-popup-menu': ShadowPopupMenu,
  'menu-button': MenuButton,
  'shadow-menu-button': ShadowMenuButton,
  'tool-bar': ToolBar,
  'shadow-tool-bar': ShadowToolBar,
  'tool-tip': ToolTip,
  'notice-area': NoticeArea,
};

// Where an action came from, for the log
function sourceOf(detail) {
  if (detail.event) { return 'shortcut'; }
  if (detail.menu) { return 'menu'; }
  if (detail.toolbar) { return 'toolbar'; }
  if (detail.notice) { return 'notice'; }
  return 'button';
}

// The actions of a small text editor. Each menu, toolbar, and shortcut below uses these objects.
function editorActions(log, textarea) {
  const run = ({action, ...detail}) => log.add(`${action.id} from the ${sourceOf(detail)}`);
  const align = new ActionGroup();
  const actions = {
    open: new Action({id: 'open', label: '&Open…', shortcut: 'Mod+O', icon: '📂', run}),
    save: new Action({id: 'save', label: '&Save', shortcut: 'Mod+S', icon: '💾', run}),
    saveAs: new Action({id: 'save-as', label: 'Save &as…', shortcut: 'Mod+Shift+S', run}),
    undo: new Action({id: 'undo', label: '&Undo', icon: '↶', enabled: false, run}),
    redo: new Action({id: 'redo', label: '&Redo', icon: '↷', enabled: false, run}),
    cut: new Action({id: 'cut', label: 'Cu&t', icon: '✂', run}),
    copy: new Action({id: 'copy', label: '&Copy', icon: '⧉', run}),
    paste: new Action({id: 'paste', label: '&Paste', icon: '📋', run}),
    find: new Action({id: 'find', label: '&Find…', shortcut: 'Mod+F', icon: '🔍', run}),
    wrap: new Action({
      id: 'wrap', label: '&Word wrap', shortcut: 'Alt+Z', icon: '↩', checkable: true, checked: true,
      run: (detail) => { textarea.wrap = actions.wrap.checked ? 'soft' : 'off'; run(detail); },
    }),
    zoomIn: new Action({id: 'zoom-in', label: 'Zoom &in', shortcut: 'Mod+Alt+=', run}),
    zoomOut: new Action({id: 'zoom-out', label: 'Zoom &out', shortcut: 'Mod+Alt+-', run}),
  };
  for (const [id, label, icon] of [['left', '&Left', '⇤'], ['center', '&Center', '↔'], ['right', '&Right', '⇥']]) {
    actions[id] = new Action({
      id: `align-${id}`, label, icon, group: align, checked: id === 'left',
      run: (detail) => { textarea.style.textAlign = id; run(detail); },
    });
  }
  textarea.addEventListener('input', () => { actions.undo.enabled = true; });
  return actions;
}

function menuData(a) {
  return [
    {label: '&File', items: [a.open, {label: 'Open &recent', items: [{label: 'notes.txt', run: () => {}}, {label: 'plan.md', run: () => {}}]}, {separator: true}, a.save, a.saveAs]},
    {label: '&Edit', items: [a.undo, a.redo, {separator: true}, a.cut, a.copy, a.paste, {separator: true}, a.find]},
    {label: '&View', items: [a.wrap, {label: '&Zoom', items: [a.zoomIn, a.zoomOut]}, {separator: true}, a.left, a.center, a.right]},
  ];
}

function toolData(a) {
  return [a.open, a.save, {separator: true}, a.undo, a.redo, {separator: true}, a.cut, a.copy, a.paste, {separator: true}, a.wrap, a.left, a.center, a.right, {separator: true}, a.find];
}

function editorCard(log) {
  const textarea = el('textarea', {'aria-label': 'Document', rows: '5', 'data-testid': 'menus-document', class: 'menus-document'});
  textarea.value = 'Type here. Ctrl+S saves, F10 goes to the menu bar, and Shift+F10 opens the context menu.';
  const actions = editorActions(log, textarea);
  const bar = el('menu-bar', {'data-testid': 'menus-bar', label: 'Editor', 'shortcuts-for': 'menus-editor'});
  bar.items = menuData(actions);
  const toolbar = el('tool-bar', {'data-testid': 'menus-toolbar', label: 'Editor tools', 'icons-only': ''});
  toolbar.items = toolData(actions);
  const editor = el('div', {id: 'menus-editor', class: 'menus-editor'}, bar, toolbar, textarea);
  attachContextMenu(textarea, () => [actions.undo, {separator: true}, actions.cut, actions.copy, actions.paste, {separator: true}, actions.wrap], {container: editor, label: 'Document'});
  const toggle = button('menus-toggle-save', 'Disable Save', () => {
    actions.save.enabled = !actions.save.enabled;
    toggle.textContent = actions.save.enabled ? 'Disable Save' : 'Enable Save';
  });
  const result = card('menus-editor-card', 'A menu bar, a toolbar, and a context menu that share actions',
    el('p', {}, 'The menu bar, the toolbar, the context menu of the text, and the shortcuts use the same actions. Disable Save, and each of them shows it.'),
    editor,
    el('div', {class: 'controls'}, toggle),
  );
  result.classList.add('wide');
  return {card: result, actions};
}

function buttonsCard(log, actions) {
  const plain = el('menu-button', {label: 'Export', 'data-testid': 'menus-button'});
  plain.items = [
    {label: 'As PDF', run: () => log.add('export pdf from the menu button')},
    {label: 'As plain text', run: () => log.add('export text from the menu button')},
    {separator: true},
    {label: 'Send by e-mail', items: [{label: 'To me', run: () => log.add('send to me')}, {label: 'To the team', run: () => log.add('send to the team')}]},
  ];
  const split = el('menu-button', {split: '', 'data-testid': 'menus-split', 'more-label': 'More save options'});
  split.items = [actions.save, actions.saveAs];
  return card('menus-buttons', 'Menu buttons', el('div', {class: 'controls'}, plain, split));
}

function contextCard(log) {
  const box = el('div', {tabindex: '0', class: 'menus-context', 'data-testid': 'menus-context-box', role: 'group', 'aria-label': 'Context menu sample'},
    'Right-click here, or focus this box and press Shift+F10.');
  const pinned = new Action({id: 'pin', label: '&Pin', checkable: true, run: () => log.add(`pin is ${pinned.checked}`)});
  attachContextMenu(box, () => [
    pinned,
    {label: '&Rename', shortcut: 'F2', run: () => log.add('rename from the context menu')},
    {label: '&Delete', shortcut: 'Delete', run: () => log.add('delete from the context menu')},
    {separator: true},
    {label: '&Color', items: ['Red', 'Green', 'Blue'].map(color => ({label: color, run: () => log.add(`color ${color}`)}))},
  ], {container: box});
  return card('menus-context', 'Context menu', box);
}

function tipsCard() {
  const bold = el('button', {type: 'button', 'aria-label': 'Bold', 'data-testid': 'menus-tip-button', class: 'menus-icon-button'}, el('b', {'aria-hidden': 'true'}, 'B'));
  const italic = el('button', {type: 'button', id: 'menus-italic', 'aria-label': 'Italic', class: 'menus-icon-button'}, el('i', {'aria-hidden': 'true'}, 'I'));
  const markup = el('tool-tip', {for: 'menus-italic'}, 'Italic (Ctrl+I): from markup with the for attribute');
  const holder = el('div', {class: 'controls'}, bold, italic, markup);
  // The tooltip goes in the card, so that it leaves the page with the card
  attachToolTip(bold, 'Bold (Ctrl+B): the pointer can move onto this text', {container: holder});
  return card('menus-tips', 'Tooltips', el('p', {}, 'Hover or focus a button. Escape hides the tooltip.'), holder);
}

function noticesCard(log) {
  const make = (kind, text) => button(`menus-notice-${kind}`, `Show ${kind}`, () => {
    const notice = showNotice({text, kind, action: kind === 'info' ? {label: 'Undo', run: () => log.add('undo from the notice')} : null});
    notice.closed.then(reason => log.add(`${kind} notice closed: ${reason}`));
  });
  return card('menus-notices', 'Notices',
    el('p', {}, 'An error stays until you close it. Other notices close after a time, but not while the pointer or the focus is on them.'),
    el('div', {class: 'controls'}, make('info', 'The file was moved.'), make('success', 'The file was saved.'), make('warning', 'The disk is almost full.'), make('error', 'The file could not be saved.')));
}

function shadowCard(actions) {
  const bar = el('shadow-menu-bar', {label: 'Shadow editor', 'data-testid': 'menus-shadow-bar'});
  bar.items = menuData(actions);
  const toolbar = el('shadow-tool-bar', {label: 'Shadow tools', 'data-testid': 'menus-shadow-toolbar'});
  toolbar.items = [actions.save, actions.undo, {separator: true}, actions.wrap, {label: 'Align', icon: '↔', items: [actions.left, actions.center, actions.right]}];
  return card('menus-shadow', 'Shadow DOM, with the same actions', bar, toolbar);
}

function narrowCard(actions) {
  const toolbar = el('tool-bar', {label: 'Narrow tools', 'data-testid': 'menus-narrow-toolbar'});
  toolbar.items = toolData(actions);
  return card('menus-narrow', 'A narrow toolbar puts the rest in a "More" menu', el('div', {class: 'menus-narrow'}, toolbar));
}

export const section = {
  id: 'menus',
  title: 'Menus',
  render: () => {
    const log = makeLog('menus-log');
    const editor = editorCard(log);
    const style = el('style', {}, `
      @layer zest {
        .menus-editor { display: flex; flex-direction: column; gap: 0.5em; min-width: 0; }
        .menus-document { box-sizing: border-box; width: 100%; font: inherit; padding: 0.5em; }
        .menus-context { padding: 1.5em 1em; border: 1px dashed var(--zest-color-border); border-radius: var(--zest-control-radius); }
        .menus-narrow { max-width: 14em; }
        .menus-icon-button { min-width: var(--zest-control-height); }
      }
    `);
    return [
      style,
      editor.card,
      buttonsCard(log, editor.actions),
      contextCard(log),
      tipsCard(),
      noticesCard(log),
      narrowCard(editor.actions),
      shadowCard(editor.actions),
      card('menus-log-card', 'Log', log),
    ];
  },
};
