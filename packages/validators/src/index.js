// Validators for the core CSIL types, with no DOM. A validator reads the text that a person typed
// and gives the typed value, or a message that tells the problem. A form, a spreadsheet, or a
// server can use the same validators. The design and each validator are in the README.

const MESSAGES = {
    required: 'Type a value.',
    int: 'Type a whole number.',
    uint: 'Type a whole number that is 0 or more.',
    unsafe: 'The number is too large.',
    float: 'Type a number.',
    finite: 'Type a number that is not infinite.',
    decimal: 'Type a number.',
    scale: (scale) => `Type a number with ${scale} decimals or fewer.`,
    // A limit message has the limit and the kind of the validator: a date or a timestamp has its own words
    min: (min, kind) => (isTime(kind) ? `Type a ${timeWord(kind)} that is ${min} or later.` : `Type a number that is ${min} or more.`),
    max: (max, kind) => (isTime(kind) ? `Type a ${timeWord(kind)} that is ${max} or earlier.` : `Type a number that is ${max} or less.`),
    above: (limit, kind) => (isTime(kind) ? `Type a ${timeWord(kind)} that is after ${limit}.` : `Type a number that is more than ${limit}.`),
    below: (limit, kind) => (isTime(kind) ? `Type a ${timeWord(kind)} that is before ${limit}.` : `Type a number that is less than ${limit}.`),
    minLength: (count) => `Type ${count} characters or more.`,
    maxLength: (count) => `Type ${count} characters or fewer.`,
    pattern: 'The text does not have the correct format.',
    bool: 'Type TRUE or FALSE.',
    bytes: 'Type pairs of hexadecimal digits (0 to 9, A to F).',
    base64: 'Type Base64 text.',
    minBytes: (count) => `Type ${count} bytes or more.`,
    maxBytes: (count) => `Type ${count} bytes or fewer.`,
    timestamp: 'Type a date and time, for example 2026-03-13T09:30:00Z.',
    offset: 'Add the time zone: Z for UTC, or an offset such as +02:00.',
    date: 'Type a date, for example 2026-03-13.',
    uuid: 'Type a UUID, for example 123e4567-e89b-12d3-a456-426614174000.',
    oneOf: 'Select a value from the list.',
    equal: (value) => `Type ${value}.`,
    notEqual: (value) => `Do not type ${value}.`,
};

const INTEGER = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)$/;
const NUMBER = /^[-+]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/;
const DECIMAL = /^([-+]?)(?:(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d*))?|\.(\d+))$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^(?:[0-9a-f]{2})*$/i;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// A date and a time, seconds with an optional fraction, and an optional Z or offset. A time with no
// offset needs the `timeZone` of the validator.
const ISO_TIMESTAMP_ANY = /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?\s*([Zz]|[-+]\d{2}:?\d{2})?$/;
const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'on', 'x']);
const FALSE_WORDS = new Set(['false', 'no', 'n', '0', 'off']);

// The messages of the application, from setValidatorMessages. A message of a validator wins over
// them, and a table in the parse context (for example of a spreadsheet) wins over them too.
let sharedMessages = {};

// Changes the messages of all validators, for example to translate them: {reason: text or (limit) => text}.
// null removes the changes.
export function setValidatorMessages(table) {
    sharedMessages = table ? {...sharedMessages, ...table} : {};
}

// The context of the parse that runs now: {locale, messages}. A parse is synchronous, so one
// variable is enough. It goes back to the outer context after each parse.
let active = {locale: null, messages: null, timeZone: null};
function withContext(context, fn) {
    if (!context) { return fn(); }
    const outer = active;
    active = {
        locale: context.locale ?? outer.locale,
        messages: context.messages ?? outer.messages,
        timeZone: context.timeZone ?? outer.timeZone,
    };
    try { return fn(); } finally { active = outer; }
}

const valid = (value) => ({valid: true, value});
const invalid = (message, reason) => ({valid: false, message, reason});

function isTime(kind) { return kind === 'date' || kind === 'timestamp'; }
function timeWord(kind) { return kind === 'date' ? 'date' : 'date and time'; }

function messageFor(validator, reason, ...args) {
    const text = validator.messages?.[reason] ?? active.messages?.[reason] ?? sharedMessages[reason] ?? MESSAGES[reason];
    return typeof text === 'function' ? text(...args) : text;
}

// The part that each validator shares: empty input, `required`, and the extra `test` function
function make(kind, options, read, extra = {}) {
    const {required = false, test = null, messages = null} = options;
    const validator = {
        kind,
        required,
        messages,
        inputMode: 'text',
        ...extra,
        // Reads the text that a person typed. `context` is {locale, messages, timeZone}: the locale
        // of the text, messages that win over the shared messages, and the time zone of a time
        // with no offset.
        parse(input, context) {
            return withContext(context, () => {
                const text = input === null || input === undefined ? '' : String(input).trim();
                if (text === '') { return required ? invalid(messageFor(validator, 'required'), 'required') : valid(null); }
                const result = read(text, validator);
                if (!result.valid || !test) { return result; }
                const problem = test(result.value);
                return problem ? invalid(typeof problem === 'string' ? problem : messageFor(validator, 'pattern'), 'test') : result;
            });
        },
        // Checks a value that is already typed, for example from a server. Text goes through parse.
        check(value) {
            if (value === null || value === undefined || value === '') { return validator.parse(''); }
            if (typeof value === 'string') { return validator.parse(value); }
            return validator.parse(validator.format(value));
        },
        // The text for a value, which parse reads back to the same value. With {locale}, a number
        // has the decimal sign of the locale, and no group signs.
        format(value, context) {
            if (value === null || value === undefined) { return ''; }
            return withContext(context, () => (extra.formatValue ? extra.formatValue(value) : String(value)));
        },
    };
    return validator;
}

function limits(validator, number, {min, max, above, below}) {
    if (min !== undefined && min !== null && number < min) { return invalid(messageFor(validator, 'min', min, validator.kind), 'min'); }
    if (max !== undefined && max !== null && number > max) { return invalid(messageFor(validator, 'max', max, validator.kind), 'max'); }
    if (above !== undefined && above !== null && !(number > above)) { return invalid(messageFor(validator, 'above', above, validator.kind), 'above'); }
    if (below !== undefined && below !== null && !(number < below)) { return invalid(messageFor(validator, 'below', below, validator.kind), 'below'); }
    return null;
}

function equality(validator, value, {equal, notEqual}, same) {
    if (equal !== undefined && !same(value, equal)) { return invalid(messageFor(validator, 'equal', equal), 'equal'); }
    if (notEqual !== undefined && same(value, notEqual)) { return invalid(messageFor(validator, 'notEqual', notEqual), 'notEqual'); }
    return null;
}

// ---------- Locales ----------

// The signs of numbers in a locale: {group, decimal}. Made one time for each locale.
const separatorCache = new Map();
export function numberSeparators(locale) {
    const key = locale || '';
    let found = separatorCache.get(key);
    if (!found) {
        found = {group: ',', decimal: '.'};
        try {
            for (const part of new Intl.NumberFormat(locale || undefined).formatToParts(12345.6)) {
                if (part.type === 'group') { found.group = part.value; }
                if (part.type === 'decimal') { found.decimal = part.value; }
            }
        } catch { /* An unknown locale reads as 1,234.5 */ }
        separatorCache.set(key, found);
    }
    return found;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SPACES = '\u0020\u00a0\u202f\u2009';
const localeNumberCache = new Map();

// The text of a number in the locale of the parse, in the 1234.5 form. The group signs must stand
// before groups of 3 digits (or 2, as in 1,00,000), so that "1.5" in German is not 15.
// Returns null when the text is not a number of the locale.
function canonicalNumber(text) {
    const locale = active.locale;
    if (!locale) { return text; }
    const {group, decimal} = numberSeparators(locale);
    if (group === ',' && decimal === '.') { return text; }
    let pattern = localeNumberCache.get(locale);
    if (!pattern) {
        // A group sign that is a space can be typed as any space
        const groupSign = /\s/.test(group) ? `[${SPACES}]` : escapeRegExp(group);
        const decimalSign = escapeRegExp(decimal);
        pattern = {
            grouped: new RegExp(`^([-+]?)(\\d{1,3}(?:${groupSign}\\d{2,3})*${groupSign}\\d{3})(?:${decimalSign}(\\d*))?([eE][-+]?\\d+)?$`),
            plain: new RegExp(`^([-+]?)(\\d*)(?:${decimalSign}(\\d*))?([eE][-+]?\\d+)?$`),
            groupSign: new RegExp(groupSign, 'g'),
        };
        localeNumberCache.set(locale, pattern);
    }
    const match = pattern.grouped.exec(text) ?? pattern.plain.exec(text);
    if (!match || (!match[2] && !match[3])) { return null; }
    const whole = match[2].replace(pattern.groupSign, '');
    return `${match[1]}${whole}${match[3] !== undefined ? `.${match[3]}` : ''}${match[4] ?? ''}`;
}

// The text of a number of a locale in the 1234.5 form, or null when the text is not a number of
// the locale. For a spreadsheet or an import that keeps numbers as canonical text.
export function canonicalNumberText(text, locale) {
    return withContext({locale: locale || null}, () => {
        const result = canonicalNumber(String(text ?? '').trim());
        return result !== null && /\d/.test(result) && NUMBER.test(result) ? result.replace(/,/g, '') : null;
    });
}

// The text of a number for the locale of the format: the decimal sign of the locale, no group signs
function localNumber(text) {
    const locale = active.locale;
    if (!locale) { return text; }
    const {decimal} = numberSeparators(locale);
    return decimal === '.' ? text : text.replace('.', decimal);
}

// The order of the parts of a date in a locale, for example ['day', 'month', 'year']
const dateOrderCache = new Map();
export function dateOrder(locale) {
    const key = locale || '';
    let order = dateOrderCache.get(key);
    if (!order) {
        order = ['year', 'month', 'day'];
        try {
            const parts = new Intl.DateTimeFormat(locale || undefined, {year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(2026, 10, 21));
            const found = parts.filter(part => ['year', 'month', 'day'].includes(part.type)).map(part => part.type);
            if (found.length === 3) { order = found; }
        } catch { /* An unknown locale reads ISO dates only */ }
        dateOrderCache.set(key, order);
    }
    return order;
}

// A date in the order of the locale, for example 21.11.2026 in German: {year, month, day}, or null.
// A year of two digits is in 2000 to 2099.
function localDate(text) {
    if (!active.locale) { return null; }
    const match = /^(\d{1,4})[./\-\s]\s*(\d{1,2})[./\-\s]\s*(\d{1,4})\.?$/.exec(text);
    if (!match) { return null; }
    const order = dateOrder(active.locale);
    const parts = {};
    order.forEach((name, i) => { parts[name] = Number(match[i + 1]); });
    const yearText = match[order.indexOf('year') + 1];
    if (yearText.length === 2) { parts.year += 2000; } else if (yearText.length !== 4) { return null; }
    return realDate(parts.year, parts.month, parts.day) ? parts : null;
}

const pad = (number, size = 2) => String(number).padStart(size, '0');

// int({min, max, bigint}): a whole number. A number outside the safe range is invalid, unless
// `bigint` is true. Then the value is always a bigint.
function int(options = {}) {
    const unsigned = options.unsigned ?? false;
    const kind = unsigned ? 'uint' : 'int';
    return make(kind, options, (input, self) => {
        const text = canonicalNumber(input);
        if (text === null || !INTEGER.test(text)) { return invalid(messageFor(self, kind), 'type'); }
        const digits = text.replace(/,/g, '').replace(/^\+/, '');
        if (unsigned && digits.startsWith('-') && !/^-0+$/.test(digits)) { return invalid(messageFor(self, 'uint'), 'type'); }
        let value;
        if (options.bigint) {
            value = BigInt(digits);
        } else {
            value = Number(digits);
            if (!Number.isSafeInteger(value)) { return invalid(messageFor(self, 'unsafe'), 'unsafe'); }
            if (Object.is(value, -0)) { value = 0; }
        }
        const limit = limits(self, value, options);
        if (limit) { return limit; }
        return equality(self, value, options, (a, b) => a == b) ?? valid(value); // eslint-disable-line eqeqeq
    }, {inputMode: 'numeric', formatValue: (value) => String(value)});
}

function uint(options = {}) {
    return int({...options, unsigned: true, min: options.min ?? 0});
}

// float({min, max, finite}): a number. With `finite: false`, "Infinity" and "-Infinity" are also numbers.
function float(options = {}) {
    const finite = options.finite ?? true;
    return make('float', options, (input, self) => {
        let value;
        const text = canonicalNumber(input) ?? '';
        if (!finite && /^[-+]?(?:infinity|inf)$/i.test(input)) {
            value = input.startsWith('-') ? -Infinity : Infinity;
        } else if (NUMBER.test(text)) {
            value = Number(text.replace(/,/g, ''));
        } else {
            return invalid(messageFor(self, 'float'), 'type');
        }
        if (finite && !Number.isFinite(value)) { return invalid(messageFor(self, 'finite'), 'finite'); }
        const limit = limits(self, value, options);
        if (limit) { return limit; }
        return equality(self, value, options, (a, b) => a === b) ?? valid(value);
    }, {inputMode: 'decimal', formatValue: (value) => localNumber(String(value))});
}

// decimal({scale, min, max}): an exact number as normalized text, for example "12.50" with scale 2.
// The text keeps each digit. `scale` is the most decimals; the value has exactly that many.
function decimal(options = {}) {
    const {scale = null} = options;
    return make('decimal', options, (input, self) => {
        const text = canonicalNumber(input);
        const match = text === null ? null : DECIMAL.exec(text);
        if (!match) { return invalid(messageFor(self, 'decimal'), 'type'); }
        const sign = match[1] === '-' ? '-' : '';
        const whole = (match[2] ?? '0').replace(/,/g, '').replace(/^0+(?=\d)/, '');
        let fraction = match[3] ?? match[4] ?? '';
        if (scale !== null) {
            const extra = fraction.slice(scale);
            if (/[1-9]/.test(extra)) { return invalid(messageFor(self, 'scale', scale), 'scale'); }
            fraction = fraction.slice(0, scale).padEnd(scale, '0');
        } else {
            fraction = fraction.replace(/0+$/, '');
        }
        const zero = /^0*$/.test(whole + fraction);
        const value = `${zero ? '' : sign}${whole}${fraction ? `.${fraction}` : ''}`;
        const limit = limits(self, Number(value), options);
        if (limit) { return limit; }
        return valid(value);
    }, {inputMode: 'decimal', scale, formatValue: (value) => localNumber(String(value))});
}

// text({minLength, maxLength, pattern}): text. The lengths count Unicode code points, not UTF-16 units.
// `pattern` is a RegExp or a text, and it must match all of the text.
function text(options = {}) {
    const {minLength = null, maxLength = null, trim = true} = options;
    const pattern = options.pattern ? (options.pattern instanceof RegExp ? options.pattern : new RegExp(`^(?:${options.pattern})$`, 'u')) : null;
    const validator = make('text', options, (value, self) => {
        const length = [...value].length;
        if (minLength !== null && length < minLength) { return invalid(messageFor(self, 'minLength', minLength), 'minLength'); }
        if (maxLength !== null && length > maxLength) { return invalid(messageFor(self, 'maxLength', maxLength), 'maxLength'); }
        if (pattern) {
            pattern.lastIndex = 0;
            if (!pattern.test(value)) { return invalid(messageFor(self, 'pattern'), 'pattern'); }
        }
        return equality(self, value, options, (a, b) => a === b) ?? valid(value);
    }, {minLength, maxLength, pattern});
    if (!trim) {
        // Spaces at the ends are part of the text
        const parse = validator.parse;
        validator.parse = (input, context) => {
            const raw = input === null || input === undefined ? '' : String(input);
            if (raw.trim() === '') { return parse(raw, context); }
            const result = parse(raw, context);
            return result.valid ? valid(raw) : result;
        };
    }
    return validator;
}

// bool(): TRUE or FALSE, also yes, no, 1, 0, on, off, and x
function bool(options = {}) {
    return make('bool', options, (value, self) => {
        const word = value.toLowerCase();
        if (TRUE_WORDS.has(word)) { return valid(true); }
        if (FALSE_WORDS.has(word)) { return valid(false); }
        return invalid(messageFor(self, 'bool'), 'type');
    }, {formatValue: (value) => (value ? 'TRUE' : 'FALSE')});
}

function hexOf(bytes) {
    let out = '';
    for (const byte of bytes) { out += byte.toString(16).padStart(2, '0'); }
    return out;
}

// bytes({encoding, minLength, maxLength}): a Uint8Array from hexadecimal (the default) or Base64 text.
// The lengths count bytes. Spaces between hexadecimal pairs are permitted.
function bytes(options = {}) {
    const {encoding = 'hex', minLength = null, maxLength = null} = options;
    return make('bytes', options, (value, self) => {
        let data;
        if (encoding === 'base64') {
            const compact = value.replace(/\s+/g, '');
            if (!BASE64.test(compact)) { return invalid(messageFor(self, 'base64'), 'type'); }
            const binary = atob(compact);
            data = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        } else {
            const compact = value.replace(/\s+/g, '').replace(/^0x/i, '');
            if (!HEX.test(compact)) { return invalid(messageFor(self, 'bytes'), 'type'); }
            data = new Uint8Array(compact.length / 2);
            for (let i = 0; i < data.length; i++) { data[i] = parseInt(compact.slice(i * 2, i * 2 + 2), 16); }
        }
        if (minLength !== null && data.length < minLength) { return invalid(messageFor(self, 'minBytes', minLength), 'minLength'); }
        if (maxLength !== null && data.length > maxLength) { return invalid(messageFor(self, 'maxBytes', maxLength), 'maxLength'); }
        return valid(data);
    }, {
        formatValue: (value) => {
            if (encoding === 'base64') { return btoa(String.fromCharCode(...value)); }
            return hexOf(value);
        },
    });
}

function realDate(year, month, day) {
    if (month < 1 || month > 12 || day < 1) { return false; }
    const days = new Date(Date.UTC(2000, month, 0));
    days.setUTCFullYear(year, month, 0);
    return day <= days.getUTCDate();
}

// The offset of a time zone at an instant, in minutes east of UTC. 'local' is the zone of the computer.
const zoneFormats = new Map();
function zoneOffset(timeZone, ms) {
    if (timeZone === 'local') { return -new Date(ms).getTimezoneOffset(); }
    let format = zoneFormats.get(timeZone);
    if (!format) {
        format = new Intl.DateTimeFormat('en-US', {timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'});
        zoneFormats.set(timeZone, format);
    }
    const parts = {};
    for (const part of format.formatToParts(new Date(ms))) { parts[part.type] = part.value; }
    const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
    return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60000);
}

// The instant of a wall time in a time zone. Two steps find the offset also near a change of summer time.
function instantIn(timeZone, fields) {
    const wall = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second, fields.ms);
    let guess = wall - zoneOffset(timeZone, wall) * 60000;
    guess = wall - zoneOffset(timeZone, guess) * 60000;
    return new Date(guess);
}

// A time of day with an optional offset, after a date: "09:30", "9:30:15.5 +02:00"
const TIME_PART = /^(\d{1,2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?\s*([Zz]|[-+]\d{2}:?\d{2})?$/;

// timestamp({timeZone}): a Date from ISO 8601 text with Z or an offset, for example
// 2026-03-13T09:30:00Z. With `timeZone` ('local' or a name such as 'Europe/Berlin'), a time with
// no offset is a time in that zone. With a locale in the parse, the date can be in the order of the
// locale, for example "13.03.2026 09:30".
function timestamp(options = {}) {
    return make('timestamp', options, (value, self) => {
        const timeZone = options.timeZone ?? active.timeZone ?? null;
        let fields = null;
        let offset = null;
        const match = ISO_TIMESTAMP_ANY.exec(value);
        if (match) {
            const [year, month, day, hour, minute] = match.slice(1, 6).map(Number);
            const second = match[6] ? Number(match[6]) : 0;
            fields = {year, month, day, hour, minute, second, ms: match[7] ? Math.round(Number(match[7]) * 1000) : 0};
            offset = match[8] ?? null;
        } else if (active.locale) {
            const split = /^(\S+)(?:\s+|[Tt])(.+)$/.exec(value);
            const day = split ? localDate(split[1]) : null;
            const time = split ? TIME_PART.exec(split[2]) : null;
            if (day && time) {
                fields = {...day, hour: Number(time[1]), minute: Number(time[2]), second: Number(time[3] ?? 0), ms: time[4] ? Math.round(Number(time[4]) * 1000) : 0};
                offset = time[5] ?? null;
            }
        }
        if (!fields || !realDate(fields.year, fields.month, fields.day) || fields.hour > 23 || fields.minute > 59 || fields.second > 59) {
            return invalid(messageFor(self, 'timestamp'), 'type');
        }
        let date;
        if (offset) {
            const minutes = /^[Zz]$/.test(offset) ? 0 : (offset[0] === '-' ? -1 : 1) * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(-2)));
            date = new Date(Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second, fields.ms) - minutes * 60000);
        } else if (timeZone) {
            try { date = instantIn(timeZone, fields); } catch { return invalid(messageFor(self, 'timestamp'), 'type'); }
        } else {
            return invalid(messageFor(self, 'offset'), 'offset');
        }
        if (Number.isNaN(date.getTime())) { return invalid(messageFor(self, 'timestamp'), 'type'); }
        const min = options.min ? new Date(options.min) : null;
        const max = options.max ? new Date(options.max) : null;
        if (min && date < min) { return invalid(messageFor(self, 'min', min.toISOString(), 'timestamp'), 'min'); }
        if (max && date > max) { return invalid(messageFor(self, 'max', max.toISOString(), 'timestamp'), 'max'); }
        return valid(date);
    }, {formatValue: (value) => (value instanceof Date ? value.toISOString() : String(value)), timeZone: options.timeZone ?? null});
}

// date({min, max, above, below}): a calendar date as ISO text, for example "2026-03-13". The limits are ISO text. A date has no time zone. With a
// locale in the parse, the date can also be in the order of the locale, for example 13.03.2026.
function date(options = {}) {
    return make('date', options, (value, self) => {
        let iso = null;
        const match = ISO_DATE.exec(value);
        if (match && realDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
            iso = value;
        } else {
            const parts = localDate(value);
            if (parts) { iso = `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`; }
        }
        if (!iso) { return invalid(messageFor(self, 'date'), 'type'); }
        if (options.min && iso < options.min) { return invalid(messageFor(self, 'min', options.min, 'date'), 'min'); }
        if (options.max && iso > options.max) { return invalid(messageFor(self, 'max', options.max, 'date'), 'max'); }
        if (options.above && !(iso > options.above)) { return invalid(messageFor(self, 'above', options.above, 'date'), 'above'); }
        if (options.below && !(iso < options.below)) { return invalid(messageFor(self, 'below', options.below, 'date'), 'below'); }
        return valid(iso);
    });
}

// uuid(): a UUID as lower-case text
function uuid(options = {}) {
    return make('uuid', options, (value, self) => (UUID.test(value) ? valid(value.toLowerCase()) : invalid(messageFor(self, 'uuid'), 'type')));
}

// oneOf(options, {caseSensitive}): one value of a list. An option is a text, or {value, label}.
// The person can type the label or the value. The value of the result is the value of the option.
function oneOf(list, options = {}) {
    const items = (list ?? []).map((item) => (typeof item === 'object' && item !== null
        ? {value: item.value, label: String(item.label ?? item.value)}
        : {value: item, label: String(item)}));
    const fold = options.caseSensitive ? (word) => word : (word) => word.toLowerCase();
    // One map, made one time, so that a list of 10,000 options costs one lookup for each input
    const byText = new Map();
    for (const item of items) {
        const label = fold(item.label);
        if (!byText.has(label)) { byText.set(label, item); }
    }
    for (const item of items) {
        const value = fold(String(item.value));
        if (!byText.has(value)) { byText.set(value, item); }
    }
    const byValue = new Map(items.map((item) => [item.value, item]));
    return make('enum', options, (value, self) => {
        const item = byText.get(fold(value));
        return item ? valid(item.value) : invalid(messageFor(self, 'oneOf'), 'oneOf');
    }, {
        options: items,
        labelOf: (value) => byValue.get(value)?.label ?? (value === null || value === undefined ? '' : String(value)),
        formatValue: (value) => byValue.get(value)?.label ?? String(value),
    });
}

// any(): any text, with no check. A field with no validator acts the same.
function any(options = {}) {
    return make('any', options, (value) => valid(value));
}

// A copy of a validator that does not accept an empty input
function required(validator) {
    return withOptions(validator, {required: true});
}

// A copy of a validator that accepts an empty input
function optional(validator) {
    return withOptions(validator, {required: false});
}

function withOptions(validator, changes) {
    const copy = {...validator, ...changes};
    const parse = validator.parse;
    copy.parse = (input, context) => withContext(context, () => {
        const textValue = input === null || input === undefined ? '' : String(input).trim();
        if (textValue === '') {
            return copy.required ? invalid(messageFor(copy, 'required'), 'required') : valid(null);
        }
        return parse(input);
    });
    copy.check = (value) => {
        if (value === null || value === undefined || value === '') { return copy.parse(''); }
        return validator.check(value);
    };
    return copy;
}

export const validators = {int, uint, float, decimal, text, bool, bytes, timestamp, date, uuid, oneOf, any, required, optional};

// The messages of the validators, by reason. Give a table with the same keys to setValidatorMessages.
export const validatorMessages = Object.freeze({...MESSAGES});

// Validates an object. `fields` is {key: validator} or [{key, validator}]. Each value can be a text
// that a person typed or a typed value. The result has the typed values, and a message for each
// field with a problem: {valid, value: {key: value}, errors: {key: message}}.
export function validateRecord(record, fields) {
    const list = Array.isArray(fields) ? fields : Object.entries(fields).map(([key, validator]) => ({key, validator}));
    const value = {};
    const errors = {};
    let ok = true;
    for (const {key, validator} of list) {
        if (!validator) { value[key] = record?.[key] ?? null; continue; }
        const result = validator.check(record?.[key]);
        if (result.valid) {
            value[key] = result.value;
        } else {
            ok = false;
            errors[key] = result.message;
        }
    }
    return {valid: ok, value, errors};
}

// ---------- CSIL schema descriptor ----------

const variant = (node) => (node && typeof node === 'object' && !Array.isArray(node) ? Object.keys(node)[0] : node);
const dataOf = (node) => (node && typeof node === 'object' && !Array.isArray(node) ? node[variant(node)] : null);
const toNumber = (value) => (typeof value === 'bigint' ? Number(value) : value);

function literalValue(literal) {
    const name = variant(literal);
    const data = dataOf(literal);
    if (name === 'Null') { return null; }
    if (name === 'Integer') { return toNumber(data); }
    return data;
}

// The validator for a CSIL type expression, or null for a type that has no text form (a map or an array)
// A constraint value: a literal such as {Integer: 5}, or a plain value
function scalar(data) {
    if (data && typeof data === 'object' && !Array.isArray(data) && ['Integer', 'Float', 'Text', 'Bool', 'Null'].includes(variant(data))) {
        return literalValue(data);
    }
    return toNumber(data);
}

function validatorForType(type, rules, depth = 0) {
    if (depth > 32) { return null; }
    const name = variant(type);
    const data = dataOf(type);
    switch (name) {
        case 'Builtin':
            switch (data) {
                case 'int': case 'nint': case 'integer': return int();
                case 'uint': return uint();
                case 'float': case 'float16': case 'float32': case 'float64': case 'double': case 'number': return float();
                case 'text': case 'tstr': case 'string': return text();
                case 'bytes': case 'bstr': return bytes();
                case 'bool': case 'boolean': return bool();
                case 'timestamp': return timestamp();
                case 'date': return date();
                case 'decimal': return decimal();
                case 'uuid': return uuid();
                case 'any': return any();
                default: return null;
            }
        case 'Reference': {
            const rule = rules.get(data);
            if (!rule) { return null; }
            if (variant(rule.definition) !== 'Type') { return null; }
            return validatorForType(dataOf(rule.definition), rules, depth + 1);
        }
        case 'Choice': {
            const arms = Array.isArray(data) ? data : [];
            const literals = arms.filter((arm) => variant(arm) === 'Literal');
            const nulls = literals.filter((arm) => variant(dataOf(arm)) === 'Null');
            const values = literals.filter((arm) => variant(dataOf(arm)) !== 'Null');
            if (values.length && values.length + nulls.length === arms.length) {
                const choice = oneOf(values.map((arm) => literalValue(dataOf(arm))));
                return nulls.length ? {...choice, nullable: true} : choice;
            }
            // type / null is an optional type
            const others = arms.filter((arm) => !(variant(arm) === 'Literal' && variant(dataOf(arm)) === 'Null'));
            if (others.length === 1) {
                const one = validatorForType(others[0], rules, depth + 1);
                return one && nulls.length ? {...optional(one), nullable: true} : one;
            }
            return null;
        }
        case 'Range': {
            const start = scalar(data.start);
            const end = scalar(data.end);
            const isInt = Number.isInteger(start) && Number.isInteger(end);
            return (isInt ? int : float)({min: start, ...(data.inclusive === false ? {below: end} : {max: end})});
        }
        case 'Literal':
            return oneOf([literalValue(data)]);
        case 'Constrained':
            return constrained(data.base, data.constraints ?? [], rules, depth);
        default:
            return null;
    }
}

// The limits of a CSIL date: ISO text only. A bound that is not a real date is not a limit.
function dateLimits(options) {
    const out = {};
    for (const name of ['min', 'max', 'above', 'below']) {
        const bound = options[name];
        const match = typeof bound === 'string' ? ISO_DATE.exec(bound) : null;
        if (match && realDate(Number(match[1]), Number(match[2]), Number(match[3]))) { out[name] = bound; }
    }
    return out;
}

function constrained(base, constraints, rules, depth) {
    const builtin = variant(base) === 'Builtin' ? dataOf(base) : null;
    const options = {};
    for (const constraint of constraints) {
        const name = variant(constraint);
        const data = dataOf(constraint);
        const value = scalar(data);
        switch (name) {
            case 'Size': {
                const kind = variant(data);
                const size = dataOf(data);
                if (kind === 'Exact') { options.minLength = toNumber(size); options.maxLength = toNumber(size); }
                if (kind === 'Range') { options.minLength = toNumber(size.min); options.maxLength = toNumber(size.max); }
                if (kind === 'Min') { options.minLength = toNumber(size); }
                if (kind === 'Max') { options.maxLength = toNumber(size); }
                break;
            }
            case 'Regex': options.pattern = String(value); break;
            case 'GreaterEqual': options.min = value; break;
            case 'LessEqual': options.max = value; break;
            case 'GreaterThan': options.above = value; break;
            case 'LessThan': options.below = value; break;
            case 'Equal': options.equal = value; break;
            case 'NotEqual': options.notEqual = value; break;
            default: break;
        }
    }
    switch (builtin) {
        case 'int': case 'nint': case 'integer': return int(options);
        case 'uint': return uint(options);
        case 'float': case 'float16': case 'float32': case 'float64': case 'double': case 'number': return float(options);
        case 'text': case 'tstr': case 'string': return text(options);
        case 'bytes': case 'bstr': return bytes(options);
        case 'decimal': return decimal(options);
        case 'date': return date(dateLimits(options));
        default: return validatorForType(base, rules, depth + 1);
    }
}

// The fields of a CSIL record type, each with a validator: [{key, validator, required}]. `schema` is
// the decoded descriptor (or its `body`), and `ruleName` is the name of a group rule. A field that
// has no text form, such as an array, has `validator: null`.
export function validatorsFromCsil(schema, ruleName) {
    const descriptor = schema?.body ?? schema;
    if (schema?.format && schema.format !== 'csil-schema') { throw new Error('Not a CSIL schema descriptor'); }
    const rules = new Map((descriptor?.rules ?? []).map((rule) => [rule.name, rule]));
    let rule = rules.get(ruleName);
    if (!rule) { throw new Error(`No rule named ${ruleName}`); }
    let definition = rule.definition;
    // A rule that names another rule, or a type that is a group
    for (let depth = 0; depth < 32; depth++) {
        if (variant(definition) === 'Type' && variant(dataOf(definition)) === 'Reference') {
            rule = rules.get(dataOf(dataOf(definition)));
            if (!rule) { break; }
            definition = rule.definition;
        } else {
            break;
        }
    }
    let group = null;
    if (variant(definition) === 'Group') { group = dataOf(definition); }
    if (variant(definition) === 'Type' && variant(dataOf(definition)) === 'Group') { group = dataOf(dataOf(definition)); }
    if (!group) { throw new Error(`${ruleName} is not a record type`); }
    const fields = [];
    for (const entry of group.entries ?? []) {
        const keyName = variant(entry.key) === 'Bare' ? dataOf(entry.key) : variant(entry.key) === 'Literal' ? literalValue(dataOf(entry.key)) : null;
        if (keyName === null || keyName === undefined) { continue; }
        let validator = validatorForType(entry.value, rules);
        // A field that can be missing, or that can be null, accepts an empty input
        const isOptional = variant(entry.occurrence) === 'Optional' || Boolean(validator?.nullable);
        if (validator) { validator = isOptional ? optional(validator) : (validator.required ? validator : required(validator)); }
        fields.push({key: String(keyName), validator, required: !isOptional});
    }
    return fields;
}
