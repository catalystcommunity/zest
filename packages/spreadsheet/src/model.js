// The data of a sheet, with no DOM. A cell has the input that the user typed, an optional type, a
// value, and a style. A formula cell recalculates when a cell that it reads changes. Only the cells
// that depend on a change recalculate, in an order where each cell comes after the cells that it reads.
import { dateFormat, numberFormat, dayNumber, fromDayNumber, formatDate } from "@catalystcommunity/date-model";
import {
    MAX_COLUMNS, SheetDate, SheetError, adjustForInsertDelete, evaluate, formatAddress, formatRange, normalizeRange,
    parseAddress, parseFormula, parseRange, references, shiftFormula, toText,
} from "./formula.js";

export const TYPES = ['auto', 'text', 'number', 'currency', 'percent', 'date', 'boolean'];

// A range with more cells than this goes into a list that each change checks, so that a formula
// such as SUM(A1:Z100000) does not make millions of links.
const POINT_RANGE_LIMIT = 1000;

const keyOf = (row, col) => row * MAX_COLUMNS + col;
const rowOf = (key) => Math.floor(key / MAX_COLUMNS);
const colOf = (key) => key % MAX_COLUMNS;
const inRange = (range, row, col) => row >= range.top && row <= range.bottom && col >= range.left && col <= range.right;
const sameStyle = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const NUMBER = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?(?:[eE][-+]?\d+)?$/;
const CURRENCY = /^([-+]?)\s*([$€£¥])\s*(.+)$/;
const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function readNumber(text) {
    const trimmed = text.trim();
    if (!trimmed || !/\d/.test(trimmed) || !NUMBER.test(trimmed)) { return null; }
    return Number(trimmed.replace(/,/g, ''));
}

function readDate(text) {
    const iso = ISO_DATE.exec(text.trim());
    const us = US_DATE.exec(text.trim());
    const [year, month, day] = iso ? [iso[1], iso[2], iso[3]].map(Number) : us ? [us[3], us[1], us[2]].map(Number) : [];
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) { return null; }
    const days = dayNumber({year, month, day});
    const back = fromDayNumber(days);
    return back.month === month && back.day === day ? new SheetDate(days) : null;
}

function readBoolean(text, loose) {
    const word = text.trim().toLowerCase();
    if (word === 'true' || (loose && ['yes', 'y', '1', 'x', 'on'].includes(word))) { return true; }
    if (word === 'false' || (loose && ['no', 'n', '0', 'off', ''].includes(word))) { return false; }
    return null;
}

// Reads what a user typed. The result has a value and the type that the input showed, for example
// '$5' is currency. A formula gives {formula: tree}. An apostrophe at the start keeps the text.
export function readInput(input, type = 'auto') {
    const text = input ?? '';
    if (text === '') { return {value: null, type: null}; }
    if (type !== 'text' && text.startsWith('=') && text.length > 1) { return {formula: parseFormula(text.slice(1)), type: null}; }
    if (type === 'text') { return {value: text, type: 'text'}; }
    if (text.startsWith("'")) { return {value: text.slice(1), type: 'text'}; }
    const trimmed = text.trim();
    const percent = trimmed.endsWith('%') ? readNumber(trimmed.slice(0, -1)) : null;
    if (percent !== null) { return {value: percent / 100, type: 'percent'}; }
    const currency = CURRENCY.exec(trimmed);
    if (currency) {
        const number = readNumber(currency[3]);
        if (number !== null) { return {value: currency[1] === '-' ? -number : number, type: 'currency', symbol: currency[2]}; }
    }
    const number = readNumber(trimmed);
    if (number !== null) {
        // In a percent column, 12 means 12%
        return {value: type === 'percent' ? number / 100 : number, type: 'number'};
    }
    if (type === 'boolean') {
        const flag = readBoolean(trimmed, true);
        if (flag !== null) { return {value: flag, type: 'boolean'}; }
    }
    const flag = readBoolean(trimmed, false);
    if (flag !== null) { return {value: flag, type: 'boolean'}; }
    const date = readDate(trimmed);
    if (date) { return {value: date, type: 'date'}; }
    return {value: text, type: 'text'};
}

// One recorded user change, for undo
function snapshotOf(cell) {
    return cell ? {input: cell.input, style: cell.style ?? null, type: cell.type ?? null} : {input: '', style: null, type: null};
}

export class SheetModel extends EventTarget {
    #cells = new Map();
    // The formula cells that read a cell, by the key of the cell that they read
    #dependents = new Map();
    // Large ranges, which each change checks: [{range, key}]
    #wideRanges = [];
    #undo = [];
    #redo = [];
    #batch = null;
    #rows;
    #columns;
    #columnInfo = [];

    // rows, columns: the size. columns can also be a list: [{title, type, decimals, currency, width}]
    constructor({rows = 1000, columns = 26, locale = undefined} = {}) {
        super();
        this.#rows = rows;
        this.locale = locale;
        if (Array.isArray(columns)) {
            this.#columns = columns.length;
            this.#columnInfo = columns.map(info => ({...info}));
        } else {
            this.#columns = columns;
        }
    }

    get rowCount() { return this.#rows; }
    get columnCount() { return this.#columns; }
    get canUndo() { return this.#undo.length > 0; }
    get canRedo() { return this.#redo.length > 0; }
    get cellCount() { return this.#cells.size; }

    column(col) { return this.#columnInfo[col] ?? {}; }

    // Changes the type, the format, the title, or the width of a column, and shows each cell again
    setColumn(col, changes) {
        this.#columnInfo[col] = {...this.column(col), ...changes};
        const keys = new Set();
        for (const [key, cell] of this.#cells) {
            if (colOf(key) === col) {
                if ('type' in changes && !cell.formula) { this.#read(cell); }
                keys.add(key);
            }
        }
        if ('type' in changes) { this.#recalculate(keys, keys); }
        this.#send({changes: [], keys, columns: [col]});
    }

    #key(where, col) {
        if (typeof where === 'string') {
            const address = parseAddress(where);
            if (!address) { throw new Error(`Not a cell address: ${where}`); }
            return keyOf(address.row, address.col);
        }
        return keyOf(where, col);
    }

    // The cell at 'B2' or at (row, col): {address, row, col, input, type, value, display, style, error}
    getCell(where, col) {
        const key = this.#key(where, col);
        const row = rowOf(key);
        const column = colOf(key);
        const cell = this.#cells.get(key);
        const type = this.typeAt(row, column);
        const value = cell?.value ?? null;
        return {
            address: formatAddress(row, column),
            row,
            col: column,
            input: cell?.input ?? '',
            formula: Boolean(cell?.formula),
            type,
            value,
            display: this.format(value, type, cell, column),
            style: cell?.style ?? null,
            error: value instanceof SheetError ? value : null,
        };
    }

    getValue(where, col) {
        return this.#cells.get(this.#key(where, col))?.value ?? null;
    }

    getInput(where, col) {
        return this.#cells.get(this.#key(where, col))?.input ?? '';
    }

    // The type that shows the value: the type of the cell, then the column, then what the input showed
    typeAt(row, col) {
        const cell = this.#cells.get(keyOf(row, col));
        const set = cell?.type ?? this.column(col).type;
        if (set && set !== 'auto') { return set; }
        if (cell?.value instanceof SheetDate) { return 'date'; }
        return cell?.shown ?? (cell?.value === null || cell?.value === undefined ? 'auto' : typeof cell.value === 'boolean' ? 'boolean' : typeof cell.value === 'number' ? 'number' : 'text');
    }

    // The text that a cell shows
    format(value, type, cell = null, col = cell ? colOf(cell.key) : -1) {
        if (value === null || value === undefined) { return ''; }
        if (value instanceof SheetError) { return value.code; }
        const info = {...this.column(col), ...(cell?.format ?? {})};
        if (typeof value === 'boolean') { return value ? 'TRUE' : 'FALSE'; }
        const number = typeof value === 'number' ? value : value instanceof SheetDate ? value.days : null;
        if (number === null) { return String(value); }
        const decimals = info.decimals;
        const fixed = decimals === undefined ? {} : {minimumFractionDigits: decimals, maximumFractionDigits: decimals};
        switch (type) {
            case 'date': {
                if (info.dateStyle === 'iso') { return formatDate(fromDayNumber(Math.floor(number))); }
                return dateFormat(this.locale, {dateStyle: info.dateStyle ?? 'medium', timeZone: 'UTC'}).format(new Date(Math.floor(number) * 86400000));
            }
            case 'currency':
                return numberFormat(this.locale, {style: 'currency', currency: info.currency ?? cell?.currency ?? 'USD', ...fixed}).format(number);
            case 'percent':
                return numberFormat(this.locale, {style: 'percent', maximumFractionDigits: decimals ?? 2, minimumFractionDigits: decimals ?? 0}).format(number);
            case 'number':
                return decimals === undefined && !info.grouping
                    ? numberFormat(this.locale, {maximumFractionDigits: 10, useGrouping: false}).format(number)
                    : numberFormat(this.locale, {...fixed, useGrouping: info.grouping ?? true}).format(number);
            default:
                return value instanceof SheetDate ? String(value.days) : toText(number);
        }
    }

    // ---------- Changes ----------

    // Puts many changes into one undo step and one change event
    batch(fn) {
        if (this.#batch) { return fn(); }
        this.#batch = {changes: new Map(), keys: new Set()};
        let result;
        try {
            result = fn();
        } finally {
            const batch = this.#batch;
            this.#batch = null;
            this.#finish(batch);
        }
        return result;
    }

    setCell(where, input) {
        const key = this.#key(where);
        this.batch(() => this.#write(key, {input: String(input ?? '')}));
    }

    // [{row, col, input}] or [{address, input}], also with style or type
    setCells(changes) {
        this.batch(() => {
            for (const change of changes) {
                const key = change.address ? this.#key(change.address) : keyOf(change.row, change.col);
                const patch = {};
                if ('input' in change) { patch.input = String(change.input ?? ''); }
                if ('style' in change) { patch.style = change.style; }
                if ('type' in change) { patch.type = change.type; }
                this.#write(key, patch);
            }
        });
    }

    // Merges a style into each cell of a range: {bold: true}. A value of null removes that part.
    setStyle(range, style) {
        const area = typeof range === 'string' ? parseRange(range) : normalizeRange(range);
        this.batch(() => {
            for (let row = area.top; row <= area.bottom; row++) {
                for (let col = area.left; col <= area.right; col++) {
                    const key = keyOf(row, col);
                    const merged = {...(this.#cells.get(key)?.style ?? {}), ...style};
                    for (const [name, value] of Object.entries(merged)) {
                        if (value === null || value === false) { delete merged[name]; }
                    }
                    this.#write(key, {style: Object.keys(merged).length ? merged : null});
                }
            }
        });
    }

    setType(range, type) {
        if (type !== null && !TYPES.includes(type)) { throw new Error(`Not a cell type: ${type}`); }
        const area = typeof range === 'string' ? parseRange(range) : normalizeRange(range);
        this.batch(() => {
            for (let row = area.top; row <= area.bottom; row++) {
                for (let col = area.left; col <= area.right; col++) { this.#write(keyOf(row, col), {type}); }
            }
        });
    }

    clear(range) {
        const area = typeof range === 'string' ? parseRange(range) : normalizeRange(range);
        this.batch(() => {
            for (const key of this.#keysIn(area)) { this.#write(key, {input: ''}); }
        });
    }

    // The keys of the cells with content in a range, with no loop over each empty cell of a large range
    #keysIn(area) {
        const size = (area.bottom - area.top + 1) * (area.right - area.left + 1);
        if (size > this.#cells.size) {
            return [...this.#cells.keys()].filter(key => inRange(area, rowOf(key), colOf(key)));
        }
        const keys = [];
        for (let row = area.top; row <= area.bottom; row++) {
            for (let col = area.left; col <= area.right; col++) {
                if (this.#cells.has(keyOf(row, col))) { keys.push(keyOf(row, col)); }
            }
        }
        return keys;
    }

    #write(key, patch) {
        const old = this.#cells.get(key);
        const before = snapshotOf(old);
        const after = {...before, ...patch};
        if (after.input === before.input && sameStyle(after.style, before.style) && after.type === before.type) { return; }
        const batch = this.#batch;
        if (!batch.changes.has(key)) { batch.changes.set(key, {key, before}); }
        batch.changes.get(key).after = after;
        this.#apply(key, after);
        batch.keys.add(key);
    }

    // Puts a snapshot into a cell, and updates the links of a formula
    #apply(key, {input, style, type}) {
        let cell = this.#cells.get(key);
        if (!input && !style && !type) {
            if (cell) {
                this.#unlink(cell);
                this.#cells.delete(key);
            }
            return;
        }
        if (!cell) {
            cell = {key, input: '', value: null};
            this.#cells.set(key, cell);
        }
        const inputChanged = cell.input !== input || cell.type !== type;
        cell.style = style;
        cell.type = type;
        if (inputChanged) {
            cell.input = input;
            this.#unlink(cell);
            this.#read(cell);
            if (cell.formula) { this.#link(cell); }
        }
    }

    #read(cell) {
        const set = cell.type ?? this.column(colOf(cell.key)).type ?? 'auto';
        const read = readInput(cell.input, set);
        cell.formula = read.formula ?? null;
        cell.shown = read.type;
        cell.currency = read.symbol ? {'$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY'}[read.symbol] : undefined;
        if (!cell.formula) { cell.value = read.value; }
    }

    #link(cell) {
        const found = references(cell.formula);
        cell.links = [];
        const add = (key) => {
            let set = this.#dependents.get(key);
            if (!set) { set = new Set(); this.#dependents.set(key, set); }
            set.add(cell.key);
            cell.links.push(key);
        };
        for (const ref of found.cells) { add(keyOf(ref.row, ref.col)); }
        for (const range of found.ranges) {
            const size = (range.bottom - range.top + 1) * (range.right - range.left + 1);
            if (size <= POINT_RANGE_LIMIT) {
                for (let row = range.top; row <= range.bottom; row++) {
                    for (let col = range.left; col <= range.right; col++) { add(keyOf(row, col)); }
                }
            } else {
                this.#wideRanges.push({range, key: cell.key});
            }
        }
    }

    #unlink(cell) {
        for (const key of cell.links ?? []) {
            const set = this.#dependents.get(key);
            set?.delete(cell.key);
            if (set && !set.size) { this.#dependents.delete(key); }
        }
        cell.links = null;
        if (this.#wideRanges.length) { this.#wideRanges = this.#wideRanges.filter(item => item.key !== cell.key); }
    }

    #dependentsOf(key) {
        const direct = this.#dependents.get(key);
        if (!this.#wideRanges.length) { return direct ?? []; }
        const row = rowOf(key);
        const col = colOf(key);
        const wide = this.#wideRanges.filter(item => inRange(item.range, row, col)).map(item => item.key);
        return wide.length ? [...(direct ?? []), ...wide] : (direct ?? []);
    }

    // Recalculates the changed cells and each cell that depends on them. The walk has no recursion,
    // so a chain of 100,000 formulas does not use up the stack.
    #recalculate(changed, shown) {
        const state = new Map();
        const order = [];
        const cycle = new Set();
        for (const start of changed) {
            if (state.has(start)) { continue; }
            const stack = [[start, this.#dependentsOf(start)[Symbol.iterator]()]];
            const onStack = [start];
            state.set(start, 1);
            while (stack.length) {
                const top = stack[stack.length - 1];
                const step = top[1].next();
                if (step.done) {
                    stack.pop();
                    onStack.pop();
                    state.set(top[0], 2);
                    order.push(top[0]);
                    continue;
                }
                const next = step.value;
                const seen = state.get(next);
                if (seen === 1) {
                    for (let i = onStack.lastIndexOf(next); i < onStack.length; i++) { cycle.add(onStack[i]); }
                } else if (seen === undefined) {
                    state.set(next, 1);
                    stack.push([next, this.#dependentsOf(next)[Symbol.iterator]()]);
                    onStack.push(next);
                }
            }
        }
        order.reverse();
        const context = {
            value: (row, col) => this.#cells.get(keyOf(row, col))?.value ?? null,
            values: (range) => {
                const values = [];
                for (let row = range.top; row <= range.bottom; row++) {
                    for (let col = range.left; col <= range.right; col++) { values.push(this.#cells.get(keyOf(row, col))?.value ?? null); }
                }
                return values;
            },
        };
        for (const key of cycle) {
            const cell = this.#cells.get(key);
            if (cell?.formula) { cell.value = new SheetError('#CYCLE!', 'the formula reads its own result'); }
        }
        for (const key of order) {
            shown.add(key);
            const cell = this.#cells.get(key);
            if (!cell?.formula || cycle.has(key)) { continue; }
            const result = evaluate(cell.formula, context);
            cell.value = result && result.range ? (result.values.length === 1 ? result.values[0] : new SheetError('#VALUE!', 'a range in place of one value')) : result;
        }
        return order.length;
    }

    #finish(batch, record = true) {
        if (!batch.changes.size && !batch.structure) { return; }
        const changed = [...batch.changes.values()].filter(change => change.before.input !== change.after.input || change.before.type !== change.after.type);
        const keys = new Set(batch.keys);
        this.lastRecalculated = this.#recalculate(new Set(changed.map(change => change.key)), keys);
        if (record) {
            this.#undo.push({cells: [...batch.changes.values()]});
            this.#redo = [];
        }
        this.#send({
            changes: [...batch.changes.values()].map(change => ({
                address: formatAddress(rowOf(change.key), colOf(change.key)),
                row: rowOf(change.key),
                col: colOf(change.key),
                oldInput: change.before.input,
                newInput: change.after.input,
            })),
            keys,
        });
    }

    #send(detail) {
        detail.cells = (detail.keys ?? new Set());
        detail.history = {canUndo: this.canUndo, canRedo: this.canRedo};
        this.dispatchEvent(new CustomEvent('change', {detail}));
    }

    // ---------- Undo ----------

    undo() { return this.#step(this.#undo, this.#redo, 'before'); }
    redo() { return this.#step(this.#redo, this.#undo, 'after'); }

    #step(from, to, side) {
        const entry = from.pop();
        if (!entry) { return false; }
        if (entry.structure) {
            entry.structure[side === 'before' ? 'undo' : 'redo']();
            to.push(entry);
            this.#send({changes: [], keys: new Set(), structure: entry.structure.info});
            return true;
        }
        const batch = {changes: new Map(), keys: new Set()};
        for (const change of entry.cells) {
            const target = change[side];
            const now = snapshotOf(this.#cells.get(change.key));
            batch.changes.set(change.key, {key: change.key, before: now, after: target});
            this.#apply(change.key, target);
            batch.keys.add(change.key);
        }
        to.push(entry);
        this.#finish(batch, false);
        return true;
    }

    // ---------- Rows and columns ----------

    insertRows(index, count = 1) { this.#structure('row', index, count); }
    deleteRows(index, count = 1) { this.#structure('row', index, -count); }
    insertColumns(index, count = 1) { this.#structure('col', index, count); }
    deleteColumns(index, count = 1) { this.#structure('col', index, -count); }

    #structure(axis, index, count, record = true) {
        const removedEnd = index - count;
        const restore = [];
        const moved = new Map();
        for (const [key, cell] of this.#cells) {
            const row = rowOf(key);
            const col = colOf(key);
            const at = axis === 'row' ? row : col;
            let input = cell.input;
            if (cell.formula) {
                const rewritten = '=' + adjustForInsertDelete(input.slice(1), axis, index, count);
                if (rewritten !== input) {
                    if (count < 0) { restore.push({row, col, input}); }
                    input = rewritten;
                }
            }
            if (count < 0 && at >= index && at < removedEnd) {
                restore.push({row, col, input: cell.input, style: cell.style ?? null, type: cell.type ?? null});
                continue;
            }
            const shift = count > 0 ? (at >= index ? count : 0) : (at >= removedEnd ? count : 0);
            const newKey = axis === 'row' ? keyOf(row + shift, col) : keyOf(row, col + shift);
            moved.set(newKey, {input, style: cell.style ?? null, type: cell.type ?? null});
        }
        let removedColumns = null;
        if (axis === 'row') {
            this.#rows = Math.max(1, this.#rows + count);
        } else {
            this.#columns = Math.max(1, this.#columns + count);
            if (count > 0) {
                this.#columnInfo.splice(index, 0, ...Array.from({length: count}, () => ({})));
            } else {
                removedColumns = this.#columnInfo.splice(index, -count);
            }
        }
        this.#cells.clear();
        this.#dependents.clear();
        this.#wideRanges = [];
        for (const [key, snapshot] of moved) { this.#apply(key, snapshot); }
        const all = new Set([...this.#cells.keys()].filter(key => this.#cells.get(key).formula));
        this.#recalculate(all, new Set());
        const info = {axis, index, count};
        if (record) {
            this.#undo.push({
                structure: {
                    info,
                    undo: () => {
                        this.#structure(axis, index, -count, false);
                        if (removedColumns) { this.#columnInfo.splice(index, removedColumns.length, ...removedColumns); }
                        if (restore.length) {
                            for (const item of restore) {
                                const key = keyOf(item.row, item.col);
                                const current = snapshotOf(this.#cells.get(key));
                                this.#apply(key, {...current, ...item});
                            }
                            this.#recalculate(new Set([...this.#cells.keys()]), new Set());
                        }
                    },
                    redo: () => this.#structure(axis, index, count, false),
                },
            });
            this.#redo = [];
        }
        this.#send({changes: [], keys: new Set(), structure: info});
    }

    // ---------- Clipboard ----------

    // A copy of a range: the inputs, for a paste in this sheet, and TSV text for other programs
    copy(range) {
        const area = typeof range === 'string' ? parseRange(range) : normalizeRange(range);
        const rows = [];
        for (let row = area.top; row <= area.bottom; row++) {
            const line = [];
            for (let col = area.left; col <= area.right; col++) {
                const cell = this.#cells.get(keyOf(row, col));
                line.push({...snapshotOf(cell), display: this.getCell(row, col).display});
            }
            rows.push(line);
        }
        return {range: area, rows, text: toDelimited(rows.map(line => line.map(item => item.display)), '\t')};
    }

    // Pastes a copy at a cell. Relative references move with the cells, as in other spreadsheets.
    // A copy of one cell fills all of a larger target range.
    paste(target, clip) {
        const at = typeof target === 'string' ? parseRange(target) : normalizeRange(target);
        const height = clip.rows.length;
        const width = clip.rows[0]?.length ?? 0;
        const repeatRows = height === 1 && width === 1 ? at.bottom - at.top + 1 : height;
        const repeatCols = height === 1 && width === 1 ? at.right - at.left + 1 : width;
        const changes = [];
        for (let i = 0; i < repeatRows; i++) {
            for (let j = 0; j < repeatCols; j++) {
                const item = clip.rows[i % height][j % width];
                const row = at.top + i;
                const col = at.left + j;
                if (row >= this.#rows || col >= this.#columns) { continue; }
                const source = {row: clip.range.top + (i % height), col: clip.range.left + (j % width)};
                const input = item.input.startsWith('=') ? '=' + shiftFormula(item.input.slice(1), row - source.row, col - source.col) : item.input;
                changes.push({row, col, input, style: item.style, type: item.type});
            }
        }
        this.setCells(changes);
        return {top: at.top, left: at.left, bottom: Math.min(this.#rows - 1, at.top + repeatRows - 1), right: Math.min(this.#columns - 1, at.left + repeatCols - 1)};
    }

    // Pastes text from another program: tabs between cells, and lines between rows
    pasteText(target, text) {
        const rows = parseDelimited(text.replace(/\r?\n$/, ''), '\t');
        const at = typeof target === 'string' ? parseRange(target) : normalizeRange(target);
        return this.paste(at, {range: {top: at.top, left: at.left}, rows: rows.map(line => line.map(input => ({input, style: null, type: null})))});
    }

    // Copies the top row of a range to the other rows, or the first column to the other columns
    fill(range, direction = 'down') {
        const area = normalizeRange(range);
        const source = direction === 'down'
            ? {top: area.top, left: area.left, bottom: area.top, right: area.right}
            : {top: area.top, left: area.left, bottom: area.bottom, right: area.left};
        const clip = this.copy(source);
        const target = direction === 'down'
            ? {top: area.top + 1, left: area.left, bottom: area.bottom, right: area.right}
            : {top: area.top, left: area.left + 1, bottom: area.bottom, right: area.right};
        if (target.top > target.bottom || target.left > target.right) { return; }
        this.batch(() => {
            if (direction === 'down') {
                for (let row = target.top; row <= target.bottom; row++) { this.paste({top: row, left: area.left, bottom: row, right: area.right}, clip); }
            } else {
                for (let col = target.left; col <= target.right; col++) { this.paste({top: area.top, left: col, bottom: area.bottom, right: col}, clip); }
            }
        });
    }

    // ---------- Search ----------

    // The last row and column with content, or -1
    get usedRange() {
        let bottom = -1;
        let right = -1;
        for (const key of this.#cells.keys()) {
            if (!this.#cells.get(key).input) { continue; }
            bottom = Math.max(bottom, rowOf(key));
            right = Math.max(right, colOf(key));
        }
        return {top: 0, left: 0, bottom, right};
    }

    isEmpty(row, col) {
        return !this.#cells.get(keyOf(row, col))?.input;
    }

    // Where Ctrl and an arrow key go: to the edge of the data block, or to the next block, or to the
    // edge of the sheet
    dataEdge(row, col, dRow, dCol) {
        const valid = (r, c) => r >= 0 && c >= 0 && r < this.#rows && c < this.#columns;
        let r = row + dRow;
        let c = col + dCol;
        if (!valid(r, c)) { return {row, col}; }
        if (!this.isEmpty(row, col) && !this.isEmpty(r, c)) {
            while (valid(r + dRow, c + dCol) && !this.isEmpty(r + dRow, c + dCol)) { r += dRow; c += dCol; }
            return {row: r, col: c};
        }
        while (valid(r, c) && this.isEmpty(r, c)) {
            if (!valid(r + dRow, c + dCol)) { return {row: r, col: c}; }
            r += dRow;
            c += dCol;
        }
        return {row: r, col: c};
    }

    // Statistics of a range, for a status bar
    summary(range) {
        const area = normalizeRange(range);
        let count = 0;
        let numbers = 0;
        let sum = 0;
        for (const key of this.#keysIn(area)) {
            const value = this.#cells.get(key)?.value;
            if (value === null || value === undefined || value === '') { continue; }
            count++;
            if (typeof value === 'number' || value instanceof SheetDate) { numbers++; sum += Number(value); }
        }
        return {count, numbers, sum, average: numbers ? sum / numbers : null};
    }

    // ---------- Import and export ----------

    // values: false gives the inputs, so formulas stay formulas
    toCSV({range = null, values = true} = {}) {
        const used = this.usedRange;
        const area = range ? normalizeRange(range) : {top: 0, left: 0, bottom: used.bottom, right: used.right};
        if (area.bottom < 0) { return ''; }
        const rows = [];
        for (let row = area.top; row <= area.bottom; row++) {
            const line = [];
            for (let col = area.left; col <= area.right; col++) {
                const cell = this.#cells.get(keyOf(row, col));
                if (!values) { line.push(cell?.input ?? ''); continue; }
                const value = cell?.value;
                line.push(value instanceof SheetDate ? formatDate(fromDayNumber(value.days)) : value instanceof SheetError ? value.code : toText(value));
            }
            rows.push(line);
        }
        return toDelimited(rows, ',') + '\n';
    }

    // Reads CSV into the sheet at a cell, as one undo step
    fromCSV(text, at = 'A1') {
        const start = parseAddress(at);
        const rows = parseDelimited(text.replace(/\r?\n$/, ''), ',');
        const needed = start.row + rows.length;
        if (needed > this.#rows) { this.#rows = needed; }
        const width = Math.max(0, ...rows.map(line => line.length));
        if (start.col + width > this.#columns) { this.#columns = start.col + width; }
        const changes = [];
        rows.forEach((line, i) => line.forEach((input, j) => changes.push({row: start.row + i, col: start.col + j, input})));
        this.setCells(changes);
    }

    toJSON() {
        const cells = {};
        for (const [key, cell] of this.#cells) {
            const item = {input: cell.input};
            if (cell.style) { item.style = cell.style; }
            if (cell.type) { item.type = cell.type; }
            cells[formatAddress(rowOf(key), colOf(key))] = item;
        }
        return {rows: this.#rows, columns: this.#columnInfo.length ? this.#columnInfo : this.#columns, columnCount: this.#columns, cells};
    }

    // Replaces all of the data. cells: {A1: '=B1' or {input, style, type}}, or rows: [['a', 1], ...].
    // A load is not an undo step.
    load({rows, columns, columnCount, cells = null, data = null} = {}) {
        if (Array.isArray(columns)) {
            this.#columnInfo = columns.map(info => ({...info}));
            this.#columns = Math.max(columns.length, columnCount ?? 0);
        } else if (typeof columns === 'number') {
            this.#columnInfo = [];
            this.#columns = columns;
        }
        if (typeof rows === 'number') { this.#rows = rows; }
        this.#cells.clear();
        this.#dependents.clear();
        this.#wideRanges = [];
        this.#undo = [];
        this.#redo = [];
        const lines = Array.isArray(rows) ? rows : data;
        if (lines) {
            this.#rows = Math.max(this.#rows, lines.length);
            lines.forEach((line, row) => line.forEach((input, col) => {
                if (input !== null && input !== undefined && input !== '') { this.#apply(keyOf(row, col), {input: String(input), style: null, type: null}); }
            }));
        }
        for (const [address, item] of Object.entries(cells ?? {})) {
            const value = typeof item === 'object' && item !== null ? item : {input: item};
            this.#apply(this.#key(address), {input: String(value.input ?? ''), style: value.style ?? null, type: value.type ?? null});
        }
        const all = new Set(this.#cells.keys());
        this.#recalculate(all, new Set());
        this.#send({changes: [], keys: new Set(), loaded: true});
    }
}

// Text with a delimiter. A value with the delimiter, a quote, or a line break goes in quotes.
export function toDelimited(rows, delimiter) {
    const quote = (value) => (/["\n\r]/.test(value) || value.includes(delimiter) ? `"${value.replaceAll('"', '""')}"` : value);
    return rows.map(line => line.map(value => quote(String(value ?? ''))).join(delimiter)).join('\n');
}

export function parseDelimited(text, delimiter) {
    const rows = [[]];
    let value = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
            else if (char === '"') { quoted = false; }
            else { value += char; }
        } else if (char === '"' && value === '') {
            quoted = true;
        } else if (char === delimiter) {
            rows.at(-1).push(value);
            value = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[i + 1] === '\n') { i++; }
            rows.at(-1).push(value);
            value = '';
            rows.push([]);
        } else {
            value += char;
        }
    }
    rows.at(-1).push(value);
    return rows;
}

export { formatAddress, formatRange, parseAddress, parseRange, normalizeRange };
