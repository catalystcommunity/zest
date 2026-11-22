import { canonicalNumberText, dateOrder, numberSeparators } from "@catalystcommunity/validators";
import { tokenize } from "./formula.js";

// The edge between the text of a person and the model. The model keeps canonical inputs: numbers
// in the 1234.5 form, ISO dates, and formulas with "." and ",". The person types and reads the
// form of the locale of the sheet. The design is in the README, at "Locales".

const cache = new Map();

// The signs of a locale: {decimal, group, argument, order, dateSeparator, canonical}
export function sheetLocale(locale) {
    const key = locale || '';
    let found = cache.get(key);
    if (!found) {
        const {group, decimal} = numberSeparators(locale);
        let dateSeparator = '-';
        try {
            const parts = new Intl.DateTimeFormat(locale || undefined, {year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(2026, 10, 21));
            dateSeparator = parts.find(part => part.type === 'literal')?.value ?? '-';
        } catch { /* An unknown locale uses ISO dates */ }
        found = {
            locale: locale || null,
            decimal,
            group,
            // A locale with a decimal comma separates the arguments of a function with ";", as other spreadsheets do
            argument: decimal === ',' ? ';' : ',',
            order: dateOrder(locale),
            dateSeparator,
            canonical: decimal === '.' && group === ',',
        };
        cache.set(key, found);
    }
    return found;
}

const ISO_DATE = /^\d{4}-\d{1,2}-\d{1,2}$/;
const LOCAL_DATE = /^(\d{1,4})[./\-\s]\s*(\d{1,2})[./\-\s]\s*(\d{1,4})\.?$/;
const pad = (number, size = 2) => String(number).padStart(size, '0');

// A formula in the form of the locale to the canonical form. In a locale with a decimal comma,
// each "," outside a text is a decimal sign, and each ";" separates arguments.
function canonicalFormula(text, info) {
    if (info.decimal !== ',') { return text; }
    let out = '';
    let quoted = false;
    for (const char of text) {
        if (char === '"') { quoted = !quoted; out += char; continue; }
        if (quoted) { out += char; continue; }
        out += char === ',' ? '.' : char === ';' ? ',' : char;
    }
    return out;
}

function localFormula(text, info) {
    if (info.decimal !== ',') { return text; }
    let out = '=';
    for (const token of tokenize(text.slice(1))) {
        if (token.type === 'number') { out += token.text.replace('.', ','); } else if (token.type === 'op' && token.text === ',') { out += ';'; } else { out += token.text; }
    }
    return out;
}

// A date of the locale to ISO text, or null
function canonicalDate(text, info) {
    const match = LOCAL_DATE.exec(text);
    if (!match) { return null; }
    const parts = {};
    info.order.forEach((name, i) => { parts[name] = Number(match[i + 1]); });
    const yearText = match[info.order.indexOf('year') + 1];
    if (yearText.length === 2) { parts.year += 2000; } else if (yearText.length !== 4) { return null; }
    if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) { return null; }
    return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

const AFFIX = /^([-+]?)\s*([$€£¥]?)\s*(.*?)\s*([$€£¥]?)\s*(%?)$/;

// The text that a person typed, in the canonical form of the model. A text that is not a number,
// a date, or a formula stays as it is.
export function toCanonicalInput(text, locale) {
    if (!locale || typeof text !== 'string' || text === '' || text.startsWith("'")) { return text; }
    const info = typeof locale === 'object' ? locale : sheetLocale(locale);
    if (text.startsWith('=')) { return canonicalFormula(text, info); }
    const trimmed = text.trim();
    if (ISO_DATE.test(trimmed)) { return text; }
    if (!info.canonical || info.order[0] !== 'month') {
        const date = canonicalDate(trimmed, info);
        if (date) { return date; }
    }
    if (info.canonical) { return text; }
    const affix = AFFIX.exec(trimmed);
    if (!affix || (affix[2] && affix[4])) { return text; }
    const number = info.locale ? canonicalNumberText(affix[3], info.locale) : numberWith(affix[3], info);
    if (number === null) { return text; }
    const sign = affix[1] === '-' ? '-' : '';
    const symbol = affix[2] || affix[4];
    return `${sign}${symbol}${number}${affix[5]}`;
}

// A canonical input in the form of the locale, for the editor and the formula bar
export function toLocalInput(input, locale, type = null) {
    if (!locale || typeof input !== 'string' || input === '' || input.startsWith("'")) { return input; }
    const info = sheetLocale(locale);
    if (input.startsWith('=')) { return localFormula(input, info); }
    if (type === 'date' && ISO_DATE.test(input.trim()) && !(info.order[0] === 'year' && info.dateSeparator === '-')) {
        const [year, month, day] = input.trim().split('-').map(Number);
        const parts = {year: pad(year, 4), month: pad(month), day: pad(day)};
        return info.order.map(name => parts[name]).join(info.dateSeparator.trim() || '/');
    }
    if (info.canonical || !(type === 'number' || type === 'currency' || type === 'percent')) { return input; }
    // The number with the decimal sign of the locale, and no group signs
    return input.replace(/,/g, '').replace('.', info.decimal);
}

// The signs of a file, not of a locale: {decimal, group, order}. For an import with known signs.
export function textFormat({decimal = '.', group = decimal === ',' ? '.' : ',', order = ['year', 'month', 'day']} = {}) {
    return {
        locale: null,
        decimal,
        group,
        argument: decimal === ',' ? ';' : ',',
        order,
        dateSeparator: '-',
        canonical: decimal === '.' && group === ',',
    };
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A number with known signs in the 1234.5 form, or null
function numberWith(text, {decimal, group}) {
    const g = /\s/.test(group) ? '[\\s\\u00a0\\u202f]' : escape(group);
    const d = escape(decimal);
    const grouped = new RegExp(`^([-+]?)(\\d{1,3}(?:${g}\\d{2,3})*${g}\\d{3})(?:${d}(\\d*))?$`);
    const plain = new RegExp(`^([-+]?)(\\d*)(?:${d}(\\d*))?$`);
    const match = grouped.exec(text) ?? plain.exec(text);
    if (!match || !(match[2] || match[3])) { return null; }
    return `${match[1]}${match[2].replace(new RegExp(g, 'g'), '')}${match[3] !== undefined ? `.${match[3]}` : ''}`;
}

// ---------- Files ----------

const NUMBERISH = /^[-+]?[$€£¥]?\s*\d[\d.,\s\u00a0\u202f']*\s*[$€£¥%]?$/;
const DATEISH = /^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})$/;

// Finds the signs of a CSV file from its data: {delimiter, decimal, group, order, confident, ambiguous}.
// `decimal` is null and `confident` false when the numbers can be read both ways, for example
// only "1,234": then ask the person. `ambiguous` has some of the cells that can be read both ways.
// `order` is the order of the parts of dates, or null when it is not clear (only "03/04/2026").
export function detectCsvFormat(text, {sample = 200} = {}) {
    const lines = String(text ?? '').split(/\r?\n/).filter(line => line.trim()).slice(0, sample);
    // The delimiter: the sign that each line has the same number of times, outside quotes
    const counts = {',': [], ';': [], '\t': []};
    for (const line of lines) {
        let quoted = false;
        const found = {',': 0, ';': 0, '\t': 0};
        for (const char of line) {
            if (char === '"') { quoted = !quoted; } else if (!quoted && char in found) { found[char]++; }
        }
        for (const sign of Object.keys(counts)) { counts[sign].push(found[sign]); }
    }
    const score = (list) => (list.length && list.every(n => n === list[0]) && list[0] > 0 ? list[0] * 10 : list.reduce((a, b) => a + (b > 0 ? 1 : 0), 0));
    const delimiter = Object.keys(counts).sort((a, b) => score(counts[b]) - score(counts[a]))[0] ?? ',';
    const rows = parseRows(lines.join('\n'), delimiter);
    let comma = 0;
    let point = 0;
    const ambiguous = [];
    let dayFirst = 0;
    let monthFirst = 0;
    let iso = 0;
    let unclearDates = 0;
    for (const row of rows) {
        for (const raw of row) {
            const cell = raw.trim();
            const date = DATEISH.exec(cell);
            if (date) {
                const [a, b] = [Number(date[1]), Number(date[2])];
                if (date[1].length === 4) { iso++; } else if (a > 12 && b <= 12) { dayFirst++; } else if (b > 12 && a <= 12) { monthFirst++; } else { unclearDates++; }
                continue;
            }
            if (!NUMBERISH.test(cell)) { continue; }
            const digits = cell.replace(/[^\d.,]/g, '');
            const lastComma = digits.lastIndexOf(',');
            const lastPoint = digits.lastIndexOf('.');
            if (lastComma >= 0 && lastPoint >= 0) {
                if (lastComma > lastPoint) { comma++; } else { point++; }
            } else if (lastComma >= 0 || lastPoint >= 0) {
                const at = Math.max(lastComma, lastPoint);
                const sign = digits[at];
                const after = digits.length - at - 1;
                const many = digits.split(sign).length > 2;
                // "1,234,567" has many group signs. "12,5" or "1,2345" has a decimal sign. "1,234" can be both.
                if (many) { if (sign === ',') { point++; } else { comma++; } } else if (after !== 3) { if (sign === ',') { comma++; } else { point++; } } else if (ambiguous.length < 5) { ambiguous.push(cell); }
            }
        }
    }
    const decided = comma !== point ? (comma > point ? ',' : '.') : null;
    const decimal = decided ?? (ambiguous.length ? null : (delimiter === ';' ? ',' : '.'));
    const order = dayFirst && !monthFirst ? ['day', 'month', 'year'] : monthFirst && !dayFirst ? ['month', 'day', 'year'] : (iso && !unclearDates ? ['year', 'month', 'day'] : null);
    return {
        delimiter,
        decimal,
        group: decimal === ',' ? '.' : decimal === '.' ? ',' : null,
        order,
        confident: decimal !== null && (order !== null || !unclearDates) && !(comma && point),
        ambiguous,
    };
}

// Lines of a CSV text, with quotes, for detectCsvFormat
function parseRows(text, delimiter) {
    const rows = [];
    for (const line of text.split('\n')) {
        const cells = [];
        let value = '';
        let quoted = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (quoted) {
                if (char === '"' && line[i + 1] === '"') { value += '"'; i++; } else if (char === '"') { quoted = false; } else { value += char; }
            } else if (char === '"') {
                quoted = true;
            } else if (char === delimiter) {
                cells.push(value);
                value = '';
            } else {
                value += char;
            }
        }
        cells.push(value);
        rows.push(cells);
    }
    return rows;
}
