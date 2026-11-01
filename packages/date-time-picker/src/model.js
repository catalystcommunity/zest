// The date and time logic of the picker, with no DOM. A value here is a set of wall clock
// parts: {year, month, day, hour, minute, second}, with month from 1 to 12. A kind says which
// parts matter: year, month, week, date, time, or datetime.
//
// Wall clock parts and not a Date, because a local Date cannot hold 02:30 on a day when the
// clocks skip it, and a date must not move when the viewer's time zone changes.

// A page can hold many pickers, each one asks for hundreds of formatters, and making a formatter
// is slow. A formatter holds no state, so all pickers share one for each locale and options.
const formatters = new Map();

function formatter(Type, locale, options) {
    const key = `${Type.name}|${locale}|${JSON.stringify(options)}`;
    if (!formatters.has(key)) {
        formatters.set(key, new Type(locale, options));
    }
    return formatters.get(key);
}

const dateFormat = (locale, options) => formatter(Intl.DateTimeFormat, locale, options);
const numberFormat = (locale, options) => formatter(Intl.NumberFormat, locale, options);
export const relativeFormat = (locale, options) => formatter(Intl.RelativeTimeFormat, locale, options);

const pad = (value, width = 2) => String(value).padStart(width, '0');

const hasDate = (kind) => kind !== 'time';
const hasTime = (kind) => kind === 'time' || kind === 'datetime';

// Date.UTC reads the years 0 to 99 as 1900 to 1999, so set the year on its own
function toUtc(parts) {
    const date = new Date(0);
    date.setUTCFullYear(parts.year ?? 2000, (parts.month ?? 1) - 1, parts.day ?? 1);
    date.setUTCHours(parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0, 0);
    return date;
}

function fromUtc(date) {
    return {
        year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
        hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
    };
}

export function daysInMonth(year, month) {
    return toUtc({year, month: month + 1, day: 0}).getUTCDate();
}

export function addDays(parts, days) {
    const date = toUtc(parts);
    date.setUTCDate(date.getUTCDate() + days);
    return {...parts, ...pick(fromUtc(date), ['year', 'month', 'day'])};
}

// The day stays in the month: one month after January 31 is the last day of February
export function addMonths(parts, months) {
    const index = parts.year * 12 + (parts.month - 1) + months;
    const year = Math.floor(index / 12);
    const month = index - year * 12 + 1;
    return {...parts, year, month, day: Math.min(parts.day ?? 1, daysInMonth(year, month))};
}

function pick(source, names) {
    return Object.fromEntries(names.map(name => [name, source[name]]));
}

// 0 is Sunday
export function weekday(parts) {
    return toUtc(parts).getUTCDay();
}

export function dayNumber(parts) {
    return Math.floor(toUtc({year: parts.year, month: parts.month, day: parts.day}).getTime() / 86400000);
}

const COMPARE_FIELDS = {
    year: ['year'],
    month: ['year', 'month'],
    week: ['year', 'month', 'day'],
    date: ['year', 'month', 'day'],
    time: ['hour', 'minute', 'second'],
    datetime: ['year', 'month', 'day', 'hour', 'minute', 'second'],
};

export function compare(a, b, kind) {
    for (const field of COMPARE_FIELDS[kind]) {
        const difference = (a[field] ?? 0) - (b[field] ?? 0);
        if (difference !== 0) { return difference; }
    }
    return 0;
}

// ISO 8601 weeks start on Monday, and week 1 holds the first Thursday of the year
export function isoWeek(parts) {
    const thursday = addDays(parts, 3 - ((weekday(parts) + 6) % 7));
    const first = {year: thursday.year, month: 1, day: 1};
    return {year: thursday.year, week: Math.floor((dayNumber(thursday) - dayNumber(first)) / 7) + 1};
}

export function fromIsoWeek(year, week) {
    const january4 = {year, month: 1, day: 4};
    const monday = addDays(january4, -((weekday(january4) + 6) % 7));
    return addDays(monday, (week - 1) * 7);
}

// Reduce parts to what the kind holds. A week is stored as its Monday.
export function truncate(parts, kind) {
    switch (kind) {
        case 'year': return {year: parts.year};
        case 'month': return {year: parts.year, month: parts.month};
        case 'week': {
            const {year, week} = isoWeek(parts);
            return pick(fromIsoWeek(year, week), ['year', 'month', 'day']);
        }
        case 'date': return pick(parts, ['year', 'month', 'day']);
        case 'time': return {hour: parts.hour ?? 0, minute: parts.minute ?? 0, second: parts.second ?? 0};
        default: return {...pick(parts, ['year', 'month', 'day']), hour: parts.hour ?? 0, minute: parts.minute ?? 0, second: parts.second ?? 0};
    }
}

export function formatDate(parts) {
    return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatTime(parts, includeSeconds = false) {
    const base = `${pad(parts.hour ?? 0)}:${pad(parts.minute ?? 0)}`;
    return includeSeconds || parts.second ? `${base}:${pad(parts.second ?? 0)}` : base;
}

export function formatValue(parts, kind, includeSeconds = false) {
    switch (kind) {
        case 'year': return pad(parts.year, 4);
        case 'month': return `${pad(parts.year, 4)}-${pad(parts.month)}`;
        case 'week': {
            const {year, week} = isoWeek(parts);
            return `${pad(year, 4)}-W${pad(week)}`;
        }
        case 'date': return formatDate(parts);
        case 'time': return formatTime(parts, includeSeconds);
        default: return `${formatDate(parts)}T${formatTime(parts, includeSeconds)}`;
    }
}

function validDate(year, month, day) {
    return year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function validTime(hour, minute, second) {
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}

function zoneParts(date, timeZone) {
    const found = {};
    const format = dateFormat('en-US', {
        timeZone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    for (const {type, value} of format.formatToParts(date)) {
        found[type] = Number(value);
    }
    return pick(found, ['year', 'month', 'day', 'hour', 'minute', 'second']);
}

// The wall clock at an instant, in a time zone, or in the zone of this browser
export function fromInstant(date, timeZone) {
    if (timeZone) { return zoneParts(date, timeZone); }
    return {
        year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
        hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds(),
    };
}

// The instant of a wall clock. In a gap, when the clocks skip this time, it moves forward. In an
// overlap, when this time occurs twice, it takes the first. A local Date does the same.
export function toInstant(parts, timeZone) {
    if (!timeZone) {
        const date = new Date(0);
        date.setFullYear(parts.year ?? 2000, (parts.month ?? 1) - 1, parts.day ?? 1);
        date.setHours(parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0, 0);
        return date;
    }
    const wall = toUtc(parts).getTime();
    const offset = (time) => toUtc(zoneParts(new Date(time), timeZone)).getTime() - time;
    const firstOffset = offset(wall);
    const first = wall - firstOffset;
    const secondOffset = offset(first);
    if (secondOffset === firstOffset) { return new Date(first); }
    const second = wall - secondOffset;
    return new Date(offset(second) === secondOffset ? second : first);
}

const ISO_DATE = '(\\d{4})-(\\d{2})-(\\d{2})';
const ISO_TIME = '(\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.\\d+)?)?';
const ISO_PATTERNS = {
    year: new RegExp('^(\\d{4})$'),
    month: new RegExp('^(\\d{4})-(\\d{2})$'),
    week: new RegExp('^(\\d{4})-W(\\d{2})$'),
    date: new RegExp(`^${ISO_DATE}$`),
    time: new RegExp(`^${ISO_TIME}$`),
    datetime: new RegExp(`^${ISO_DATE}[T ]${ISO_TIME}$`),
    instant: new RegExp(`^${ISO_DATE}[T ]${ISO_TIME}(Z|[+-]\\d{2}(?::?\\d{2})?)$`),
};

// Strict ISO 8601, in any form that holds what the kind needs. A datetime reduces to a date, and
// a time with an offset becomes the wall clock in the time zone. A date alone is the start of the
// day for a datetime, or its end with {endOfDay: true}, which a maximum wants.
export function parseValue(text, kind, {timeZone, endOfDay} = {}) {
    if (typeof text !== 'string') { return null; }
    const value = text.trim();
    let match;
    if ((match = ISO_PATTERNS.instant.exec(value))) {
        const instant = new Date(value.replace(' ', 'T'));
        return Number.isNaN(instant.getTime()) ? null : truncate(fromInstant(instant, timeZone), kind);
    }
    if ((match = ISO_PATTERNS.datetime.exec(value))) {
        const [year, month, day, hour, minute, second] = match.slice(1).map(part => Number(part ?? 0));
        if (!validDate(year, month, day) || !validTime(hour, minute, second)) { return null; }
        return truncate({year, month, day, hour, minute, second}, kind);
    }
    if ((match = ISO_PATTERNS.time.exec(value))) {
        if (hasDate(kind)) { return null; }
        const [hour, minute, second] = match.slice(1).map(part => Number(part ?? 0));
        return validTime(hour, minute, second) ? {hour, minute, second} : null;
    }
    if ((match = ISO_PATTERNS.date.exec(value))) {
        const [year, month, day] = match.slice(1).map(Number);
        if (kind === 'time' || !validDate(year, month, day)) { return null; }
        const times = endOfDay ? {hour: 23, minute: 59, second: 59} : {};
        return truncate({year, month, day, ...times}, kind);
    }
    if ((match = ISO_PATTERNS.week.exec(value))) {
        const [year, week] = match.slice(1).map(Number);
        if (kind !== 'week' || week < 1 || isoWeek(fromIsoWeek(year, week)).week !== week) { return null; }
        return truncate(fromIsoWeek(year, week), 'week');
    }
    if ((match = ISO_PATTERNS.month.exec(value))) {
        const [year, month] = match.slice(1).map(Number);
        if (!['month', 'year'].includes(kind) || !validDate(year, month, 1)) { return null; }
        return truncate({year, month}, kind);
    }
    if ((match = ISO_PATTERNS.year.exec(value))) {
        const year = Number(match[1]);
        return kind === 'year' && year >= 1 ? {year} : null;
    }
    return null;
}

const SELECTION_SEPARATOR = {range: '/', multiple: ','};

// A selection in its string form. A range is an ISO 8601 interval: start/end. Multiple values
// have commas between them. Returns null when any part cannot be read, and [] for an empty string.
export function parseSelection(text, kind, selection = 'single', options = {}) {
    if (text === null || text === undefined || String(text).trim() === '') { return []; }
    const separator = SELECTION_SEPARATOR[selection];
    const pieces = separator ? String(text).split(separator) : [String(text)];
    if (selection === 'range' && pieces.length !== 2) { return null; }
    const values = pieces.map(piece => parseValue(piece, kind, options));
    if (values.includes(null)) { return null; }
    if (selection === 'range' && compare(values[0], values[1], kind) > 0) { values.reverse(); }
    return values;
}

export function formatSelection(values, kind, selection = 'single', includeSeconds = false) {
    return values.map(value => formatValue(value, kind, includeSeconds)).join(SELECTION_SEPARATOR[selection] ?? ',');
}

// What a locale does by default

const GREGORIAN = {calendar: 'gregory'};

export function firstDayOfWeek(locale) {
    try {
        const info = new Intl.Locale(locale);
        const week = info.getWeekInfo?.() ?? info.weekInfo;
        if (week) { return week.firstDay % 7; }
    } catch { /* an unknown locale takes the default */ }
    return 0;
}

export function usesTwentyFourHours(locale) {
    const cycle = dateFormat(locale, {hour: 'numeric'}).resolvedOptions().hourCycle;
    return cycle === 'h23' || cycle === 'h24';
}

export function monthNames(locale, style = 'long') {
    const format = dateFormat(locale, {...GREGORIAN, timeZone: 'UTC', month: style});
    return Array.from({length: 12}, (_, index) => format.format(toUtc({year: 2024, month: index + 1})));
}

// Index 0 is Sunday. January 7, 2024 was a Sunday.
export function weekdayNames(locale, style = 'short') {
    const format = dateFormat(locale, {...GREGORIAN, timeZone: 'UTC', weekday: style});
    return Array.from({length: 7}, (_, index) => format.format(toUtc({year: 2024, month: 1, day: 7 + index})));
}

export function formatNumber(value, locale, width = 1) {
    return numberFormat(locale, {useGrouping: false, minimumIntegerDigits: width}).format(value);
}

// What a person reads. `format` is iso, short, medium, long, or full.
export function formatDisplay(parts, kind, {locale, format = 'medium', twentyFourHours, includeSeconds = false} = {}) {
    if (format === 'iso' || kind === 'week') { return formatValue(parts, kind, includeSeconds); }
    const base = {...GREGORIAN, timeZone: 'UTC'};
    const instant = toUtc(parts);
    if (kind === 'year') { return dateFormat(locale, {...base, year: 'numeric'}).format(instant); }
    if (kind === 'month') { return dateFormat(locale, {...base, year: 'numeric', month: format === 'short' ? 'numeric' : 'long'}).format(instant); }
    const options = {...base};
    if (hasDate(kind)) { options.dateStyle = format; }
    if (hasTime(kind)) {
        // long and full add the name of the zone, and this wall clock has no zone
        options.timeStyle = includeSeconds || parts.second ? 'medium' : 'short';
        if (twentyFourHours !== undefined) { options.hourCycle = twentyFourHours ? 'h23' : 'h12'; }
    }
    return dateFormat(locale, options).format(instant);
}

// Reading what a person types

function digitNormalizer(locale) {
    const format = numberFormat(locale, {useGrouping: false});
    const digits = new Map();
    for (let digit = 0; digit <= 9; digit++) {
        digits.set(format.format(digit), String(digit));
    }
    return (text) => [...text].map(character => digits.get(character) ?? character).join('');
}

function numericOrder(locale, withYear = true) {
    const options = {...GREGORIAN, timeZone: 'UTC', month: 'numeric', day: 'numeric', ...(withYear ? {year: 'numeric'} : {})};
    return dateFormat(locale, options).formatToParts(toUtc({year: 2024, month: 3, day: 15}))
        .map(part => part.type)
        .filter(type => ['year', 'month', 'day'].includes(type));
}

function fullYear(text) {
    const value = Number(text);
    if (text.length > 2) { return value; }
    return value < 70 ? 2000 + value : 1900 + value;
}

// Each form that a locale writes a month in. Many languages use another form inside a full date:
// March alone is "март" in Russian, and in a date it is "марта".
function monthForms(locale) {
    const forms = [];
    const style = {...GREGORIAN, timeZone: 'UTC'};
    for (const [index] of monthNames(locale).entries()) {
        const instant = toUtc({year: 2024, month: index + 1, day: 5});
        for (const dateStyle of ['full', 'long', 'medium']) {
            const parts = dateFormat(locale, {...style, dateStyle}).formatToParts(instant);
            const position = parts.findIndex(item => item.type === 'month');
            if (position === -1) { continue; }
            // Letters joined to the month belong to the word: Hebrew writes "in March" as one word
            const joined = parts[position - 1]?.value.match(/[\p{L}\p{M}]+$/u)?.[0] ?? '';
            forms.push([parts[position].value, index + 1], [joined + parts[position].value, index + 1]);
        }
    }
    return forms;
}

const lettersOnly = (word, locale) => word.toLocaleLowerCase(locale).replace(/[^\p{L}\p{M}]/gu, '');

function monthFromWord(word, locale) {
    const clean = lettersOnly(word, locale);
    const candidates = [
        ...monthForms(locale),
        ...[monthNames(locale), monthNames(locale, 'short'), monthNames('en'), monthNames('en', 'short')]
            .flatMap(names => names.map((name, index) => [name, index + 1])),
    ]
        // A numeric form such as "3月" holds no name, and "月" alone would match each month
        .filter(([name]) => !/\p{Nd}/u.test(name))
        .map(([name, month]) => [lettersOnly(name, locale), month]);
    const exact = candidates.find(([name]) => name === clean);
    if (exact) { return exact[1]; }
    // An abbreviation of three letters or more: "sept" for September
    return clean.length >= 3 ? candidates.find(([name]) => name.startsWith(clean))?.[1] ?? null : null;
}

function readDate(text, kind, {locale, reference}) {
    const week = /(?:^|\D)(\d{4})\W*w(\d{1,2})(?:\D|$)|(?:^|\W)w(\d{1,2})\W+(\d{4})(?:\D|$)/i.exec(text);
    if (week && kind === 'week') {
        const [year, number] = week[1] ? [week[1], week[2]] : [week[4], week[3]];
        return parseValue(`${year}-W${pad(Number(number))}`, 'week');
    }
    const numbers = [];
    let month = null;
    for (const [token] of text.matchAll(/\d+|[\p{L}\p{M}]+\.?/gu)) {
        if (/^\d+$/.test(token)) {
            numbers.push(token);
        } else if (month === null) {
            month = monthFromWord(token, locale);
        }
    }
    let year;
    let day;
    if (kind === 'year') {
        return numbers.length === 1 && numbers[0].length !== 3 && Number(numbers[0]) > 0 ? {year: fullYear(numbers[0])} : null;
    }
    if (month !== null) {
        const yearIndex = numbers.findIndex(number => number.length >= 3 || Number(number) > 31);
        if (yearIndex !== -1) {
            year = Number(numbers[yearIndex]);
            numbers.splice(yearIndex, 1);
        }
        if (kind === 'month') {
            if (year === undefined && numbers.length === 1) { year = fullYear(numbers[0]); }
            day = 1;
        } else {
            if (numbers.length === 2) {
                [day, year] = [Number(numbers[0]), fullYear(numbers[1])];
            } else if (numbers.length === 1) {
                day = Number(numbers[0]);
            } else {
                return null;
            }
        }
        year = year ?? reference.year;
    } else if (kind === 'month') {
        if (numbers.length !== 2) { return null; }
        const [first, second] = numbers;
        [year, month] = first.length === 4 ? [Number(first), Number(second)] : [fullYear(second), Number(first)];
        day = 1;
    } else if (numbers.length === 3 && numbers[0].length === 4) {
        [year, month, day] = numbers.map(Number);
    } else if (numbers.length === 3) {
        const values = {};
        numericOrder(locale).forEach((type, index) => { values[type] = numbers[index]; });
        [year, month, day] = [fullYear(values.year), Number(values.month), Number(values.day)];
    } else if (numbers.length === 2) {
        const values = {};
        numericOrder(locale, false).forEach((type, index) => { values[type] = numbers[index]; });
        [year, month, day] = [reference.year, Number(values.month), Number(values.day)];
    } else {
        return null;
    }
    return validDate(year, month, day) ? {year, month, day} : null;
}

export function dayPeriods(locale) {
    const format = dateFormat(locale, {...GREGORIAN, timeZone: 'UTC', hour: 'numeric', hourCycle: 'h12'});
    const name = (hour) => format.formatToParts(toUtc({year: 2024, month: 1, day: 1, hour})).find(part => part.type === 'dayPeriod')?.value;
    return {am: ['am', 'a.m.', 'a', name(9)].filter(Boolean), pm: ['pm', 'p.m.', 'p', name(21)].filter(Boolean)};
}

function timeSeparatorPattern(locale) {
    const format = dateFormat(locale, {...GREGORIAN, timeZone: 'UTC', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'});
    return format.formatToParts(toUtc({year: 2024, month: 1, day: 1, hour: 10, minute: 30})).find(part => part.type === 'literal')?.value === '.' ? '[:.]' : ':';
}

// Finds a word for AM or PM by position, because the same letters can be inside a month name
function takeDayPeriod(text, locale) {
    const periods = dayPeriods(locale);
    for (const [name, words] of Object.entries(periods)) {
        for (const word of [...words].sort((a, b) => b.length - a.length)) {
            const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // One letter counts only straight after the time, at the end: "11a"
            const pattern = word.length === 1
                ? new RegExp(`(?<=\\d\\s*)${escaped}(?=\\s*$)`, 'iu')
                : new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`, 'iu');
            const found = pattern.exec(text);
            if (found) {
                return {period: name, rest: `${text.slice(0, found.index)} ${text.slice(found.index + found[0].length)}`};
            }
        }
    }
    return {period: null, rest: text};
}

// Takes the time out of the text, and returns the time and the rest of the text
function readTime(text, kind, locale) {
    const {period, rest} = takeDayPeriod(text, locale);
    const separator = timeSeparatorPattern(locale);
    let found = new RegExp(`(?<!\\d)(\\d{1,2})${separator}(\\d{2})(?:${separator}(\\d{2}))?(?!\\d)(?!.*\\d${separator}\\d)`).exec(rest);
    if (!found && kind === 'time') {
        found = /^\s*(\d{1,2})(\d{2})?\s*$/.exec(rest);
    }
    if (!found) { return null; }
    const hour = convertHour(Number(found[1]), period);
    const minute = Number(found[2] ?? 0);
    const second = Number(found[3] ?? 0);
    if (hour === null || !validTime(hour, minute, second)) { return null; }
    return {hour, minute, second, rest: rest.replace(found[0], ' ')};
}

function convertHour(hour, period) {
    if (!period) { return hour; }
    if (hour < 1 || hour > 12) { return null; }
    return (hour % 12) + (period === 'pm' ? 12 : 0);
}

function keyword(text, kind, {locale, reference}) {
    const clean = text.trim().toLocaleLowerCase(locale);
    const relative = relativeFormat(locale, {numeric: 'auto'});
    const words = {
        today: [0, 'today', relative.format(0, 'day')],
        tomorrow: [1, 'tomorrow', relative.format(1, 'day')],
        yesterday: [-1, 'yesterday', relative.format(-1, 'day')],
    };
    if (hasDate(kind)) {
        for (const [days, ...names] of Object.values(words)) {
            if (names.includes(clean)) { return truncate(addDays(reference, days), kind); }
        }
    }
    if (hasTime(kind) && (clean === 'now' || clean === relative.format(0, 'second').toLocaleLowerCase(locale))) {
        return truncate(reference, kind);
    }
    return null;
}

// Read what a person typed: ISO 8601, what formatDisplay writes in this locale, the numbers in
// the order of this locale, a month name, a time such as "3pm" or "1530", or a word such as
// "tomorrow". `reference` is the wall clock now. It gives a word its meaning, and a date its year.
export function parseText(text, kind, {locale, reference, timeZone} = {}) {
    if (typeof text !== 'string' || !text.trim()) { return null; }
    const strict = parseValue(text, kind, {timeZone});
    if (strict) { return strict; }
    const clean = digitNormalizer(locale)(text).replace(/[‎‏؜‪-‮  ]/g, ' ');
    const strictNormalized = parseValue(clean, kind, {timeZone});
    if (strictNormalized) { return strictNormalized; }
    const word = keyword(clean, kind, {locale, reference});
    if (word) { return word; }
    if (kind === 'time') {
        const time = readTime(clean, kind, locale);
        return time ? pick(time, ['hour', 'minute', 'second']) : null;
    }
    if (kind === 'datetime') {
        const time = readTime(clean, kind, locale);
        const date = readDate(time ? time.rest : clean, 'date', {locale, reference});
        return date ? truncate({...date, ...(time ? pick(time, ['hour', 'minute', 'second']) : {})}, 'datetime') : null;
    }
    const date = readDate(clean, kind, {locale, reference});
    return date ? truncate(date, kind) : null;
}

// Rules for what a person can select

function parseDateList(list) {
    const entries = Array.isArray(list) ? list : String(list ?? '').split(',');
    const found = [];
    for (const entry of entries) {
        const [start, end] = String(entry).trim().split('/');
        const first = parseValue(start, 'date');
        if (first) { found.push([first, end ? parseValue(end, 'date') ?? first : first]); }
    }
    return found;
}

// Reads the options once for each draw. See the README for each option.
export function buildRules(options, kind) {
    const weekdays = options.disabledWeekdays;
    const zone = {timeZone: options.timeZone};
    return {
        kind,
        min: options.min ? parseValue(options.min, kind, zone) : null,
        max: options.max ? parseValue(options.max, kind, {...zone, endOfDay: true}) : null,
        minTime: options.minTime ? parseValue(options.minTime, 'time') : null,
        maxTime: options.maxTime ? parseValue(options.maxTime, 'time') : null,
        disabledDates: parseDateList(options.disabledDates),
        disabledWeekdays: new Set((Array.isArray(weekdays) ? weekdays : String(weekdays ?? '').split(','))
            .map(value => String(value).trim()).filter(Boolean).map(Number)),
        isDateDisabled: options.isDateDisabled,
        isTimeDisabled: options.isTimeDisabled,
        getDayInfo: options.getDayInfo,
        hourStep: Number(options.hourStep) || 1,
        minuteStep: Number(options.minuteStep) || 1,
        secondStep: Number(options.secondStep) || 1,
        minRangeDays: Number(options.minRangeDays) || 0,
        maxRangeDays: Number(options.maxRangeDays) || 0,
        allowDisabledInRange: Boolean(options.allowDisabledInRange),
    };
}

export function dayIsDisabled(parts, rules) {
    if (rules.min && hasDate(rules.kind) && compare(parts, rules.min, 'date') < 0) { return true; }
    if (rules.max && hasDate(rules.kind) && compare(parts, rules.max, 'date') > 0) { return true; }
    if (rules.disabledWeekdays.has(weekday(parts))) { return true; }
    for (const [start, end] of rules.disabledDates) {
        if (compare(parts, start, 'date') >= 0 && compare(parts, end, 'date') <= 0) { return true; }
    }
    const iso = formatDate(parts);
    if (rules.isDateDisabled?.(iso, parts)) { return true; }
    return Boolean(rules.getDayInfo?.(iso, parts)?.disabled);
}

// The month and year views have only the minimum and the maximum to go by
export function periodIsDisabled(parts, kind, rules) {
    const reduced = kind === 'year' ? 'year' : 'month';
    if (rules.min?.year !== undefined && compare(parts, rules.min, reduced) < 0) { return true; }
    if (rules.max?.year !== undefined && compare(parts, rules.max, reduced) > 0) { return true; }
    return false;
}

function outsideWindow(time, minimum, maximum) {
    const afterMinimum = !minimum || compare(time, minimum, 'time') >= 0;
    const beforeMaximum = !maximum || compare(time, maximum, 'time') <= 0;
    // A minimum after the maximum is a window that goes through midnight
    if (minimum && maximum && compare(minimum, maximum, 'time') > 0) {
        return !afterMinimum && !beforeMaximum;
    }
    return !afterMinimum || !beforeMaximum;
}

// `day` matters for a datetime, because the minimum and the maximum are on one day only
export function timeIsDisabled(time, day, rules) {
    if (rules.kind === 'time') {
        if (outsideWindow(time, rules.min, rules.max)) { return true; }
    } else if (day) {
        const full = {...day, ...time};
        if (rules.min?.year !== undefined && compare(full, rules.min, 'datetime') < 0) { return true; }
        if (rules.max?.year !== undefined && compare(full, rules.max, 'datetime') > 0) { return true; }
    }
    if (outsideWindow(time, rules.minTime, rules.maxTime)) { return true; }
    return Boolean(rules.isTimeDisabled?.(formatTime(time, true), time, day ?? null));
}

export function stepIsWrong(time, rules) {
    return (time.hour ?? 0) % rules.hourStep !== 0
        || (time.minute ?? 0) % rules.minuteStep !== 0
        || (time.second ?? 0) % rules.secondStep !== 0;
}

// Why a value is not allowed, or null. The form validity uses the same reasons.
export function valueProblem(parts, rules) {
    const kind = rules.kind;
    if (rules.min && compare(parts, rules.min, kind) < 0 && kind !== 'time') { return 'before-min'; }
    if (rules.max && compare(parts, rules.max, kind) > 0 && kind !== 'time') { return 'after-max'; }
    if (kind === 'time' && outsideWindow(parts, rules.min, rules.max)) {
        return rules.min && compare(parts, rules.min, 'time') < 0 ? 'before-min' : 'after-max';
    }
    if (['date', 'datetime', 'week'].includes(kind) && dayIsDisabled(parts, rules)) { return 'disabled-date'; }
    if (hasTime(kind)) {
        const time = truncate(parts, 'time');
        if (timeIsDisabled(time, hasDate(kind) ? parts : null, rules)) { return 'disabled-time'; }
        if (stepIsWrong(time, rules)) { return 'step'; }
    }
    return null;
}

// Why two values cannot be a range, or null
export function rangeProblem(start, end, rules) {
    if (!['date', 'datetime', 'week'].includes(rules.kind)) { return null; }
    const days = dayNumber(end) - dayNumber(start) + 1;
    if (rules.minRangeDays && days < rules.minRangeDays) { return 'range-too-short'; }
    if (rules.maxRangeDays && days > rules.maxRangeDays) { return 'range-too-long'; }
    if (!rules.allowDisabledInRange) {
        for (let day = start; compare(day, end, 'date') <= 0; day = addDays(day, 1)) {
            if (dayIsDisabled(day, rules)) { return 'disabled-in-range'; }
        }
    }
    return null;
}

// The name of AM and of PM, for a select
export function meridiemNames(locale) {
    const {am, pm} = dayPeriods(locale);
    return {am: am.at(-1), pm: pm.at(-1)};
}
