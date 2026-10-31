# `DateTimePicker`

One element for each date and time input in a browser: a date, a time, both, a month, a week, or a year, as one value, a range, or a list of values. It has no dependencies other than `@catalystcommunity/base-components`.

```js
import { DateTimePicker, ShadowDateTimePicker } from '@catalystcommunity/date-time-picker';

customElements.define('date-time-picker', DateTimePicker);
```

```html
<date-time-picker mode="datetime" name="start" min="2024-03-01" minute-step="15"></date-time-picker>
```

To see each feature, run `npm run dev` and open `/gallery/date-time-picker`.

## Design

**The value is a wall clock.** The value is text in ISO 8601 form. It holds what the clock shows, with no time zone: `2024-03-15T09:00`. A date does not move when the viewer's time zone changes. The element keeps parts, not a `Date`, because a local `Date` cannot hold 02:30 on a day when the clocks skip that time. If you need an instant, each event gives a `Date` that uses the `time-zone` attribute.

**Data comes in, and events go out.** Data comes from attributes, the `value` property, `updateConfig`, or a data registry. Each result is a `CustomEvent` on the element. Each event bubbles and is composed, so an `EventBroker` subscriber hears it on the document. The element does not fetch data and does not keep data for the application.

**Asynchronous data uses the same two paths.** The rule functions are synchronous, because the element calls them while it draws. To load availability from a server, listen for `date-view-changed`, then call `updateConfig` with the result.

**A person can use each part with the keyboard, in each language.** The text and the numbers come from `Intl`. What the input shows, the input can read back. A test proves this in 16 languages.

**Limits of the design:**

- The calendar is Gregorian only. In a locale that has another default calendar, the element still uses the Gregorian calendar and writes in that language.
- The time has a precision of one second.
- A range or a list of `datetime` values has one time for each value. A time alone has no date, so a range of times cannot go through midnight. Use `datetime` for that.

## Modes

| `mode` | Value | Panel |
| --- | --- | --- |
| `date` (default) | `2024-03-15` | Calendar. A selection closes the panel. |
| `datetime` | `2024-03-15T09:00` | Calendar and time. The panel stays open until **Done**. |
| `time` | `09:00`, or `09:00:30` | Time. |
| `month` | `2024-03` | Grid of months. |
| `week` | `2024-W11` (ISO 8601) | Calendar with week numbers. A selection selects the whole week. |
| `year` | `2024` | Grid of years. |

| `selection` | Value | Behavior |
| --- | --- | --- |
| `single` (default) | One value | |
| `range` | `start/end` | The first selection starts the range. The second selection ends it, in either sequence. The old value stays until the new range is complete. |
| `multiple` | `a,b,c` | Each selection adds or removes a value. The values stay in sequence. |

## Attributes

An attribute comes before the same option from `updateConfig`. A boolean attribute is true when it is present, unless its value is `false`.

| Attribute | Default | Meaning |
| --- | --- | --- |
| `value` | | The first value, and the value that a form reset returns to. |
| `name` | | The name in a form, and in each event. |
| `initial-date` | today | The date that the panel starts at, with no selection. |
| `min`, `max` | | The limits. A date alone is the start of the day for `min` and the end of the day for `max`. A `min` after the `max` in `time` mode goes through midnight. |
| `min-time`, `max-time` | | A window on each day, for `datetime` mode. It can go through midnight. |
| `disabled-dates` | | Dates and ranges: `2024-03-10,2024-03-20/2024-03-22`. |
| `disabled-weekdays` | | Numbers, with 0 for Sunday: `0,6`. |
| `min-range-days`, `max-range-days` | | The length of a range, with both end days included. |
| `allow-disabled-in-range` | false | Let a range hold a day that is not available. |
| `hour-step`, `minute-step`, `second-step` | 1 | The steps of the time. Steps count from zero. |
| `include-seconds` | false | Show and write the seconds. |
| `twenty-four-hour-format` | from the locale | `false` makes 12 hours. Present makes 24 hours. |
| `default-time` | `00:00` | The time of a date with no time yet. |
| `time-view` | `selects` | `list` shows a list of times. With no `minute-step` the list has a step of 15 minutes. |
| `time-slots` | | The list of times to show: `09:00,10:30`. |
| `time-zone` | the browser | An IANA name for the instants in the events, and for "today" and "now". |
| `time-zone-selectable` | false | Show a select for the time zone. A change keeps the wall clock and moves the instant. |
| `locale` | the browser | A BCP 47 name, for the language and for the defaults below. |
| `first-day-of-week` | from the locale | 0 for Sunday, to 6. |
| `format` | `medium` | `short`, `medium`, `long`, `full`, or `iso`. |
| `months` | 1 | The number of months to show. |
| `show-week-numbers` | false | Show the ISO week numbers. |
| `fixed-weeks` | false | Always show six weeks. |
| `inline` | false | Show the panel in the page, with no input. |
| `clearable` | true | Show **Clear**. It does not show when the element is required. |
| `no-typing` | false | The panel opens, but the input takes no text. This stops a phone keyboard. |
| `placeholder` | a sample value | The text of the empty input. |
| `label` | | The accessible name of the input. A `<label for>` or `aria-label` also gives it. |
| `required`, `disabled`, `readonly` | false | As on an input. |
| `registry-name`, `data-register-func-name`, `register-data`, `instance-id` | | See [Data from a registry](#data-from-a-registry). |

## Properties and methods

| Name | Meaning |
| --- | --- |
| `value` | The value as text. A value set here sends no event, as on an input. Text that it cannot read clears the value and writes a console warning. |
| `valueAsDate`, `dates` | The value as a `Date`, or each value as a `Date`. A time alone is on today. |
| `mode`, `selection`, `locale`, `timeZone`, `viewMonth` | The values in effect. |
| `updateConfig(partial)` | Merge new data into the options, and draw again. |
| `openPicker()`, `closePicker()`, `changeMonth(offset)`, `clearDate()`, `selectDate(date)` | Do what a person does. |
| `form`, `validity`, `validationMessage`, `willValidate`, `checkValidity()`, `reportValidity()`, `setCustomValidity(text)` | As on an input. |
| `validationProblem` | The reason that the value is not valid, or `null`. The reasons are in `date-invalid`, below. |

## Events

Each event has `instanceId`, `name`, `mode`, and `selection` in its `detail`.

| Event | When | Also in `detail` |
| --- | --- | --- |
| `date-changed` | A person changes the value. | `value`, `date`, `dates`, `start`, `end`, `parts`, `timeZone` |
| `input`, `change` | At the same time, with no detail, for code that expects a form control. | |
| `date-range-start` | The first selection of a range. | `value`, `date` |
| `date-invalid` | The element refuses a selection or typed text. | `text`, `reason` |
| `date-view-changed` | The month on the screen changes. | `year`, `month`, `firstDate`, `lastDate`, `firstVisibleDate`, `lastVisibleDate` |
| `date-time-zone-changed` | A person selects a time zone. | `timeZone` |
| `date-picker-open`, `date-picker-close` | The panel opens or closes. | |

The `reason` is one of: `unreadable`, `before-min`, `after-max`, `disabled-date`, `disabled-time`, `step`, `range-too-short`, `range-too-long`, `disabled-in-range`. The `validationProblem` property also has `value-missing`.

```js
const broker = new EventBroker();
broker.SubscribeEvent('date-changed', 'my-subscriber', (eventName, detail) => {
  console.log(detail.instanceId, detail.value, detail.date);
});
```

## Data

These options can come from `updateConfig` or a registry. The options in the attribute table work too, with camelCase names, and a list can be an array. The functions below have no attribute form.

| Option | Meaning |
| --- | --- |
| `isDateDisabled(isoDate, parts)` | Return true when a person cannot select this date. |
| `isTimeDisabled(isoTime, parts, day)` | Return true when a person cannot select this time. |
| `getDayInfo(isoDate, parts)` | Return `{disabled, className, title, label, badge}`, or nothing. `label` goes to a screen reader, and `badge` is a small text on the day. |
| `timeSlots` | An array of `'09:00'` or `{value, label, disabled}`. |
| `presets` | An array of `{label, value}`. `value` is text, or a function that gets the wall clock now and returns text. |
| `formatDisplay(isoValue, parts)` | Your text for the input. |
| `parseText(text)` | Read typed text. Return an ISO value, or nothing to use the built-in reader. |
| `labels` | Your text for the parts of the panel. See `DEFAULT_LABELS` in `src/index.js`. |
| `validationMessages` | Your text for each reason. |
| `value` | Sets the value. |

### Data from a registry

```js
window.appDataRegistry.AddDataFunction('availability', (instanceId, registerData) => ({
  pickerConfig: { min: '2024-03-01', getDayInfo: (iso) => days[iso] },
  unregisterFunc: (instanceId) => { /* stop what you started */ },
}));
```

```html
<date-time-picker registry-name="appDataRegistry" data-register-func-name="availability"></date-time-picker>
```

### Data for each month

```js
picker.addEventListener('date-view-changed', async (e) => {
  days = await fetchAvailability(e.detail.firstVisibleDate, e.detail.lastVisibleDate);
  picker.updateConfig({ getDayInfo: (iso) => days[iso] });
});
```

## Typing

The input accepts ISO 8601, what it shows in the locale, numbers in the sequence of the locale (`3/15/2024` or `15.3.2024`), a month name (`March 15`), a time (`3pm`, `1530`, `15:30`), and words (`today`, `tomorrow`, `yesterday`, `now`, and the same words in the locale). A date with no year uses the current year. A range can use ` - `, ` – `, or ` to `, and multiple values use `;`. If the element cannot read the text, or the text is not allowed, the input shows the old value again and the element sends `date-invalid`.

## Keyboard

| Key | Where | What it does |
| --- | --- | --- |
| Down arrow | Input | Opens the panel, and goes to it. |
| Enter | Input | Accepts the text. If the text did not change, it submits the form. |
| Escape | Anywhere | Closes the panel, and goes to the input. A modal dialog around the element stays open. |
| Arrow keys | Grid | Next day, or next week. Right to left changes the direction. |
| Home, End | Grid | The first or last day of the week. |
| Page Up, Page Down | Grid | The previous or next month. With Shift, the year. |
| Enter, Space | Grid | Selects the day. |
| Tab | Panel | Goes through the parts. When the focus leaves the element, the panel closes. |

## Forms

The element is form-associated. It submits under its `name`, works with `required`, the form reset, a disabled `fieldset`, `<label for>`, and browser form restore. A value outside the limits sets the validity, so that `:invalid` and `reportValidity()` work.

## Styles

The panel uses the top layer through the Popover API, so an `overflow: hidden` box or a modal dialog does not clip it. The panel goes above the input if there is no space below, and it stays in the viewport.

The default colors are system colors, so they follow `color-scheme`. To change them, set these on the element or on a parent:

`--zest-dtp-accent`, `--zest-dtp-accent-text`, `--zest-dtp-background`, `--zest-dtp-text`, `--zest-dtp-muted`, `--zest-dtp-range`, `--zest-dtp-radius`, `--zest-dtp-day-size`

`ShadowDateTimePicker` also has these parts for `::part()`: `input`, `toggle`, `picker`, `calendar`, `day`, `time`.

To replace all the styles, use `override-style-template-id`. The class names to style are `.day`, `.selected`, `.in-range`, `.in-range-preview`, `.today`, `.other-month`, `.unavailable`, `.cell`, `.slot`, and `.badge`.
