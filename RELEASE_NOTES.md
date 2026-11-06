# Release Notes

## Before the Release

Seven packages are new. Publish them one time before you merge:

```sh
./tools.sh release first-publish
```

The new packages are `actions`, `controls`, `containers`, `menus`, `data-views`, `spreadsheet`, and `media`. Wait until `npm view @catalystcommunity/<package>` shows each package before you start the release. If you do not wait, the release preflight stops.

## New Packages

| Package | Contents |
| --- | --- |
| `actions` | Commands with a label, a shortcut, and an enabled or checked state. Menus, toolbars, and keys use the same command. |
| `controls` | Buttons, check boxes, switches, radio groups, text fields, text areas, spin boxes, sliders, progress bars, combo boxes, and list boxes. They operate in forms. |
| `containers` | Group boxes, tabs, splitters, accordions, scroll areas, dialogs, floating windows, status bars, and layouts. |
| `menus` | Menu bars, popup menus, context menus, menu buttons, toolbars, tooltips, and notices. |
| `data-views` | Lists, trees, and tables. They make only the rows that you can see. |
| `spreadsheet` | A spreadsheet with typed cells, formulas, undo, copy and paste, and keyboard editing. |
| `media` | Video and audio players, a canvas view, and an image view. |

The `zest` package exports all of them.

## Changes to Existing Packages

### `base-components`

- New: typed `static properties`.
- New: `static renderTiming = 'frame'`. The component renders a maximum of one time in each frame.
- New: shared resize and visibility observers (`observeResize`, `observeVisibility`).
- New: helpers for composition, keyboard focus in a group, popups, and tokens.
- Changed: `emit(name, detail, options)` accepts a third argument. Use `{cancelable: true}` to make an event that a listener can cancel.
- Changed: a form control in the light DOM sets `tabindex="-1"` on its host element. The host sends the focus to the inner control.

### `basic-data-service`

- Changed: the store finds subscribers by key. A write to one key does not examine all subscribers.
- Changed: subscribers to a key receive calls in the sequence that they subscribed.

## Changes to the Build

- In CI, the browser tests use 3 workers. More workers stopped browser tabs in the 4 GiB container.
- `ZEST_E2E_PORT` lets you run more than one set of browser tests at the same time.

## Demo Site

- New: the demo site at <https://zest.catalystsquad.com>. It has a home page, the component gallery, and the three examples. See `website/README.md`.
- Before the first deploy, apply the three new grants in `.reactorcide/secret-grants.yaml` for the node `zest-website-deploy`.
- The site has its own version, in the tag `website/vX.Y.Z`. After each merge, the `zest-release` workflow deploys the site when the commits give a new site version. The first deploy is `website/v0.2.0`. `./tools.sh site plan` shows the next version.
