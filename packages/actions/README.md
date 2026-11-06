# `Actions`

Commands that menus, toolbars, buttons, and keyboard shortcuts share. An action has a label, a shortcut, and an enabled and a checked state. When a state changes, each control that shows the action changes too. This package has no DOM components.

## Usage

```js
import { Action, ActionGroup, ShortcutMap } from '@catalystcommunity/actions';

const save = new Action({id: 'save', label: 'Save', shortcut: 'Mod+S', run: () => saveDocument()});
const bold = new Action({id: 'bold', label: 'Bold', shortcut: 'Mod+B', checkable: true});

// The shortcuts work while the focus is in the editor
const shortcuts = new ShortcutMap([save, bold]);
class MyEditor extends BaseComponent {
  connectedCallback() {
    super.connectedCallback();
    this.own(shortcuts.attach(this));
  }
}

save.enabled = false;   // each menu item and each toolbar button of "save" is now disabled
```

## Design

- **One command, many controls.** The application makes one action for each command. A menu item and a toolbar button get the same action. They do not keep their own copy of the state.
- **Events, not callbacks only.** An action is an `EventTarget`. It sends `change` with `detail.changed`, the names of the states that changed. It sends `trigger` before it runs. A `trigger` listener can call `preventDefault()` to stop the action.
- **Shortcuts belong to a part of the page.** A `ShortcutMap` listens for `keydown` on one element. The shortcut works while the focus is in that element, as in a window of a GUI toolkit. A map on a child element hears the key first. When a map runs an action, it stops the key, so a parent map and the browser do not also use it.

## Action

| Option | Default | Description |
| --- | --- | --- |
| `id` | | Necessary. A name for the action. |
| `label` | the `id` | The words in a menu or on a button. |
| `shortcut` | | For example `'Mod+S'`. See Shortcuts. |
| `icon` | | Anything that a control can show, for example a URL or a symbol. |
| `description` | | Text for a tooltip or a status bar. |
| `enabled` | `true` | A disabled action does not run. |
| `checkable` | `false` | A toggle, for example Bold. |
| `checked` | `false` | The state of a toggle. |
| `run` | | A function. It gets `{action, source, ...detail}`. |
| `group` | | An `ActionGroup`. |

- Each option except `id` and `run` is also a property. A change of a property sends `change`.
- `update({label, enabled, ...})` changes many states and sends one `change` event.
- `trigger(source, detail)` runs the action. It returns `false` if the action is disabled or a listener stopped it. A checkable action changes its `checked` state first. `source` is the control that the user used.
- `actionsFrom({save: {label: 'Save', run}})` makes actions from plain objects. The key is the `id`.

## ActionGroup

An `ActionGroup` keeps one checked action, for example the alignments Left, Center, and Right. Each action in a group is checkable. When one action becomes checked, the others become not checked. A trigger on the checked action keeps it checked.

## ShortcutMap

| Member | Description |
| --- | --- |
| `new ShortcutMap(actions, {ignoreInFields})` | `ignoreInFields` is `true` by default. |
| `add(action)` | Returns a function that removes the action. |
| `remove(action)` | |
| `attach(element)` | Listens for `keydown` on the element. Returns the removal function. Give it to `own()`. |
| `find(event)` | The action of a key event, or `null`. |
| `handle(event)` | Runs the action of the event, and stops the key. |

- While the user types in a text field, a shortcut with no Ctrl, Alt, or Meta does not run. F keys and Escape still run. Set `ignoreInFields: false` to change this.
- A disabled action does not run, but its key is still stopped. This is the same as a menu shortcut of a desktop application.

## Shortcuts

- Write a shortcut as modifiers and one key, joined with `+`: `'Mod+Shift+Z'`, `'Ctrl+S'`, `'F2'`, `'Alt+ArrowDown'`, `'Delete'`.
- `Mod` is Command on a Mac, and Ctrl on other systems. Use `Mod` for most shortcuts.
- The parts are not case sensitive. The names `Cmd`, `Option`, `Esc`, `Up`, `Down`, `Left`, `Right`, `Space`, and `Plus` are also correct.
- A letter shortcut also works with a keyboard layout that is not Latin, because the map then reads the key position.
- `formatShortcut('Mod+Shift+Z')` gives the text for a menu: `⇧⌘Z` on a Mac, and `Ctrl+Shift+Z` on other systems.
- `ariaShortcut('Mod+Shift+Z')` gives the value for `aria-keyshortcuts`, for example `Control+Shift+Z`.
- `parseShortcut(text)` and `matchesShortcut(event, shortcut)` are also available.
