// The formula language of the sheet, with no DOM: addresses, a tokenizer, a parser, an evaluator,
// and the rewrite of references when rows or columns move. Rows and columns start at 0 here.
// The text that a person reads starts at 1: row 0 is "1", and column 0 is "A".

// The largest sheet: the same limits as common spreadsheet programs
export const MAX_ROWS = 1048576;
export const MAX_COLUMNS = 16384;

export function columnName(col) {
    let name = '';
    for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) {
        name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    }
    return name;
}

export function columnIndex(name) {
    let col = 0;
    for (const letter of name.toUpperCase()) { col = col * 26 + (letter.charCodeAt(0) - 64); }
    return col - 1;
}

export function formatAddress(row, col, {rowAbs = false, colAbs = false} = {}) {
    return `${colAbs ? '$' : ''}${columnName(col)}${rowAbs ? '$' : ''}${row + 1}`;
}

const ADDRESS = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})$/;

// 'B3' or '$B$3' to {row: 2, col: 1, rowAbs, colAbs}. Null if the text is not an address.
export function parseAddress(text) {
    const match = ADDRESS.exec(String(text).trim());
    if (!match) { return null; }
    const row = Number(match[4]) - 1;
    const col = columnIndex(match[2]);
    if (row < 0 || row >= MAX_ROWS || col >= MAX_COLUMNS) { return null; }
    return {row, col, colAbs: match[1] === '$', rowAbs: match[3] === '$'};
}

// 'A1:C4' or 'B2' to {top, left, bottom, right}
export function parseRange(text) {
    const [from, to = from] = String(text).split(':');
    const a = parseAddress(from);
    const b = parseAddress(to);
    if (!a || !b) { return null; }
    return normalizeRange({top: a.row, left: a.col, bottom: b.row, right: b.col});
}

export function normalizeRange({top, left, bottom = top, right = left}) {
    return {top: Math.min(top, bottom), left: Math.min(left, right), bottom: Math.max(top, bottom), right: Math.max(left, right)};
}

export function formatRange(range) {
    const start = formatAddress(range.top, range.left);
    return range.top === range.bottom && range.left === range.right ? start : `${start}:${formatAddress(range.bottom, range.right)}`;
}

// An error value, such as #DIV/0!. It goes through each calculation that uses it.
export class SheetError {
    constructor(code, message = '') {
        this.code = code;
        this.message = message;
    }
    toString() { return this.code; }
}

export const ERRORS = ['#DIV/0!', '#REF!', '#NAME?', '#VALUE!', '#CYCLE!', '#NUM!', '#N/A', '#ERROR!'];
const error = (code, message) => new SheetError(code, message);

// A date value: the number of days from 1970-01-01. It acts as a number in a calculation, and a
// date plus a number is a date.
export class SheetDate {
    constructor(days) { this.days = days; }
    valueOf() { return this.days; }
}

// ---------- Tokens ----------

const TOKEN = new RegExp([
    /(?<space>\s+)/,
    /(?<string>"(?:[^"]|"")*"?)/,
    /(?<error>#(?:DIV\/0!|REF!|NAME\?|VALUE!|CYCLE!|NUM!|N\/A|ERROR!))/,
    /(?<ref>\$?[A-Za-z]{1,3}\$?\d{1,7}(?![A-Za-z0-9_(]))/,
    /(?<number>(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/,
    /(?<name>[A-Za-z_][A-Za-z0-9_.]*)/,
    /(?<op><=|>=|<>|[-+*/^&=<>%(),:;])/,
].map(part => part.source).join('|'), 'y');

export function tokenize(text) {
    const tokens = [];
    TOKEN.lastIndex = 0;
    let at = 0;
    while (at < text.length) {
        TOKEN.lastIndex = at;
        const match = TOKEN.exec(text);
        if (!match) {
            tokens.push({type: 'bad', text: text[at], at});
            at++;
            continue;
        }
        const [type, value] = Object.entries(match.groups).find(([, v]) => v !== undefined);
        tokens.push({type, text: value, at});
        at += value.length;
    }
    return tokens;
}

// ---------- Parser ----------

class ParseError extends Error {}

// Reads a formula with no "=" to a tree. A formula that does not parse gives {t: 'err', code: '#ERROR!'}.
export function parseFormula(text) {
    const tokens = tokenize(text).filter(token => token.type !== 'space');
    let index = 0;
    const peek = () => tokens[index];
    const next = () => tokens[index++];
    const isOp = (...ops) => peek()?.type === 'op' && ops.includes(peek().text);
    const expect = (op) => {
        if (!isOp(op)) { throw new ParseError(`expected ${op}`); }
        return next();
    };

    function comparison() {
        let node = concat();
        while (isOp('=', '<>', '<', '>', '<=', '>=')) {
            node = {t: 'bin', op: next().text, a: node, b: concat()};
        }
        return node;
    }
    function concat() {
        let node = additive();
        while (isOp('&')) { next(); node = {t: 'bin', op: '&', a: node, b: additive()}; }
        return node;
    }
    function additive() {
        let node = term();
        while (isOp('+', '-')) { node = {t: 'bin', op: next().text, a: node, b: term()}; }
        return node;
    }
    function term() {
        let node = power();
        while (isOp('*', '/')) { node = {t: 'bin', op: next().text, a: node, b: power()}; }
        return node;
    }
    // As in other spreadsheets, a unary minus is stronger than ^: -2^2 is 4
    function power() {
        let node = unary();
        while (isOp('^')) { next(); node = {t: 'bin', op: '^', a: node, b: unary()}; }
        return node;
    }
    function unary() {
        if (isOp('-')) { next(); return {t: 'neg', a: unary()}; }
        if (isOp('+')) { next(); return unary(); }
        return postfix();
    }
    function postfix() {
        let node = primary();
        while (isOp('%')) { next(); node = {t: 'pct', a: node}; }
        return node;
    }
    function reference(token) {
        const address = parseAddress(token.text);
        if (!address) { return {t: 'err', code: '#REF!'}; }
        return {t: 'ref', ...address};
    }
    function primary() {
        const token = next();
        if (!token) { throw new ParseError('the formula ends too soon'); }
        switch (token.type) {
            case 'number': return {t: 'num', v: Number(token.text)};
            case 'string': {
                if (token.text.length < 2 || !token.text.endsWith('"')) { throw new ParseError('a text has no end quote'); }
                return {t: 'str', v: token.text.slice(1, -1).replaceAll('""', '"')};
            }
            case 'error': return {t: 'err', code: token.text.toUpperCase()};
            case 'ref': {
                const from = reference(token);
                if (isOp(':')) {
                    next();
                    const end = next();
                    if (end?.type !== 'ref') { throw new ParseError('a range needs two addresses'); }
                    const to = reference(end);
                    if (from.t === 'err' || to.t === 'err') { return {t: 'err', code: '#REF!'}; }
                    return {t: 'range', from, to};
                }
                return from;
            }
            case 'name': {
                const name = token.text.toUpperCase();
                if (isOp('(')) {
                    next();
                    const args = [];
                    if (!isOp(')')) {
                        do {
                            if (isOp(',', ';')) { next(); }
                            args.push(isOp(',', ';', ')') ? {t: 'blank'} : comparison());
                        } while (isOp(',', ';'));
                    }
                    expect(')');
                    return {t: 'call', name, args};
                }
                if (name === 'TRUE' || name === 'FALSE') { return {t: 'bool', v: name === 'TRUE'}; }
                return {t: 'name', name};
            }
            case 'op':
                if (token.text === '(') {
                    const node = comparison();
                    expect(')');
                    return node;
                }
                throw new ParseError(`unexpected ${token.text}`);
            default:
                throw new ParseError(`unexpected ${token.text}`);
        }
    }

    try {
        const tree = comparison();
        if (index < tokens.length) { throw new ParseError(`unexpected ${peek().text}`); }
        return tree;
    } catch (e) {
        if (!(e instanceof ParseError)) { throw e; }
        return {t: 'err', code: '#ERROR!', message: e.message};
    }
}

// Each cell and range that a tree reads: [{row, col}] and [{top, left, bottom, right}]
export function references(tree, found = {cells: [], ranges: []}) {
    switch (tree.t) {
        case 'ref': found.cells.push({row: tree.row, col: tree.col}); break;
        case 'range': found.ranges.push(normalizeRange({top: tree.from.row, left: tree.from.col, bottom: tree.to.row, right: tree.to.col})); break;
        case 'bin': references(tree.a, found); references(tree.b, found); break;
        case 'neg': case 'pct': references(tree.a, found); break;
        case 'call': for (const arg of tree.args) { references(arg, found); } break;
    }
    return found;
}

// ---------- Values ----------

const isError = (value) => value instanceof SheetError;
const isBlank = (value) => value === null || value === undefined || value === '';

export function toNumber(value) {
    if (isError(value)) { return value; }
    if (value === null || value === undefined || value === '') { return 0; }
    if (typeof value === 'number') { return value; }
    if (typeof value === 'boolean') { return value ? 1 : 0; }
    if (value instanceof SheetDate) { return value.days; }
    const number = Number(String(value).trim().replace(/,/g, ''));
    return Number.isFinite(number) && String(value).trim() !== '' ? number : error('#VALUE!', `"${value}" is not a number`);
}

export function toText(value) {
    if (value === null || value === undefined) { return ''; }
    if (typeof value === 'boolean') { return value ? 'TRUE' : 'FALSE'; }
    if (value instanceof SheetDate) { return String(value.days); }
    if (typeof value === 'number') { return String(Number(value.toPrecision(15))); }
    return String(value);
}

function toBoolean(value) {
    if (isError(value)) { return value; }
    if (typeof value === 'boolean') { return value; }
    if (isBlank(value)) { return false; }
    if (typeof value === 'string') {
        if (value.toUpperCase() === 'TRUE') { return true; }
        if (value.toUpperCase() === 'FALSE') { return false; }
        return error('#VALUE!', `"${value}" is not TRUE or FALSE`);
    }
    return Number(value) !== 0;
}

function compare(a, b) {
    // Text compares without case. A number is less than a text, as in other spreadsheets.
    const kind = (v) => (typeof v === 'string' ? 2 : typeof v === 'boolean' ? 3 : 1);
    if (isBlank(a)) { a = typeof b === 'string' ? '' : 0; }
    if (isBlank(b)) { b = typeof a === 'string' ? '' : 0; }
    if (kind(a) !== kind(b)) { return kind(a) - kind(b); }
    if (typeof a === 'string') { return a.localeCompare(b, undefined, {sensitivity: 'accent'}); }
    return Number(a) - Number(b);
}

// ---------- Functions ----------

// Each value of the arguments, with ranges opened. A range gives only numbers to SUM, as in other
// spreadsheets; a number written in the call can be text that reads as a number.
function numbers(args) {
    const result = [];
    for (const arg of args) {
        if (arg && arg.range) {
            for (const value of arg.values) {
                if (isError(value)) { return value; }
                if (typeof value === 'number' || value instanceof SheetDate) { result.push(Number(value)); }
            }
        } else {
            if (arg === undefined) { continue; }
            const number = toNumber(arg);
            if (isError(number)) { return number; }
            result.push(number);
        }
    }
    return result;
}

function flat(args) {
    return args.flatMap(arg => (arg && arg.range ? arg.values : [arg]));
}

function single(arg) {
    if (arg && arg.range) {
        return arg.values.length === 1 ? arg.values[0] : error('#VALUE!', 'a range in place of one value');
    }
    return arg;
}

const aggregate = (fn) => (args) => {
    const values = numbers(args);
    return isError(values) ? values : fn(values);
};

const unaryNumber = (fn) => (args) => {
    if (args.length !== 1) { return error('#VALUE!', 'the function needs one value'); }
    const value = toNumber(single(args[0]));
    return isError(value) ? value : fn(value);
};

const unaryText = (fn) => (args) => {
    if (args.length !== 1) { return error('#VALUE!', 'the function needs one value'); }
    const value = single(args[0]);
    return isError(value) ? value : fn(toText(value));
};

function round(value, digits) {
    const factor = 10 ** digits;
    return Math.sign(value) * Math.round(Math.abs(value) * factor + Number.EPSILON) / factor;
}

export const FUNCTIONS = {
    SUM: aggregate(values => values.reduce((sum, v) => sum + v, 0)),
    AVERAGE: aggregate(values => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : error('#DIV/0!', 'AVERAGE of no numbers'))),
    MIN: aggregate(values => (values.length ? Math.min(...values) : 0)),
    MAX: aggregate(values => (values.length ? Math.max(...values) : 0)),
    PRODUCT: aggregate(values => values.reduce((product, v) => product * v, 1)),
    COUNT: (args) => flat(args).filter(v => typeof v === 'number' || v instanceof SheetDate).length,
    COUNTA: (args) => flat(args).filter(v => !isBlank(v)).length,
    COUNTBLANK: (args) => flat(args).filter(isBlank).length,
    ABS: unaryNumber(Math.abs),
    SQRT: unaryNumber(v => (v < 0 ? error('#NUM!', 'SQRT of a negative number') : Math.sqrt(v))),
    INT: unaryNumber(Math.floor),
    ROUND: (args) => {
        const value = toNumber(single(args[0]));
        const digits = args.length > 1 ? toNumber(single(args[1])) : 0;
        if (isError(value)) { return value; }
        if (isError(digits)) { return digits; }
        return round(value, Math.trunc(digits));
    },
    MOD: (args) => {
        const [a, b] = args.map(arg => toNumber(single(arg)));
        if (isError(a)) { return a; }
        if (isError(b)) { return b; }
        if (b === 0) { return error('#DIV/0!', 'MOD by zero'); }
        return a - b * Math.floor(a / b);
    },
    IF: (args) => {
        const test = toBoolean(single(args[0]));
        if (isError(test)) { return test; }
        const chosen = test ? args[1] : args[2];
        return chosen === undefined ? test : single(chosen) ?? 0;
    },
    IFERROR: (args) => {
        const value = single(args[0]);
        return isError(value) ? single(args[1]) ?? '' : value;
    },
    AND: (args) => {
        const values = flat(args).filter(v => !isBlank(v)).map(toBoolean);
        return values.find(isError) ?? values.every(Boolean);
    },
    OR: (args) => {
        const values = flat(args).filter(v => !isBlank(v)).map(toBoolean);
        return values.find(isError) ?? values.some(Boolean);
    },
    NOT: (args) => {
        const value = toBoolean(single(args[0]));
        return isError(value) ? value : !value;
    },
    CONCAT: (args) => {
        const values = flat(args);
        return values.find(isError) ?? values.map(toText).join('');
    },
    LEN: unaryText(text => text.length),
    UPPER: unaryText(text => text.toUpperCase()),
    LOWER: unaryText(text => text.toLowerCase()),
    TRIM: unaryText(text => text.trim().replace(/\s+/g, ' ')),
    TODAY: () => {
        const now = new Date();
        return new SheetDate(Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000));
    },
};
FUNCTIONS.CONCATENATE = FUNCTIONS.CONCAT;

// ---------- Evaluator ----------

// context.value(row, col) gives the value of a cell. context.values(range) gives the values of a
// range, row by row.
export function evaluate(tree, context) {
    switch (tree.t) {
        case 'num': return tree.v;
        case 'str': return tree.v;
        case 'bool': return tree.v;
        case 'blank': return undefined;
        case 'err': return error(tree.code, tree.message);
        case 'name': return error('#NAME?', `no name ${tree.name}`);
        case 'ref': return context.value(tree.row, tree.col) ?? null;
        case 'range': {
            const range = normalizeRange({top: tree.from.row, left: tree.from.col, bottom: tree.to.row, right: tree.to.col});
            return {range, values: context.values(range)};
        }
        case 'neg': {
            const value = toNumber(single(evaluate(tree.a, context)));
            return isError(value) ? value : -value;
        }
        case 'pct': {
            const value = toNumber(single(evaluate(tree.a, context)));
            return isError(value) ? value : value / 100;
        }
        case 'call': {
            const fn = FUNCTIONS[tree.name];
            if (!fn) { return error('#NAME?', `no function ${tree.name}`); }
            // A reference in a call acts as a range of one cell, so SUM(A1) leaves out a text in A1
            const args = tree.args.map(arg => (arg.t === 'ref'
                ? {range: {top: arg.row, left: arg.col, bottom: arg.row, right: arg.col}, values: [context.value(arg.row, arg.col) ?? null]}
                : evaluate(arg, context)));
            // Most functions stop at the first error. IFERROR, COUNT, COUNTA, and COUNTBLANK see each value.
            if (!['IFERROR', 'COUNT', 'COUNTA', 'COUNTBLANK', 'IF'].includes(tree.name)) {
                const failed = args.find(isError);
                if (failed) { return failed; }
            }
            if (tree.name === 'IF' && isError(single(args[0]))) { return single(args[0]); }
            return fn(args);
        }
        case 'bin': return binary(tree.op, single(evaluate(tree.a, context)), single(evaluate(tree.b, context)));
    }
    return error('#ERROR!');
}

function binary(op, a, b) {
    if (isError(a)) { return a; }
    if (isError(b)) { return b; }
    if (op === '&') { return toText(a) + toText(b); }
    if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
        const order = compare(a, b);
        return {'=': order === 0, '<>': order !== 0, '<': order < 0, '>': order > 0, '<=': order <= 0, '>=': order >= 0}[op];
    }
    const x = toNumber(a);
    const y = toNumber(b);
    if (isError(x)) { return x; }
    if (isError(y)) { return y; }
    switch (op) {
        case '+': {
            const sum = x + y;
            return (a instanceof SheetDate) !== (b instanceof SheetDate) ? new SheetDate(sum) : sum;
        }
        case '-': {
            const difference = x - y;
            return a instanceof SheetDate && !(b instanceof SheetDate) ? new SheetDate(difference) : difference;
        }
        case '*': return x * y;
        case '/': return y === 0 ? error('#DIV/0!', 'division by zero') : x / y;
        case '^': {
            const result = x ** y;
            return Number.isFinite(result) ? result : error('#NUM!', 'the result is too large');
        }
    }
    return error('#ERROR!');
}

// ---------- Rewrites ----------

// Changes each reference in a formula text. move(ref) gets {row, col, rowAbs, colAbs} and gives a
// new reference or null for #REF!. moveRange(from, to) can change a range as one: it gives
// [from, to], or null for #REF!. The rest of the text stays the same.
export function rewriteFormula(text, {move, moveRange = null}) {
    const tokens = tokenize(text);
    let out = '';
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type !== 'ref') { out += token.text; continue; }
        const from = parseAddress(token.text);
        // A range is ref, ':', ref, also with spaces between them
        let j = i + 1;
        while (tokens[j]?.type === 'space') { j++; }
        if (tokens[j]?.type === 'op' && tokens[j].text === ':') {
            let k = j + 1;
            while (tokens[k]?.type === 'space') { k++; }
            if (tokens[k]?.type === 'ref') {
                const to = parseAddress(tokens[k].text);
                const moved = moveRange ? moveRange(from, to) : [move(from), move(to)];
                out += moved && moved[0] && moved[1] ? `${formatAddress(moved[0].row, moved[0].col, moved[0])}:${formatAddress(moved[1].row, moved[1].col, moved[1])}` : '#REF!';
                i = k;
                continue;
            }
        }
        const moved = from && move(from);
        out += moved ? formatAddress(moved.row, moved.col, moved) : '#REF!';
    }
    return out;
}

const inBounds = (ref) => ref.row >= 0 && ref.col >= 0 && ref.row < MAX_ROWS && ref.col < MAX_COLUMNS;

// A copy to a place that is dRows down and dCols right. An absolute part ($) stays.
export function shiftFormula(text, dRows, dCols) {
    return rewriteFormula(text, {
        move: (ref) => {
            const moved = {...ref, row: ref.rowAbs ? ref.row : ref.row + dRows, col: ref.colAbs ? ref.col : ref.col + dCols};
            return inBounds(moved) ? moved : null;
        },
    });
}

// Rows or columns were added (count > 0) or removed (count < 0) at index. Each reference moves,
// also an absolute one, because the cell that it names moved.
export function adjustForInsertDelete(text, axis, index, count) {
    const key = axis === 'row' ? 'row' : 'col';
    const moveOne = (ref) => {
        const at = ref[key];
        if (count > 0) { return at >= index ? {...ref, [key]: at + count} : ref; }
        const removedEnd = index - count;
        if (at >= index && at < removedEnd) { return null; }
        return at >= removedEnd ? {...ref, [key]: at + count} : ref;
    };
    const moveRange = (from, to) => {
        if (count > 0) { return [moveOne(from), moveOne(to)]; }
        const removedEnd = index - count;
        const low = Math.min(from[key], to[key]);
        const high = Math.max(from[key], to[key]);
        if (low >= index && high < removedEnd) { return null; }
        // The range becomes smaller: an end in the removed part goes to the edge of what stays
        const start = low < index ? low : (low >= removedEnd ? low + count : index);
        const end = high >= removedEnd ? high + count : Math.min(high, index - 1);
        const [first, last] = from[key] <= to[key] ? [from, to] : [to, from];
        return [{...first, [key]: start}, {...last, [key]: end}];
    };
    return rewriteFormula(text, {move: moveOne, moveRange});
}
