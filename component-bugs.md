# Component bugs found by consumers

Each entry gives the package and version, the problem, how to see it, and the
fix that the consumer uses now. Upstream the fix, then remove the entry.

## Ichoi: keys in a virtual row control

- Package: `@catalystcommunity/data-views` 0.1.2.
- Component: `ListView`, through `VirtualView` in `src/virtual.js`.
- Problem: The list handles keys from buttons and fields inside a custom row.
  Space changes row selection and calls `preventDefault`. The focused button
  does not receive its normal Space action. Arrow keys also change the active
  row when a field needs them.
- Reproduce: Set `renderItem` to add a `push-button` to each row. Tab to the
  button. Press Space. Compare this with a button outside the list.
- Ichoi use: Each queue row has Play, Move up, Move down, and Remove controls.
- Current fix: Stop propagation of key and click events on the row action group.
  Keep native default actions enabled. Ichoi still uses list keyboard selection
  when the list itself has focus.
- Requested fix: In the list key handler, inspect `event.composedPath()`. Return
  when the key comes from a nested input, button, link, editable field, or another
  control. Add checks for Space, Enter, arrow keys, and shadow-root controls.

## Ichoi: responsive virtual cover grid

- Package: `@catalystcommunity/data-views` 0.1.2.
- Request: Add a virtual grid for cover art with a responsive column count.
  This is a component request, not a defect in the existing list.
- Ichoi use: Libraries contain thousands of albums. Only visible rows and a
  small buffer should load. The consumer must retain successful pages when
  another page fails. Queue opening changes the available grid width.
- Current fix: `src/ui/catalog.ts` in Ichoi uses Zest `virtualWindow`, a
  `ResizeObserver`, and a page cache. Each tile keeps its native link.
- Requested API: Expose the visible item range and allow sparse item data.
  Keep stable item keys and focused tiles during resize and scroll. Let the
  consumer show Retry for a failed page. Do not put network calls in the grid.
- Required checks: Resize with focus in a tile; restore a scrolled view; open a
  side panel; retry a failed page without reloading successful pages; use a
  keyboard and a screen reader to reach tiles outside the initial range.
