# `DateModel`

Dates and times for Zest components and for applications. It has no DOM, so it works in a browser, in a worker, and in Node.

## Usage

```js
import * as model from '@catalystcommunity/date-model';

const day = model.parseValue('2026-03-13', 'date');        // {year: 2026, month: 3, day: 13}
model.addDays(day, 3);                                      // {year: 2026, month: 3, day: 16}
model.startOfWeek(day, model.firstDayOfWeek('de-DE'));      // the Monday of that week
model.formatDisplay(day, 'date', {locale: 'fr-FR', format: 'long'});
model.toInstant({...day, hour: 9, minute: 0}, 'America/Denver');   // a Date
```

## Values

A value is a set of wall clock parts: `{year, month, day, hour, minute, second}`. The month is from 1 to 12. A value is not a `Date`, for two reasons:

- A local `Date` cannot hold a time that the clocks skip, for example 02:30 on the day that summer time starts.
- A date must not move when the time zone of the viewer changes.

Use `fromInstant(date, timeZone)` and `toInstant(parts, timeZone)` to change between a value and an instant. With no time zone, they use the zone of the browser. In a gap, `toInstant` moves the time forward. In an overlap, it takes the first of the two instants.

A kind says which parts matter: `year`, `month`, `week`, `date`, `time`, or `datetime`.

## Functions

| Group | Functions |
| --- | --- |
| Calendar math | `addDays`, `addMonths`, `daysInMonth`, `weekday` (0 is Sunday), `dayNumber`, `fromDayNumber`, `daysBetween`, `startOfWeek`, `compare`, `truncate` |
| ISO 8601 | `parseValue`, `formatValue`, `formatDate`, `formatTime`, `parseSelection`, `formatSelection`, `isoWeek`, `fromIsoWeek` |
| Time zones | `fromInstant`, `toInstant` |
| Locales | `firstDayOfWeek`, `usesTwentyFourHours`, `monthNames`, `weekdayNames`, `meridiemNames`, `formatNumber`, `formatDisplay`, `parseText` |
| Formatters | `dateFormat(locale, options)`, `numberFormat(locale, options)`, `relativeFormat(locale, options)`, `pluralRules(locale, options)` |
| Rules | `buildRules`, `dayIsDisabled`, `periodIsDisabled`, `timeIsDisabled`, `stepIsWrong`, `valueProblem`, `rangeProblem` |

`parseText` reads what a person types: ISO 8601, the text that `formatDisplay` writes in the locale, numbers in the order of the locale, a month name, a time such as "3pm" or "1530", or a word such as "tomorrow".

## Formatters

Making an `Intl` formatter is slow, and one component can ask for hundreds. `dateFormat`, `numberFormat`, `relativeFormat`, and `pluralRules` keep one formatter for each locale and set of options, and all components share it. Use them, and do not call `new Intl.*` in a component.

## Traps

- `new Date(y, m, d)` reads the years 0 to 99 as 1900 to 1999. This package sets the year separately.
- Do not use the standalone month names of a locale to read a date. Russian "март" is "марта" in a date. `parseText` reads the forms from `formatToParts`.
