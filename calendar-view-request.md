# Request: calendar-view package

Status: Accepted with changes (2026-11-01). Requested by catalystcal for
Longhouse. Not started. Starts after the design system work merges, because
this package uses those tokens and base classes.

Delete this request when the package is released.

## Changes to This Request

The items below replace the matching text in the rest of this document.

1. **Date logic:** use the first option, a new `date-model` package.
   `model.js` has no imports and no DOM access, so the move is small.
2. **Tokens:** use `--zest-calendar-view-*`, not `--zest-cal-*`. A widget token
   uses the full tag name. Read each value in this order: widget, family,
   global, system color. See `packages/design-tokens/README.md`.
3. **Styles and events:** use `static styles`, `applyStyles()`, `emit()`, and
   `lifetime` from `base-components`.
4. **Dragging:** each move and resize must also work with one click or tap and
   with the keyboard, with no drag. WCAG 2.5.7 (Level AA) requires this.
5. **Event colors:** `color` paints a stripe on the item, not its background.
   An app gives any color, so text on that color can have too little contrast.
   Text uses the token colors. Color is never the only sign of a difference.
6. **Tests:** `e2e/accessibility.spec.js` must cover each view in light and
   dark, and at a width of 320 CSS pixels. Each item and the "+N more" control
   must be 24 by 24 CSS pixels or more.
7. **SolidJS:** do not add SolidJS to zest. `prop:events` sets a property, and
   `on:name` adds an event listener. The zest tests do these two things with
   plain DOM calls. The catalystcal adapter holds the SolidJS test.
8. **Phases:** release in this order, so that the first users can give feedback
   before the hardest work starts:
   1. `date-model`.
   2. `calendar-view` for reading: all the views, selecting, and the keyboard.
   3. Moving and resizing items.

## The problem

Longhouse will use catalystcal as the source of its calendar data.
Longhouse and the catalystcal web app each have their own calendar UI in
SolidJS. A third app would make a third copy. zest must have one calendar
component that each app can use.

## Decisions

1. **The component shows data. It does not fetch data.** This is the zest
   rule (`base-components`, `date-time-picker`). The app gives events to
   the component. The component sends DOM events back.
2. **No catalystcal dependency in zest.** The catalystcal TypeScript client
   is CommonJS and does network I/O. A small adapter in the catalystcal
   repo changes catalystcal occurrences into the view data of this
   component. The adapter is not part of this request.
3. **Plain custom elements**, with a light-DOM class and a `Shadow*`
   class, the same as the other packages.

## Work items

### 1. Make the date logic importable

`packages/date-time-picker/src/model.js` has the date functions that the
calendar needs (`addDays`, `addMonths`, `weekday`, `isoWeek`,
`fromInstant`, `toInstant`, `firstDayOfWeek`, `weekdayNames`, the cached
`Intl` formatters). Today a sibling package must deep-import
`src/model.js`.

Do one of these:

- Move the functions to a new package `date-model`. `date-time-picker`
  then depends on it.
- Add an `exports` map to `date-time-picker` with a `./model` entry, and
  make the umbrella test accept a subpath import.

The first option is cleaner. Never call `new Intl.*` directly. Use the
cached formatters.

### 2. Package `calendar-view`

Make it with `./mknewpackage.sh CalendarView`.

Views: `month`, `week`, `day`, `agenda`. A `days` attribute sets a
custom number of days for the time-grid view (for example 3).

Attributes: `view`, `date` (the anchor date, `YYYY-MM-DD`), `locale`,
`time-zone`, `first-day-of-week`, `day-start` and `day-end` (the visible
hours of the time grid), `readonly`.

Data (a property or `updateConfig`, not an attribute):

```js
{
  events: [{
    id,            // text, unique in the list (one occurrence)
    seriesId,      // text, optional: the recurring series
    title,         // text; absent for busy-only items
    start, end,    // instants (UTC text, "2026-10-15T17:00:00Z") or dates for all-day
    allDay,        // bool
    color,         // CSS color, optional
    busyOnly,      // bool: show "Busy", no details
    editable,      // bool: the user can move or resize this item
    calendarId,    // text, optional, for the app's own use
  }],
}
```

DOM events (bubbles, composed, the same as `date-time-picker`):

| Event | `detail` | When |
| --- | --- | --- |
| `calendar-range-changed` | `{ view, start, end }` | The visible range changes. The app fetches events for this range. |
| `calendar-event-select` | `{ id }` | The user opens an item. |
| `calendar-slot-select` | `{ start, end, allDay }` | The user selects empty time (click or drag). The app opens its editor. |
| `calendar-event-move` | `{ id, start, end }` | The user drags or resizes an editable item. The app saves it, then sends new data. |

The component does not change its data after a move. The app sends the
saved result. If the save fails, the app sends the old data again.

Layout rules:

- Month view: all-day and multi-day items as spans across the days; a
  "+N more" control when a day is full.
- Time grid: items that overlap share the column width.
- The current time line in the time grid.
- Times show in `time-zone`. An all-day item uses its date, not an instant.

Styling: CSS custom properties with the prefix `--zest-cal-`, system
colors by default, `::part()` names on the shadow variant.

Accessibility: a keyboard model for the grid (arrows, Home/End,
PageUp/PageDown, Enter to open), labels from `Intl`, and an
`aria-live="polite"` region that tells the new range.

### 3. Demo and tests

- A gallery section in `demo/gallery.js` (the e2e test requires it).
- jsdom tests for the layout functions (spans, overlap columns, range
  calculation).
- Playwright tests for drag, resize, and keyboard actions.
- A test that a SolidJS app can set the `events` property
  (`prop:events`) and listen to the events (`on:calendar-range-changed`).
  Both first users are SolidJS apps.

## Reference

The catalystcal web app has working SolidJS versions of these views. Use
them as a reference for the layout rules:

- `catalystcal/webapp/src/components/MonthView.tsx`
- `catalystcal/webapp/src/components/TimeGrid.tsx`
- `catalystcal/webapp/src/components/AgendaView.tsx`
- `catalystcal/webapp/src/components/MiniMonth.tsx`

## Later, not in this request

- An `event-editor` package (title, time, all-day, recurrence, attendees).
- A recurrence editor.
