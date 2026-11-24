// The data of a sheet, with no DOM. A cell has the input that the user typed, an optional type, a
// value, and a style. A formula cell recalculates when a cell that it reads changes. Only the cells
// that depend on a change recalculate, in an order where each cell comes after the cells that it reads.
import { dateFormat, numberFormat, dayNumber, fromDayNumber, formatDate } from "@catalystcommunity/date-model";
import {
    MAX_COLUMNS, SheetDate, SheetError, adjustForInsertDelete, evaluate, formatAddress, formatRange, normalizeRange,
    parseAddress, parseFormula, parseRange, references, rewriteFormula, shiftFormula, toText, moveTreeReferences,
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

// The sheet type that shows the value of a validator from @catalystcommunity/validators
const VALIDATOR_TYPES = {int: 'number', uint: 'number', float: 'number', decimal: 'number', bool: 'boolean', date: 'date', text: 'text', uuid: 'text', bytes: 'text', timestamp: 'text', enum: 'auto', any: 'auto'};

// The options for a list editor, as [{value, label}] or null.
function normalizeOptions(list) {
    if (!list) { return null; }
    return list.map(item => (typeof item === 'object' && item !== null ? {value: item.value, label: String(item.label ?? item.value)} : {value: item, label: String(item)}));
}
export function columnOptions(info, options) {
    return normalizeOptions(options ?? info?.options ?? info?.validate?.options);
}

// The label of each option value, made one time for each list
const optionLabels = new WeakMap();
function labelMap(list) {
    if (!list) { return null; }
    let map = optionLabels.get(list);
    if (!map) {
        map = new Map(normalizeOptions(list).map(item => [String(item.value), item.label]));
        optionLabels.set(list, map);
    }
    return map;
}

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

// Record cells, formulas and undo steps all use this map from old to new coordinates.
export function recordColumnLayout(model, list, keepDrafts) {
    const columns = list.length ? [...list] : [{}];
    const visible = columns.length;
    const byKey = new Map();
    columns.forEach(({key}, col) => { if (key != null) { byKey.set(key, col); } });
    const mapping = Array.from({length: model.recordColumnCount}, (_, col) => {
        const old = model.column(col);
        if (old.key == null) { return col < visible && columns[col].key == null ? col : -1; }
        if (byKey.has(old.key)) { return byKey.get(old.key); }
        if (!keepDrafts) { return -1; }
        return columns.push({...old}) - 1;
    });
    if (columns.length > MAX_COLUMNS) {
        throw new RangeError(`A record grid can hold at most ${MAX_COLUMNS} visible and hidden columns.`);
    }
    const move = ref => mapping[ref.col] >= 0 ? {...ref, col: mapping[ref.col]} : null;
    const rewrite = text => text.startsWith('=') ? '=' + rewriteFormula(text.slice(1), {move}) : text;
    // Visible column formulas come from the new view. Hidden definitions use the old view.
    for (let col = visible; col < columns.length; col++) {
        const info = columns[col];
        if (info.formula) { info.formula = rewrite('=' + String(info.formula).replace(/^=/, '')); }
    }
    return {columns, visible, mapping, rewrite};
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
    #hiddenColumns = 0;
    // The settings of a row: {locked}, by row
    #rowInfo = new Map();
    // What is not data and not an undo step, by the key of the cell: {locked, mark}. A mark is
    // {invalid: true, message} from a validation. Both move with the cell when rows or columns move.
    #notes = new Map();
    // A guard for a change by the user: {mode: 'probe' or 'skip', locked(row, col), hits: [keys]}
    #guard = null;

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
    get recordColumnCount() { return this.#columns + this.#hiddenColumns; }
    get canUndo() { return this.#undo.length > 0; }
    get canRedo() { return this.#redo.length > 0; }
    get cellCount() { return this.#cells.size; }

    column(col) { return this.#columnInfo[col] ?? {}; }
    row(row) { return this.#rowInfo.get(row) ?? {}; }

    // Changes the settings of a row, for example {locked: true}. It is not an undo step.
    setRow(row, changes) {
        const next = {...this.row(row), ...changes};
        for (const [name, value] of Object.entries(next)) { if (value === null || value === undefined) { delete next[name]; } }
        if (Object.keys(next).length) { this.#rowInfo.set(row, next); } else { this.#rowInfo.delete(row); }
        const keys = new Set();
        for (let col = 0; col < this.#columns; col++) { keys.add(keyOf(row, col)); }
        this.#send({changes: [], keys, rows: [row]});
    }

    // ---------- Locks and marks ----------

    // A cell is locked by its own setting, then by its row, then by its column. Locks stop the user,
    // not code: the sheet element checks them for each change that the user makes.
    isLocked(row, col) {
        const own = this.#notes.get(keyOf(row, col))?.locked;
        if (own === true || own === false) { return own; }
        const byRow = this.#rowInfo.get(row)?.locked;
        if (byRow === true || byRow === false) { return byRow; }
        return Boolean(this.column(col).locked);
    }

    // Locks (true), unlocks (false), or clears the setting (null) of each cell of a range. It is not an undo step.
    setLocked(range, locked) {
        this.#setNotes(range, 'locked', locked === null || locked === undefined ? null : Boolean(locked));
    }

    // A mark on a cell, such as {invalid: true, message}. It is not an undo step, and it is not data.
    getMark(row, col) { return this.#notes.get(keyOf(row, col))?.mark ?? null; }
    setMark(row, col, mark) { this.setMarks([{row, col, mark}]); }

    // [{row, col, mark}], with one change event
    setMarks(list) {
        const keys = new Set();
        for (const {row, col, mark} of list) {
            const key = keyOf(row, col);
            const old = this.#notes.get(key)?.mark ?? null;
            if (JSON.stringify(old) === JSON.stringify(mark ?? null)) { continue; }
            this.#note(key, 'mark', mark ?? null);
            keys.add(key);
        }
        if (keys.size) { this.#send({changes: [], keys, marks: true}); }
    }

    #setNotes(range, name, value) {
        const area = typeof range === 'string' ? parseRange(range) : normalizeRange(range);
        const keys = new Set();
        for (let row = area.top; row <= area.bottom; row++) {
            for (let col = area.left; col <= area.right; col++) {
                const key = keyOf(row, col);
                this.#note(key, name, value);
                keys.add(key);
            }
        }
        this.#send({changes: [], keys});
    }

    #note(key, name, value) {
        const note = {...(this.#notes.get(key) ?? {})};
        if (value === null) { delete note[name]; } else { note[name] = value; }
        if (Object.keys(note).length) { this.#notes.set(key, note); } else { this.#notes.delete(key); }
    }

    // Runs fn with a guard for each cell that it changes. In 'probe' mode nothing changes, and
    // the guard collects the keys of the locked cells that fn would change. In 'skip' mode the
    // locked cells do not change, and the other cells do.
    withGuard(guard, fn) {
        const old = this.#guard;
        this.#guard = guard;
        try {
            return fn();
        } finally {
            this.#guard = old;
        }
    }

    // The cells that the next undo (or redo) changes: [{row, col}], or null for a change of rows or columns
    historyCells(side = 'undo') {
        const entry = (side === 'undo' ? this.#undo : this.#redo).at(-1);
        if (!entry) { return []; }
        if (entry.structure) { return null; }
        return entry.cells.map(change => ({row: rowOf(change.key), col: colOf(change.key)}));
    }

    // Replaces the settings of all columns: [{key, title, type, validate, options, locked, width}].
    // The number of columns becomes the length of the list. The cells stay.
    setColumns(list) {
        if (this.#hiddenColumns) {
            // The positional model API starts a regular grid with its visible cells.
            const columns = list.length ? list : [{}];
            const mapping = Array.from({length: this.#columns}, (_, col) => col < columns.length ? col : -1);
            this.setRecordColumns({columns, visible: columns.length, mapping, rewrite: text => text});
            return;
        }
        this.#columnInfo = list.map(info => ({...info}));
        this.#columns = Math.max(1, list.length);
        for (const cell of this.#cells.values()) { if (!cell.formula) { this.#read(cell); } }
        const keys = new Set(this.#cells.keys());
        this.#recalculate(keys, keys);
        this.#send({changes: [], keys, columns: list.map((_, col) => col)});
    }

    // A record view can move a field, or keep it after the visible columns while a row
    // has edits. Move the cell, its references, its locks and its history together.
    setRecordColumns({columns, visible, mapping, rewrite}, loadInputs) {
        const moveKey = key => {
            const col = mapping[colOf(key)];
            return col === undefined || col < 0 ? -1 : keyOf(rowOf(key), col);
        };
        const snapshot = (cell, col) => {
            const copy = snapshotOf(cell);
            if (copy.input.startsWith('=') && (copy.type ?? this.columnType(col)) !== 'text') {
                copy.input = rewrite(copy.input);
            }
            return copy;
        };
        const cells = new Map();
        for (const [key, cell] of this.#cells) {
            const next = moveKey(key);
            if (next >= 0) { cells.set(next, snapshot(cell, colOf(key))); }
        }
        const notes = new Map();
        for (const [key, note] of this.#notes) {
            const next = moveKey(key);
            if (next >= 0) { notes.set(next, note); }
        }
        const rebase = stack => stack.flatMap(entry => {
            if (entry.structure) { return []; }
            const changes = [];
            for (const change of entry.cells) {
                const key = moveKey(change.key);
                if (key < 0) { continue; }
                const col = colOf(change.key);
                changes.push({key, before: snapshot(change.before, col), after: snapshot(change.after, col)});
            }
            return changes.length ? [{cells: changes}] : [];
        });
        this.#undo = rebase(this.#undo);
        this.#redo = rebase(this.#redo);
        this.#notes = notes;
        this.#columnInfo = columns.map(info => ({...info}));
        this.#columns = visible;
        this.#hiddenColumns = columns.length - visible;
        this.#cells.clear();
        this.#dependents.clear();
        this.#wideRanges = [];
        for (const [key, cell] of cells) { this.#apply(key, cell); }
        // Populate the new view before listeners can read a row or submit it.
        if (loadInputs) {
            for (const {row, col, input} of loadInputs()) {
                const key = keyOf(row, col);
                this.#apply(key, {...snapshotOf(this.#cells.get(key)), input});
            }
        }
        const keys = new Set(this.#cells.keys());
        this.#recalculate(keys, keys);
        this.#send({changes: [], keys, columns: columns.map((_, col) => col)});
    }

    // Changes the type, the format, the title, or the width of a column, and shows each cell again
    setColumn(col, changes) {
        this.#columnInfo[col] = {...this.column(col), ...changes};
        const keys = new Set();
        for (const [key, cell] of this.#cells) {
            if (colOf(key) === col) {
                if (('type' in changes || 'validate' in changes) && !cell.formula) { this.#read(cell); }
                keys.add(key);
            }
        }
        if ('type' in changes || 'validate' in changes) { this.#recalculate(keys, keys); }
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
    getCell(where, col, options) {
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
            display: this.format(value, type, cell, column, options),
            style: cell?.style ?? null,
            error: value instanceof SheetError ? value : null,
            mark: this.#notes.get(key)?.mark ?? null,
        };
    }

    getValue(where, col) {
        return this.#cells.get(this.#key(where, col))?.value ?? null;
    }

    getInput(where, col) {
        return this.#cells.get(this.#key(where, col))?.input ?? '';
    }

    // The type of a column: its type, or the type that its validator gives
    columnType(col) {
        const info = this.column(col);
        return info.type ?? (info.validate?.kind ? VALIDATOR_TYPES[info.validate.kind] : undefined);
    }

    // The type that shows the value: the type of the cell, then the column, then what the input showed
    typeAt(row, col) {
        const cell = this.#cells.get(keyOf(row, col));
        const set = cell?.type ?? this.columnType(col);
        if (set && set !== 'auto') { return set; }
        if (cell?.value instanceof SheetDate) { return 'date'; }
        return cell?.shown ?? (cell?.value === null || cell?.value === undefined ? 'auto' : typeof cell.value === 'boolean' ? 'boolean' : typeof cell.value === 'number' ? 'number' : 'text');
    }

    // The text that a cell shows
    format(value, type, cell = null, col = cell ? colOf(cell.key) : -1, options) {
        if (value === null || value === undefined) { return ''; }
        if (value instanceof SheetError) { return value.code; }
        const column = this.column(col);
        if (cell && !cell.formula) {
            // A rule can change its list in place before the application calls refresh().
            const key = String(value);
            const label = options
                ? normalizeOptions(options).find(item => String(item.value) === key)?.label
                : labelMap(column.options ?? column.validate?.options)?.get(key);
            if (label !== undefined) { return label; }
        }
        const info = {...column, ...(cell?.format ?? {})};
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

    // [{row, col, input}] or [{address, input}], also with style or type. With history: false, the
    // change is not an undo step, for example data from a server.
    setCells(changes, {history = true} = {}) {
        if (!history) {
            if (this.#batch) { throw new Error('setCells with history: false cannot be in a batch'); }
            this.#batch = {changes: new Map(), keys: new Set(), history: false};
            try {
                for (const change of changes) { this.#writeChange(change); }
            } finally {
                const batch = this.#batch;
                this.#batch = null;
                this.#finish(batch, false);
            }
            return;
        }
        this.batch(() => {
            for (const change of changes) { this.#writeChange(change); }
        });
    }

    #writeChange(change) {
        const key = change.address ? this.#key(change.address) : keyOf(change.row, change.col);
        const patch = {};
        if ('input' in change) { patch.input = String(change.input ?? ''); }
        if ('style' in change) { patch.style = change.style; }
        if ('type' in change) { patch.type = change.type; }
        this.#write(key, patch);
    }

    // Changes the number of rows, with no undo step. Cells in rows that go away are removed.
    setRowCount(count) {
        const rows = Math.max(1, count);
        if (rows === this.#rows) { return; }
        if (rows < this.#rows) {
            const mapping = new Int32Array(this.#rows);
            for (let row = 0; row < this.#rows; row++) { mapping[row] = row < rows ? row : -1; }
            this.remapRows(mapping, rows);
            return;
        }
        this.#rows = rows;
        this.#send({changes: [], keys: new Set(), structure: {axis: 'row', count: 0, resize: true}});
    }

    // Moves rows to new places, as one change that is not an undo step. mapping[oldRow] is the new
    // row, or -1 to remove the row. Each reference to a moved row follows it, and a reference to a
    // removed row becomes #REF!. The undo steps follow the rows too; a step of rows or columns
    // cannot follow them, so it goes away. Only the moved cells and the formulas that read them
    // change, so that new data at the end of a large sheet costs little.
    remapRows(mapping, rowCount = this.#rows) {
        const moveRow = (row) => (row < mapping.length ? mapping[row] : row);
        const moveRef = (ref) => {
            const row = moveRow(ref.row);
            return row < 0 ? null : (row === ref.row ? ref : {...ref, row});
        };
        const moveKey = (key) => {
            const row = rowOf(key);
            const to = moveRow(row);
            return to < 0 ? -1 : (to === row ? key : keyOf(to, colOf(key)));
        };
        const movedRows = new Set();
        for (let row = 0; row < mapping.length; row++) { if (mapping[row] !== row) { movedRows.add(row); } }
        // The cells move as objects: a cell keeps its parsed formula and its value, so that a move
        // of rows costs no new parse and no new calculation for most cells.
        // 1. The formulas that read a moved or removed row: their text changes
        const rewrite = [];
        if (movedRows.size) {
            for (const cell of this.#cells.values()) {
                if (!cell.formula) { continue; }
                const found = references(cell.formula);
                const reads = found.cells.some(ref => movedRows.has(ref.row))
                    || found.ranges.some(range => movedRows.has(range.top) || movedRows.has(range.bottom) || range.bottom - range.top >= 1);
                if (reads) { rewrite.push({cell, ranges: found.ranges.length > 0}); }
            }
        }
        // 2. The removed cells go. The cells that read them calculate again.
        const recalc = new Set();
        for (const [key, cell] of this.#cells) {
            if (moveKey(key) >= 0) { continue; }
            for (const dependent of this.#dependentsOf(key)) { recalc.add(dependent); }
            this.#unlink(cell);
        }
        // 3. New keys for the cells, the links, and the dependents
        const cells = new Map();
        for (const [key, cell] of this.#cells) {
            const to = moveKey(key);
            if (to < 0) { continue; }
            cell.key = to;
            if (cell.links) {
                const links = [];
                for (const link of cell.links) { const moved = moveKey(link); if (moved >= 0) { links.push(moved); } }
                cell.links = links;
            }
            cells.set(to, cell);
        }
        const dependents = new Map();
        for (const [key, set] of this.#dependents) {
            const to = moveKey(key);
            if (to < 0) { continue; }
            const moved = new Set();
            for (const dependent of set) { const next = moveKey(dependent); if (next >= 0) { moved.add(next); } }
            if (moved.size) { dependents.set(to, moved); }
        }
        this.#cells = cells;
        this.#dependents = dependents;
        this.#wideRanges = this.#wideRanges.flatMap(item => {
            const key = moveKey(item.key);
            return key < 0 ? [] : [{...item, key}];
        });
        const keyMoves = new Map();
        for (const key of recalc) { const to = moveKey(key); if (to >= 0) { keyMoves.set(key, to); } }
        recalc.clear();
        for (const to of keyMoves.values()) { recalc.add(to); }
        // 4. The new text of each formula that reads a moved row. A formula with a range links and
        // calculates again, because the rows in the range can be others now.
        for (const {cell, ranges} of rewrite) {
            if (cells.get(cell.key) !== cell) { continue; }
            const body = cell.input.slice(1);
            const text = moveTreeReferences(cell.formula, body, moveRef);
            if (text === null) {
                // A reference to a removed row becomes #REF!
                this.#unlink(cell);
                cell.input = '=' + rewriteFormula(body, {move: moveRef});
                this.#read(cell);
                if (cell.formula) { this.#link(cell); }
                recalc.add(cell.key);
            } else {
                cell.input = '=' + text;
                if (ranges) {
                    this.#unlink(cell);
                    this.#link(cell);
                    recalc.add(cell.key);
                }
            }
        }
        const notes = new Map();
        for (const [key, note] of this.#notes) {
            const row = moveRow(rowOf(key));
            if (row >= 0) { notes.set(keyOf(row, colOf(key)), note); }
        }
        this.#notes = notes;
        const rowInfo = new Map();
        for (const [row, info] of this.#rowInfo) {
            const target = moveRow(row);
            if (target >= 0) { rowInfo.set(target, info); }
        }
        this.#rowInfo = rowInfo;
        this.#rows = Math.max(1, rowCount);
        const rebase = (stack) => stack.flatMap(entry => {
            if (entry.structure) { return []; }
            const cells = entry.cells.flatMap(change => {
                const row = moveRow(rowOf(change.key));
                return row < 0 ? [] : [{...change, key: keyOf(row, colOf(change.key))}];
            });
            return cells.length ? [{cells}] : [];
        });
        this.#undo = rebase(this.#undo);
        this.#redo = rebase(this.#redo);
        this.#recalculate(recalc, new Set());
        this.#send({changes: [], keys: new Set(), structure: {axis: 'row', count: 0, remap: mapping}});
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
        const guard = this.#guard;
        if (guard) {
            const locked = guard.locked(rowOf(key), colOf(key));
            if (locked) { guard.hits.push(key); }
            if (locked || guard.mode === 'probe') { return; }
        }
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
        const set = cell.type ?? this.columnType(colOf(cell.key)) ?? 'auto';
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
        if (batch.history === false) { record = false; }
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
        const notes = new Map();
        for (const [key, note] of this.#notes) {
            const row = rowOf(key);
            const col = colOf(key);
            const at = axis === 'row' ? row : col;
            if (count < 0 && at >= index && at < removedEnd) { continue; }
            const shift = count > 0 ? (at >= index ? count : 0) : (at >= removedEnd ? count : 0);
            notes.set(axis === 'row' ? keyOf(row + shift, col) : keyOf(row, col + shift), note);
        }
        this.#notes = notes;
        if (axis === 'row' && this.#rowInfo.size) {
            const rows = new Map();
            for (const [row, info] of this.#rowInfo) {
                if (count < 0 && row >= index && row < removedEnd) { continue; }
                const shift = count > 0 ? (row >= index ? count : 0) : (row >= removedEnd ? count : 0);
                rows.set(row + shift, info);
            }
            this.#rowInfo = rows;
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
    copy(range, displayAt) {
        const area = typeof range === 'string' ? parseRange(range) : normalizeRange(range);
        const rows = [];
        for (let row = area.top; row <= area.bottom; row++) {
            const line = [];
            for (let col = area.left; col <= area.right; col++) {
                const cell = this.#cells.get(keyOf(row, col));
                line.push({...snapshotOf(cell), display: displayAt ? displayAt(row, col) : this.getCell(row, col).display});
            }
            rows.push(line);
        }
        return {range: area, rows, text: toDelimited(rows.map(line => line.map(item => item.display)), '\t')};
    }

    // Pastes a copy at a cell. Relative references move with the cells, as in other spreadsheets.
    // A copy of one cell fills all of a larger target range.
    // `mapInput(input, row, col, item)` can change each pasted input that is not a formula, for example
    // a label of an option to its value
    paste(target, clip, {mapInput = null} = {}) {
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
                const input = item.input.startsWith('=')
                    ? '=' + shiftFormula(item.input.slice(1), row - source.row, col - source.col)
                    : (mapInput ? mapInput(item.input, row, col, item) : item.input);
                changes.push({row, col, input, style: item.style, type: item.type});
            }
        }
        this.setCells(changes);
        return {top: at.top, left: at.left, bottom: Math.min(this.#rows - 1, at.top + repeatRows - 1), right: Math.min(this.#columns - 1, at.left + repeatCols - 1)};
    }

    // Pastes text from another program: tabs between cells, and lines between rows
    pasteText(target, text, options) {
        const rows = parseDelimited(text.replace(/\r?\n$/, ''), '\t');
        const at = typeof target === 'string' ? parseRange(target) : normalizeRange(target);
        return this.paste(at, {range: {top: at.top, left: at.left}, rows: rows.map(line => line.map(input => ({input, style: null, type: null})))}, options);
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
            if (this.#hiddenColumns && colOf(key) >= this.#columns) { continue; }
            if (!this.#cells.get(key).input) { continue; }
            bottom = Math.max(bottom, rowOf(key));
            right = Math.max(right, colOf(key));
        }
        return {top: 0, left: 0, bottom, right};
    }

    // Calls fn(row, col, input) for each cell with an input, in no order
    forEachCell(fn) {
        for (const [key, cell] of this.#cells) {
            if (this.#hiddenColumns && colOf(key) >= this.#columns) { continue; }
            if (cell.input) { fn(rowOf(key), colOf(key), cell.input); }
        }
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

    // Reads CSV into the sheet at a cell, as one undo step. `mapInput(input, row, col)` can change
    // each input, for example a number of a locale to the canonical form.
    fromCSV(text, at = 'A1', {delimiter = ',', mapInput = null} = {}) {
        const start = parseAddress(at);
        const rows = parseDelimited(text.replace(/\r?\n$/, ''), delimiter);
        const needed = start.row + rows.length;
        if (needed > this.#rows) { this.#rows = needed; }
        const width = Math.max(0, ...rows.map(line => line.length));
        const neededColumns = start.col + width;
        if (neededColumns > this.#columns) {
            if (this.#hiddenColumns) {
                const columns = Array.from({length: neededColumns}, (_, col) => col < this.#columns ? this.column(col) : {});
                this.setRecordColumns(recordColumnLayout(this, columns, true));
            } else {
                this.#columns = neededColumns;
            }
        }
        const changes = [];
        rows.forEach((line, i) => line.forEach((input, j) => {
            const row = start.row + i;
            const col = start.col + j;
            changes.push({row, col, input: mapInput ? mapInput(input, row, col) : input});
        }));
        this.setCells(changes);
    }

    toJSON() {
        const cells = {};
        for (const [key, cell] of this.#cells) {
            if (this.#hiddenColumns && colOf(key) >= this.#columns) { continue; }
            const item = {input: cell.input};
            if (cell.style) { item.style = cell.style; }
            if (cell.type) { item.type = cell.type; }
            cells[formatAddress(rowOf(key), colOf(key))] = item;
        }
        const columns = this.#hiddenColumns ? this.#columnInfo.slice(0, this.#columns) : this.#columnInfo;
        return {rows: this.#rows, columns: columns.length ? columns : this.#columns, columnCount: this.#columns, cells};
    }

    // Replaces all of the data. cells: {A1: '=B1' or {input, style, type}}, or rows: [['a', 1], ...].
    // A load is not an undo step.
    load({rows, columns, columnCount, cells = null, data = null} = {}) {
        if (this.#hiddenColumns) { this.#columnInfo.length = this.#columns; }
        this.#hiddenColumns = 0;
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
        this.#notes.clear();
        this.#rowInfo.clear();
        const lines = Array.isArray(rows) ? rows : data;
        if (lines) {
            this.#rows = Math.max(this.#rows, lines.length);
            lines.forEach((line, row) => line.forEach((input, col) => {
                if (input !== null && input !== undefined && input !== '') { this.#apply(keyOf(row, col), {input: String(input), style: null, type: null}); }
            }));
        }
        for (const [address, item] of Object.entries(cells ?? {})) {
            const value = typeof item === 'object' && item !== null ? item : {input: item};
            const key = this.#key(address);
            this.#apply(key, {input: String(value.input ?? ''), style: value.style ?? null, type: value.type ?? null});
            if (value.locked === true || value.locked === false) { this.#note(key, 'locked', value.locked); }
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
