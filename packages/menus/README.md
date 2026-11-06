# `Menus`

Menu bars, popup menus, context menus, menu buttons, toolbars, tooltips, and notices. Each menu and toolbar shows actions from `@catalystcommunity/actions`.

## Usage

```js
import { Action, ActionGroup } from '@catalystcommunity/actions';
import { MenuBar, PopupMenu, ToolBar, ToolTip, attachContextMenu, showNotice } from '@catalystcommunity/menus';

customElements.define('menu-bar', MenuBar);
customElements.define('tool-bar', ToolBar);

const save = new Action({id: 'save', label: '&Save', shortcut: 'Mod+S', icon: '💾', run: () => saveFile()});
const wrap = new Action({id: 'wrap', label: '&Word wrap', checkable: true, run: ({action}) => setWrap(action.checked)});

const bar = document.querySelector('menu-bar');
bar.items = [
  {label: '&File', items: [save, {separator: true}, {label: 'Open &recent', items: recentFiles}]},
  {label: '&View', items: [wrap]},
];
document.querySelector('tool-bar').items = [save, {separator: true}, wrap];
```

```html
<div id="editor">
  <menu-bar label="Editor" shortcuts-for="editor"></menu-bar>
  <tool-bar label="Editor tools" icons-only></tool-bar>
  <textarea aria-label="Document"></textarea>
</div>
```

Each component also has a `Shadow...` class with an open shadow root: `ShadowMenuBar`, `ShadowPopupMenu`, `ShadowMenuButton`, and `ShadowToolBar`.

## Design

- **One action, many places.** A menu item, a toolbar button, and a shortcut can use the same `Action`. When the action changes, for example it becomes disabled, each of them shows the change at once.
- **Selecting an item calls `action.trigger(element, detail)`.** The `run` function of the action gets `detail.menu` from a menu, `detail.toolbar` from a toolbar, and `detail.event` from a shortcut.
- **A disabled item can get the focus.** The user can find it with the keyboard, but it does not run.
- **A popup uses the Popover API**, so that a parent with `overflow: hidden` cannot clip it. A browser with no Popover API shows it with `position: fixed`.
- **The components remove their listeners when they disconnect**, also the listeners on the actions.

## Menu Data

The `items` property of a menu bar, a popup menu, a menu button, and a toolbar is an array. Each entry is one of these:

| Entry | Result |
| --- | --- |
| An `Action` | An item. A `checkable` action is a check item. An action of an `ActionGroup` is a radio item. |
| `{action}` | The same as the action. |
| `{label, shortcut, run, icon, checkable, enabled}` | An item. The menu makes one `Action` for the object, and keeps it. |
| `{separator: true}` | A line. A line at the start, at the end, or next to another line is removed. |
| `{label, items}` or `{action, items}` | A submenu. In a toolbar, a button that opens a menu. |

- `&` in a label marks the mnemonic letter: `&File` shows "File" with the "F" underlined. `&&` shows one `&`.
- An `icon` is the path of an image, or a short text such as a symbol.
- `menuEntries(items)` gives the entries as the menus read them. `menuActions(items)` gives each action, also from submenus.

## MenuBar

| Attribute | Default | Description |
| --- | --- | --- |
| `label` | `Menu` | The name of the menu bar. |
| `shortcuts-for` | | `document`, or the ID of an element. Each shortcut of the menus works while the focus is in that element. |
| `alt-key` | `true` | Alt alone moves the focus to the bar. Set `alt-key="false"` to stop this. |

- `bindShortcuts(element)` does the same as `shortcuts-for`, and returns the removal function.
- `focusBar()`, `openMenu(indexOrLabel, focus)`, and `closeMenus()`.
- The bar sends `menu-bar-select` for an item of the bar that is not a menu. The menus send `popup-menu-select`.

| Key | Action |
| --- | --- |
| F10, or Alt alone | Moves the focus to the bar. Escape gives the focus back. |
| Alt and a mnemonic letter | Opens that menu. |
| Left arrow, Right arrow | The previous or the next menu. With a menu open, opens that menu. |
| Down arrow, Enter, Space | Opens the menu, with the focus on the first item. |
| Up arrow | Opens the menu, with the focus on the last item. |
| A letter | Goes to the menu that starts with the letter, or opens the menu of the mnemonic. |

With a pointer, a click opens a menu. While a menu is open, the pointer opens the menu under it.

## PopupMenu

A popup menu is a menu that the application opens.

```js
const menu = document.createElement('popup-menu');
menu.items = [save, wrap];
document.body.append(menu);
menu.open({anchor: button, placement: 'bottom-start'});    // or {x, y}
menu.close();
```

- `open({anchor, x, y, placement, focus, opener})`. `focus` is `first`, `last`, or `none`. `opener` gets the focus when the menu closes. The default is the focused element.
- `close({returnFocus})`, `isOpen`, and `menuElement` (the element with `role="menu"`).
- The menu sends `popup-menu-open`, `popup-menu-close` with `{reason}`, and `popup-menu-select` with `{id, action}`.
- A submenu opens on the right side, and on the left side in a right-to-left page.
- A pointer press outside the menus, a change of the window size, and a scroll of the page close the menus. A scroll that starts before the menu opens does not close it. For example, a focus that moves the page and then the key that opens the menu.

| Key | Action |
| --- | --- |
| Up arrow, Down arrow, Home, End | Moves between the items. |
| A letter | The mnemonic item runs. With no mnemonic, the focus goes to the next item that starts with the letter. |
| Enter, Space | Runs the item, or opens the submenu. Space runs on the key release, so that the release does not go to the opener. |
| Right arrow | Opens the submenu. In a menu bar, goes to the next menu. |
| Left arrow | Closes the submenu. In a menu bar, goes to the previous menu. |
| Escape | Closes the menu, and gives the focus back. A modal dialog does not also close. |
| Tab | Closes all menus. The focus moves on from the opener. |

## Context Menus

```js
const remove = attachContextMenu(element, (event) => [cut, copy, paste], {label: 'Document'});
```

- The menu opens on a right click at the pointer, and on Shift+F10 or the context menu key at the focused element.
- `items` is the data, or a function that gets the event and gives the data. With no items, the menu does not open, and the browser shows its own menu.
- The `container` option is where the menu element goes. The default is the root of the element. Put it in a part of the page that goes away with the element.
- Call the removal function when the element goes away.

## MenuButton

```html
<menu-button label="Export"></menu-button>
<menu-button split more-label="More save options"></menu-button>
```

- A button that opens a menu. The Down arrow, Enter, and Space open it with the focus on the first item. The Up arrow opens it with the focus on the last item.
- `split`: the main part runs `action`, or the first action of the items. The arrow part opens the menu.
- `open(focus)`, `close()`, and `menu` (the popup menu). It sends `menu-button-select` with `{id, action}`.

## ToolBar

| Attribute | Default | Description |
| --- | --- | --- |
| `label` | `Toolbar` | The name of the toolbar. |
| `icons-only` | | Only the icon shows. The label is the name of the button. |
| `orientation` | `horizontal` | `horizontal` or `vertical`. |
| `wrap` | | The items go on more lines. With no `wrap`, the items that do not fit go into a "More" menu. |
| `more-label` | `More` | The name of the "More" button. |

- A checkable action is a toggle button with `aria-pressed`.
- A button with a shortcut, a description, or only an icon gets a tooltip with the label and the shortcut.
- The toolbar is one stop in the tab order. The arrow keys, Home, and End move in it.
- It sends `tool-bar-select` with `{id, action}`.

## Tooltips

```js
const remove = attachToolTip(button, 'Bold (Ctrl+B)', {placement: 'top', delay: 500});
```

```html
<button id="bold" aria-label="Bold">B</button>
<tool-tip for="bold">Bold (Ctrl+B)</tool-tip>
```

- The tooltip shows when the pointer stays on the element, and at once when the focus comes from the keyboard. It does not show for a touch.
- It stays while the pointer is on the tooltip, so that the user can read it. Escape hides it and does nothing else. This obeys WCAG 1.4.13.
- The element gets `aria-describedby`. The text can be a function, which gives the text each time that the tooltip shows.
- Only one tooltip shows at a time.

## Notices

```js
const notice = showNotice({text: 'The file was saved.', kind: 'success'});
showNotice({text: 'The file was deleted.', action: {label: 'Undo', run: undoDelete}});
const reason = await notice.closed;   // 'timeout', 'dismiss', 'action', or 'code'
```

- `kind` is `info`, `success`, `warning`, or `error`. Each kind has a symbol and a hidden word for a screen reader, so the kind does not show with color only.
- An error goes in a region with `role="alert"`. The other kinds go in a region with `role="status"`.
- The default time is 6 seconds, and 10 seconds for a warning. An error stays until the user closes it. Set `timeout: 0` to keep a notice.
- The time stops while the pointer or the focus is on the notice.
- Each notice has a Dismiss button. `notice.close()` closes it from code.
- The notices go in one `notice-area` at the end of the page. Make a `NoticeArea` and give it as `area` to show notices in a different place. Its `max` property is the number of notices that show at one time.

## Look

The components read tokens in this order: the widget token, then the family token, then the global tokens, then the system colors. The menus use the `menu` family: `--zest-menu-face`, `--zest-menu-border`, and the others.

| Token | Use |
| --- | --- |
| `--zest-popup-menu-item-height` | The smallest height of a menu item, `2em`. |
| `--zest-popup-menu-font-size` | The font size of a menu. |
| `--zest-tool-bar-button-size` | The smallest width and height of a toolbar button, `2.25em`. |
| `--zest-tool-tip-face`, `--zest-tool-tip-text` | The colors of a tooltip. |

Each target is 24 by 24 CSS pixels or more. The focus ring is a 2px outline. A checked item shows a check mark, a radio item shows a dot, and a pressed toolbar button shows a border and a shadow, so that no state shows with color only.
