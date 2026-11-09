# `CalendarView`

A calendar with month, week, day, and agenda views. The application gives the items. The calendar shows them, and sends an event for each thing that the user does.

## Usage

```js
import { CalendarView } from '@catalystcommunity/calendar-view';

customElements.define('calendar-view', CalendarView);
```

```html
<calendar-view view="week" time-zone="America/Denver" day-start="07:00" day-end="20:00"></calendar-view>
```

```js
const calendar = document.querySelector('calendar-view');
calendar.addEventListener('calendar-range-changed', async (e) => {
  calendar.events = await loadEvents(e.detail.start, e.detail.end);
});
calendar.addEventListener('calendar-event-move', async (e) => {
  await saveEvent(e.detail.id, e.detail.start, e.detail.end);
  calendar.events = await loadEvents(calendar.range.start, calendar.range.end);
});
```

`ShadowCalendarView` is the same element in an open shadow root.

## Design

- **The calendar shows data. It does not get data.** The application sets `events`. When the visible range changes, the calendar sends `calendar-range-changed`, and the application loads the items for that range.
- **The calendar does not change its items.** After a move, it shows the item in the new place, marked as pending, and sends `calendar-event-move`. The application saves the change and sets `events` again. If the save fails, the application sets the old items again, and the item goes back.
- **The grid shows the wall clock of the time zone.** An item keeps its place on a day when the clocks change.
- The date logic is in `@catalystcommunity/date-model`.

## Attributes

An attribute wins over the same option in `updateConfig`. When the application sets `view` or `date`, that value wins over a change that the user made.

A set of `view` or `date` to the value that shows does nothing. The calendar does not render, and the focus stays. The calendar compares a date by its value, so `'2026-03-13'` in new text is the same date. Thus an application can copy `calendar-range-changed` into its state and set `view` and `date` back from that state. Use `detail.date` for the date, not `detail.startDate`. In the month, `startDate` can be in the month before.

| Attribute | Default | Description |
| --- | --- | --- |
| `view` | `month` | `month`, `week`, `day`, or `agenda`. |
| `date` | today | The anchor date, `YYYY-MM-DD`. The view holds this date. |
| `days` | 1 for `day`, 7 for `agenda` | The number of days in the `day` and `agenda` views. For example, `view="day" days="3"`. |
| `locale` | the browser | The language of the dates and the times. |
| `time-zone` | the browser | An IANA time zone. |
| `first-day-of-week` | from the locale | 0 is Sunday. |
| `day-start`, `day-end` | `00:00`, `24:00` | The visible hours of the time grid. |
| `slot-minutes` | 30 | The length of one slot in the time grid. |
| `scroll-time` | `08:00` | The time grid scrolls to this time when the range changes. |
| `max-items` | 3 | The number of items in one day of the month. The rest go into "+N more". |
| `views` | `month,week,day,agenda` | The view buttons in the toolbar. With one view or none, there are no buttons. |
| `twenty-four-hour-format` | from the locale | `true` or `false`. |
| `readonly` | | The user can open items, but cannot select time or move items. |

## Items

Set the `events` property to an array, or call `updateConfig({events})`. Use a property, not an attribute.

```js
{
  id: 'a1',                           // text, unique in the array
  title: 'Standup',
  start: '2026-03-13T16:00:00Z',      // an instant (ISO 8601 text or a Date)
  end: '2026-03-13T16:30:00Z',
  allDay: false,
  color: '#1e7a3a',                   // optional, any CSS color
  tags: ['tentative'],                // optional, the state of the item
  busyOnly: false,                    // true: shows "Busy", with no title
  editable: true,                     // the user can move and resize it
  seriesId: 'daily-standup',          // optional, comes back in the events
  calendarId: 'work',                 // optional, comes back in the events
}
```

- An all-day item takes dates: `start: '2026-03-13'`. Its `end` is the day after its last day, as in iCalendar. With no `end`, it is one day.
- An item that crosses midnight shows on each day that it covers.
- `color` paints a stripe on the start of the item. The text always uses the token colors, because a color from the application can have too little contrast. Color is never the only sign of a difference.

### Tags

`tags` is an array of text. A tag tells the state of an item, for example `declined`. The calendar keeps each tag of letters, digits, and `-`, and writes it in lower case. It ignores other text.

For each tag, the item element gets:

- The class `zest-tag-<tag>`, for a light DOM style, for example `.zest-tag-declined`.
- The part `item-<tag>`, for a style through a shadow root, for example `::part(item-declined)`. The `item` part stays.
- Hidden text before the title, for a screen reader, for example "Declined, 3:00 PM Retro". The text comes from the `tags` label.

The calendar has default styles for four tags. Each style has a sign that is not a color.

| Tag | Default style | Hidden text |
| --- | --- | --- |
| `tentative` | A dashed edge, and the window color behind the text. | Tentative |
| `invited` | A dashed edge, and the window color behind the text. | Invited |
| `declined` | A line through the title, and the secondary text color. | Declined |
| `cancelled` | A line through the title, and the secondary text color. | Cancelled |

Another tag has no default style and no hidden text. Give it a style with its class or its part. Give it hidden text with `updateConfig({labels: {tags: {'needs-action': 'Needs an answer'}}})`. This object adds to the default texts. An empty text removes the hidden text of a tag. The month, the time grid, the all-day row, and the agenda show the tags.

## Events

Each event bubbles and is composed, so it leaves a shadow root. Each `detail` also has `instanceId`.

| Event | `detail` | When |
| --- | --- | --- |
| `calendar-range-changed` | `{view, date, start, end, startDate, endDate, timeZone}` | The calendar connects, or the visible range changes. `date` is the anchor date, the same as the `date` property. `start` and `end` are UTC instants. `endDate` is the day after the last day. |
| `calendar-event-select` | `{id, seriesId, calendarId, view}` | The user opens an item. |
| `calendar-slot-select` | `{start, end, allDay, view}` | The user selects empty time. Dates for all day, UTC instants for a time. |
| `calendar-event-move` | `{id, start, end, allDay, seriesId, calendarId, view}` | The user moves or resizes an editable item. The same form as `calendar-slot-select`. |

## Methods and Properties

- `events`: the items.
- `view` and `date`: read and set the view and the anchor date.
- `range`: the same object as the detail of `calendar-range-changed`.
- `previous()`, `next()`, `today()`, `goTo('2026-03-13')`.
- `updateConfig({events, labels, now})`: `labels` replaces the words. `labels.tags` gives the hidden text of each tag (see Tags). `now` is a function that gives a `Date`, for tests and for demonstrations.
- A data registry works as for the other Zest components. The register function returns `{calendarConfig}`.

## Keyboard

The grid has one cell in the tab order. Tab goes from that cell to the items that start in it.

| Key | Action |
| --- | --- |
| Arrow keys | The next day, or the next slot in the time grid. Up from the first slot goes to the all-day row. |
| Home, End | The first or the last day of the week, or of the visible days. |
| Page Up, Page Down | The previous or the next month or range. With Shift in the month, the previous or the next year. |
| Shift and an arrow key | Selects more days, or more time on the same day. |
| Enter, Space | Sends `calendar-slot-select` for the cell or the selection. On an item: opens it. |
| Escape | Stops a selection or a move. From an item: goes back to its cell. |

## Moving and Resizing

An editable item has a handle (⠿). Each change works with a drag, with clicks, and with the keyboard (WCAG 2.5.7).

- **Drag:** drag the item to move it. Drag its end edge to change the end. With touch, drag the handle, so that a touch on an item can scroll the page.
- **Clicks:** select the handle, then select a slot or a day. The item moves there. Select the handle a second time to change the end in place of the start. A third time stops. A banner tells what to do, and has a Cancel button.
- **Keyboard:** go to the handle, and press Space. The arrow keys move the item by one slot or one day. Press Space again to change the end. Enter saves, and Escape cancels.

A move keeps the length of the item. An item stays at least one slot long, or one day for an all-day item. The live region tells the new time after each step.

## Look

The calendar reads tokens in this order: `--zest-calendar-view-*`, then the family (`--zest-control-*`), then the global tokens (`--zest-color-*`), then the system colors.

| Token | Use |
| --- | --- |
| `--zest-calendar-view-item-face`, `-item-text` | The color of an item. |
| `--zest-calendar-view-stripe` | The stripe of an item with no `color`. |
| `--zest-calendar-view-face-selected` | Selected time. |
| `--zest-calendar-view-now` | The line of the time now. |
| `--zest-calendar-view-line` | The lines of the grid. |
| `--zest-calendar-view-item-height` | The height of an item in the month, `1.75em`. |
| `--zest-calendar-view-slot-height` | The height of a slot, `2.5em`. |
| `--zest-calendar-view-time-width` | The width of the time column. |
| `--zest-calendar-view-grid-height` | The largest height of the time grid before it scrolls, `36em`. |

The parts are `calendar`, `toolbar`, `title`, `status`, `grid`, `day`, `slot`, `item`, `more`, `now`, `agenda`, and `empty`. An item with tags also has `item-<tag>` for each tag.

Each class that the calendar puts on its own elements starts with `zest-`, so that a page rule for a plain class, such as `.row` or `.day`, does not change the calendar. The root class is `.zest-calendar`. Other classes for a light DOM style are `.zest-toolbar`, `.zest-title`, `.zest-status`, `.zest-month`, `.zest-week`, `.zest-day`, `.zest-today`, `.zest-other-month`, `.zest-time-grid`, `.zest-row`, `.zest-slot`, `.zest-all-day-cell`, `.zest-item`, `.zest-item-main`, `.zest-item-time`, `.zest-item-title`, `.zest-grip`, `.zest-more`, `.zest-now`, `.zest-agenda`, and `.zest-empty`.

```css
/* Light DOM */
calendar-view .zest-tag-declined { font-style: italic; }
calendar-view .zest-today .zest-day-number { outline: 1px solid; }
/* Shadow DOM */
shadow-calendar-view::part(item-tentative) { border-style: dashed; }
```

A narrow calendar hides the weekday names in the time grid and the times of month items. It decides from its own width, not the width of the page.

## Frameworks

A framework sets the `events` property and adds event listeners. In SolidJS, this is `prop:events={items()}` and `on:calendar-range-changed={load}`. The tests do the same two things with plain DOM calls.
