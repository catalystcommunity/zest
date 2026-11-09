import { BaseComponent, defineElements, observeResize, tagFor, tokenAliases, visuallyHidden } from "@catalystcommunity/base-components";
import { Action, ShortcutMap } from "@catalystcommunity/actions";
import { formatDate, fromDayNumber } from "@catalystcommunity/date-model";
import { SheetModel, readInput, TYPES, parseDelimited, toDelimited } from "./model.js";
import {
    SheetDate, SheetError, FUNCTIONS, MAX_ROWS, MAX_COLUMNS, columnName, columnIndex, evaluate, formatAddress, formatRange,
    normalizeRange, parseAddress, parseFormula, parseRange, references, shiftFormula, adjustForInsertDelete, tokenize,
} from "./formula.js";

// The design is in the README. In short: SheetModel holds the data, with no DOM. SpreadSheet shows a
// model as a grid of SheetCell elements. It makes only the cells that the user can see, and gives
// them new rows and columns when the user scrolls. FormulaBar shows and changes the active cell.

const gridCss = `
spread-sheet, :host {
    display: block;
    min-width: 0;
}
.zest-cell {
    display: block;
}
.zest-sheet {
    ${tokenAliases('spread-sheet')}
    --_grid-height: var(--zest-spread-sheet-height, 24em);
    --_header-face: var(--zest-spread-sheet-header-face, var(--_face));
    --_header-text: var(--zest-spread-sheet-header-text, var(--_face-text));
    --_range-face: var(--zest-spread-sheet-face-selected, color-mix(in srgb, var(--_highlight) 16%, transparent));
    --_header-selected: var(--zest-spread-sheet-header-face-selected, color-mix(in srgb, var(--_highlight) 22%, var(--_face)));
    display: flex;
    flex-direction: column;
    gap: var(--_gap);
    min-width: 0;
    color: var(--_window-text);
}
.zest-sheet .zest-viewport {
    position: relative;
    box-sizing: border-box;
    height: var(--_grid-height);
    max-height: 100%;
    min-height: 8em;
    overflow: auto;
    overflow-anchor: none;
    background: var(--_field);
    color: var(--_field-text);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    outline: none;
    overscroll-behavior: contain;
    touch-action: pan-x pan-y;
}
.zest-sheet .zest-viewport:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
.zest-sheet .zest-sizer {
    position: relative;
    isolation: isolate;
}
.zest-sheet .zest-head-row, .zest-sheet .zest-row {
    position: absolute;
    left: 0;
    height: var(--_row-px);
}
.zest-sheet .zest-head-row {
    position: sticky;
    top: 0;
    z-index: 3;
}
.zest-sheet .zest-head, .zest-sheet .zest-row-head, .zest-sheet .zest-corner {
    position: absolute;
    top: 0;
    box-sizing: border-box;
    height: var(--_row-px);
    line-height: calc(var(--_row-px) - 1px);
    overflow: hidden;
    background: var(--_header-face);
    color: var(--_header-text);
    border-inline-end: var(--_border-width) solid var(--_line);
    border-block-end: var(--_border-width) solid var(--_line);
    text-align: center;
    white-space: nowrap;
    font-size: 0.875em;
    user-select: none;
    cursor: default;
}
.zest-sheet .zest-head {
    overflow: visible;
}
.zest-sheet .zest-corner, .zest-sheet .zest-row-head {
    position: sticky;
    left: 0;
    z-index: 2;
    width: var(--_head-px);
}
.zest-sheet .zest-corner {
    z-index: 4;
    border-color: var(--_border);
}
.zest-sheet .zest-head.zest-in-range, .zest-sheet .zest-row-head.zest-in-range {
    background: var(--_header-selected);
    font-weight: bold;
    text-decoration: underline;
}
.zest-sheet .zest-resize {
    position: absolute;
    top: 0;
    right: -12px;
    z-index: 1;
    width: 24px;
    height: 100%;
    cursor: col-resize;
    touch-action: none;
}
.zest-sheet .zest-resize::after {
    content: '';
    position: absolute;
    left: 11px;
    top: 20%;
    bottom: 20%;
    width: 2px;
}
.zest-sheet .zest-resize:hover::after, .zest-sheet .zest-resize.zest-active::after {
    background: var(--_highlight);
}
.zest-sheet .zest-row .zest-cell {
    position: absolute;
    top: 0;
    box-sizing: border-box;
    height: var(--_row-px);
    line-height: calc(var(--_row-px) - 1px);
    padding: 0 0.3em;
    overflow: hidden;
    white-space: pre;
    text-overflow: clip;
    overflow-wrap: normal;
    border-inline-end: var(--_border-width) solid var(--_line);
    border-block-end: var(--_border-width) solid var(--_line);
    cursor: cell;
}
.zest-sheet .zest-row .zest-cell.zest-editing {
    z-index: 2;
    overflow: visible;
}
.zest-sheet .zest-selection, .zest-sheet .zest-active {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    pointer-events: none;
}
.zest-sheet .zest-selection {
    background: var(--_range-face);
    border: var(--_border-width) solid var(--_highlight);
}
.zest-sheet .zest-active {
    border: var(--_focus-width) solid var(--_highlight);
}
.zest-sheet .zest-viewport:not(:focus-within) .zest-active {
    border-style: dashed;
}
.zest-sheet [hidden] {
    display: none !important;
}
.zest-sheet .zest-live {
    ${visuallyHidden}
}
.zest-sheet.zest-readonly .zest-viewport {
    background: color-mix(in srgb, var(--_field) 92%, var(--_face));
}

@media (forced-colors: active) {
    .zest-sheet .zest-selection { background: transparent; border: 2px solid Highlight; }
    .zest-sheet .zest-active { border-color: Highlight; }
    .zest-sheet .zest-head.zest-in-range, .zest-sheet .zest-row-head.zest-in-range { background: Highlight; color: HighlightText; }
}
`;

// The look of a cell. A SpreadSheet includes it; a SheetCell that stands alone adds it.
const cellCss = `.zest-sheet-cell {
    ${tokenAliases('sheet-cell')}
}
.zest-cell.zest-number, .zest-cell.zest-currency, .zest-cell.zest-percent, .zest-cell.zest-date {
    text-align: end;
    font-variant-numeric: tabular-nums;
}
.zest-cell.zest-boolean, .zest-cell.zest-error {
    text-align: center;
}
.zest-cell.zest-error {
    color: var(--_invalid);
    font-weight: bold;
}
.zest-cell.zest-bold {
    font-weight: bold;
}
.zest-cell.zest-italic {
    font-style: italic;
}
.zest-cell.zest-align-start { text-align: start; }
.zest-cell.zest-align-center { text-align: center; }
.zest-cell.zest-align-end { text-align: end; }
.zest-cell.zest-editing {
    z-index: 2;
    overflow: visible;
}
.zest-cell .zest-editor {
    position: absolute;
    inset: -1px;
    box-sizing: border-box;
    min-width: calc(100% + 2px);
    min-height: calc(100% + 2px);
    margin: 0;
    padding: 0 0.3em;
    font: inherit;
    line-height: inherit;
    text-align: start;
    white-space: pre;
    overflow: hidden;
    resize: none;
    background: var(--_field);
    color: var(--_field-text);
    border: var(--_focus-width) solid var(--_highlight);
    border-radius: 0;
    outline: none;
    box-shadow: 0 0.125em 0.5em color-mix(in srgb, CanvasText 25%, transparent);
}
.zest-cell:not(.zest-in-sheet) {
    min-height: 1.75em;
    line-height: 1.75em;
    padding: 0 0.3em;
    position: relative;
    border: var(--_border-width) solid var(--_line);
    background: var(--_field);
    color: var(--_field-text);
    white-space: pre;
    overflow: hidden;
}
.zest-cell:not(.zest-in-sheet):focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}

`;

const barCss = `.zest-formula-bar {
    ${tokenAliases('formula-bar')}
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: var(--_gap);
    min-width: 0;
}
.zest-formula-bar input {
    box-sizing: border-box;
    min-height: var(--_height);
    min-width: 0;
    padding: var(--_padding-block) calc(var(--_padding-inline) / 2);
    font: inherit;
    background: var(--_field);
    color: var(--_field-text);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
}
.zest-formula-bar input:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
.zest-formula-bar input[aria-invalid="true"] {
    border-color: var(--_invalid);
    border-width: 2px;
}
.zest-formula-bar .zest-name {
    flex: 0 1 7em;
    width: 7em;
    font-variant-numeric: tabular-nums;
}
.zest-formula-bar .zest-formula {
    flex: 1 1 12em;
    font-family: ui-monospace, monospace;
}
.zest-formula-bar .zest-fx {
    align-self: center;
    font-style: italic;
    font-weight: bold;
    color: var(--_secondary-text);
}
`;

// One model formats a value for a SheetCell that is not in a sheet
const looseFormatter = new SheetModel({rows: 1, columns: 1});

// One cell: it shows a typed value, and it becomes an editor. A SpreadSheet makes and reuses many
// of them. A SheetCell can also stand alone, with the input and type attributes.
class SheetCell extends BaseComponent {
    static styles = cellCss;
    static properties = {
        input: {type: String, default: ''},
        cellType: {type: String, default: 'auto', attribute: 'type'},
        editable: {type: Boolean},
    };
    #shown = {display: null, className: null};
    #editor = null;

    constructor() {
        super();
        this.template = '';
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.classList.contains('zest-in-sheet')) { return; }
        // A cell that stands alone shows its own input, and can take the keyboard
        this.applyStyles();
        this.classList.add('zest-sheet-cell');
        if (!this.hasAttribute('role')) { this.setAttribute('role', this.editable ? 'textbox' : 'note'); }
        if (this.editable && !this.hasAttribute('tabindex')) { this.tabIndex = 0; }
        this.listen(this, 'dblclick', () => this.#startOwnEdit());
        this.listen(this, 'keydown', (e) => this.#onOwnKey(e));
        this.render();
    }

    // The sheet calls this. It changes the DOM only when the text or the classes change.
    show(cell) {
        if (this.#editor) { return; }
        const display = cell.display;
        const parts = [cell.error ? 'zest-error' : `zest-${cell.type}`];
        if (cell.style?.bold) { parts.push('zest-bold'); }
        if (cell.style?.italic) { parts.push('zest-italic'); }
        if (cell.style?.align) { parts.push(`zest-align-${cell.style.align}`); }
        const className = `zest-in-sheet zest-cell ${parts.join(' ')}`;
        if (this.#shown.display !== display) {
            this.textContent = display;
            this.#shown.display = display;
        }
        if (this.#shown.className !== className) {
            this.className = className;
            this.#shown.className = className;
        }
    }

    get editing() { return Boolean(this.#editor); }
    get editor() { return this.#editor; }

    // Puts an editor in the cell. caret: 'end' puts the caret after the text.
    startEdit(text, {caret = 'end', label = ''} = {}) {
        if (this.#editor) { return this.#editor; }
        const editor = document.createElement('textarea');
        editor.className = 'zest-editor';
        editor.rows = 1;
        // No soft wrap, so that the editor grows to the right with the text, as in other spreadsheets
        editor.wrap = 'off';
        editor.spellcheck = false;
        editor.setAttribute('aria-label', label || 'Cell input');
        editor.value = text;
        this.#shown.display = null;
        this.textContent = '';
        this.classList.add('zest-editing');
        this.append(editor);
        this.#editor = editor;
        const grow = () => {
            editor.style.width = '';
            editor.style.height = '';
            editor.style.width = `${Math.max(editor.scrollWidth + 4, this.offsetWidth + 2)}px`;
            editor.style.height = `${Math.max(editor.scrollHeight, this.offsetHeight + 2)}px`;
        };
        editor.addEventListener('input', grow);
        editor.focus({preventScroll: true});
        const at = caret === 'end' ? text.length : 0;
        editor.setSelectionRange(caret === 'select' ? 0 : at, text.length === 0 ? 0 : (caret === 'select' ? text.length : at));
        grow();
        return editor;
    }

    // Removes the editor and gives its text
    endEdit() {
        const editor = this.#editor;
        if (!editor) { return null; }
        this.#editor = null;
        editor.remove();
        this.classList.remove('zest-editing');
        return editor.value;
    }

    render() {
        if (this.classList.contains('zest-in-sheet') || this.#editor) { return; }
        const read = readInput(this.input, this.cellType);
        const type = this.cellType !== 'auto' ? this.cellType : (read.type ?? 'auto');
        const value = read.formula ? evaluate(read.formula, {value: () => null, values: () => []}) : read.value;
        const display = looseFormatter.format(value, type, read.symbol ? {currency: {'$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY'}[read.symbol]} : null);
        this.textContent = display;
        this.className = `zest-sheet-cell zest-cell ${value instanceof SheetError ? 'zest-error' : `zest-${type}`}`;
        if (this.editable) { this.setAttribute('aria-label', display || 'Blank'); }
    }

    #startOwnEdit() {
        if (!this.editable || this.#editor) { return; }
        this.removeAttribute('aria-label');
        this.startEdit(this.input);
    }

    #onOwnKey(e) {
        if (!this.editable) { return; }
        if (!this.#editor) {
            if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); this.#startOwnEdit(); }
            return;
        }
        if (e.key === 'Escape' || (e.key === 'Enter' && !e.altKey && !e.shiftKey)) {
            e.preventDefault();
            const text = this.endEdit();
            if (e.key === 'Enter' && text !== this.input) {
                this.input = text;
                this.emit('change', {input: text});
            }
            this.render();
            this.focus();
        }
    }
}

// The name of the active cell, and its input. It can be a part of a SpreadSheet, or it can stand
// next to one: <formula-bar for="sheet-id">.
class FormulaBar extends BaseComponent {
    static styles = barCss;
    static properties = {
        for: {type: String, render: false},
    };
    #sheet = null;
    #unwatch = null;
    #built = null;

    constructor() {
        super();
        this.template = '';
    }

    get sheet() {
        return this.#sheet ?? (this.for ? this.getRootNode().getElementById?.(this.for) ?? document.getElementById(this.for) : null);
    }
    set sheet(element) {
        this.#sheet = element;
        if (this.isConnected) { this.#watch(); }
    }

    connectedCallback() {
        super.connectedCallback();
        this.applyStyles();
        if (!this.#built) { this.#build(); }
        this.#watch();
        this.own(() => { this.#unwatch?.(); this.#unwatch = null; });
    }

    propertyChanged(name) {
        if (name === 'for' && this.isConnected) { this.#watch(); }
    }

    #watch() {
        this.#unwatch?.();
        this.#unwatch = null;
        const sheet = this.sheet;
        if (sheet?.watch) { this.#unwatch = sheet.watch((reason, text) => this.update(reason, text)); }
        this.update();
    }

    #build() {
        const wrapper = document.createElement('div');
        wrapper.className = 'zest-formula-bar';
        wrapper.setAttribute('part', 'formula-bar');
        wrapper.innerHTML = `<input class="zest-name" aria-label="Cell address" autocomplete="off" spellcheck="false">`
            + `<span class="zest-fx" aria-hidden="true">fx</span>`
            + `<input class="zest-formula" aria-label="Cell input" autocomplete="off" spellcheck="false">`;
        this.replaceChildren(wrapper);
        const [name, formula] = wrapper.querySelectorAll('input');
        this.#built = {name, formula};
        name.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const range = parseRange(name.value);
                if (!range || !this.sheet) { name.setAttribute('aria-invalid', 'true'); return; }
                name.removeAttribute('aria-invalid');
                this.sheet.selectByUser(range);
                this.sheet.focus();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.update();
                this.sheet?.focus();
            }
        });
        name.addEventListener('input', () => name.removeAttribute('aria-invalid'));
        formula.addEventListener('keydown', (e) => {
            if (!this.sheet) { return; }
            if (e.key === 'Enter' && !e.altKey) {
                e.preventDefault();
                this.sheet.writeByUser(this.sheet.activeAddress, formula.value);
                this.sheet.focus();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.update();
                this.sheet.focus();
            }
        });
    }

    // Shows the active cell of the sheet. While the user edits a cell, it shows the text of the editor.
    update(reason = 'select', text = null) {
        if (!this.#built) { return; }
        const sheet = this.sheet;
        const {name, formula} = this.#built;
        const disabled = !sheet;
        name.disabled = disabled;
        formula.disabled = disabled || Boolean(sheet?.readOnly);
        if (!sheet) { return; }
        const range = sheet.selection;
        if (document.activeElement !== name && this.getRootNode().activeElement !== name) {
            name.value = range.top === range.bottom && range.left === range.right ? sheet.activeAddress : `${sheet.activeAddress} (${formatRange(range)})`;
        }
        if (reason === 'edit') { formula.value = text; return; }
        if (this.getRootNode().activeElement !== formula) {
            formula.value = sheet.model.getInput(sheet.activeAddress);
        }
        formula.setAttribute('aria-label', `Input of cell ${sheet.activeAddress}`);
    }
}

const NAV = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]};
const isMacPlatform = () => /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');

let sheetCount = 0;

// A grid of cells with formulas, as in a spreadsheet program. It shows a SheetModel.
class SpreadSheet extends BaseComponent {
    static styles = gridCss + cellCss;
    static renderTiming = 'frame';
    static properties = {
        rows: {type: Number, default: 100, render: false},
        columns: {type: Number, default: 26, render: false},
        readOnly: {type: Boolean, attribute: 'readonly'},
        formulaBar: {type: Boolean, attribute: 'formula-bar'},
        locale: {type: String, render: false},
        label: {type: String, default: 'Spreadsheet'},
    };

    // The commands of the sheet. A menu or a toolbar can use the same actions.
    actions;
    #model = null;
    #modelListener = (e) => this.#onModelChange(e);
    #built = null;
    #pool = [];
    #headPool = [];
    #poolSize = {rows: 0, cols: 0};
    #anchor = {row: 0, col: 0};
    #focus = {row: 0, col: 0};
    #edit = null;
    #lefts = [0];
    #widths = new Map();
    #rowPx = 28;
    #headPx = 56;
    #defaultWidth = 104;
    #dirty = null;
    #all = true;
    #watchers = new Set();
    #shortcuts;
    #user = 0;
    #clip = null;
    #cut = null;
    #drag = null;
    #announceTimer = null;
    #id = `zest-sheet-${++sheetCount}`;

    constructor() {
        super();
        this.template = '';
        this.#makeActions();
    }

    // ---------- Data ----------

    get model() {
        if (!this.#model) { this.model = new SheetModel({rows: this.rows, columns: this.columns, locale: this.locale}); }
        return this.#model;
    }
    // Two sheets can show one model
    set model(model) {
        if (this.#model === model) { return; }
        this.#model?.removeEventListener('change', this.#modelListener);
        this.#model = model;
        if (this.isConnected) { model.addEventListener('change', this.#modelListener); }
        this.#clampSelection();
        this.#layoutColumns();
        this.#all = true;
        this.#updateActions();
        this.invalidate();
    }

    propertyChanged(name, oldValue, value) {
        if (!this.#model) { return; }
        if (name === 'rows' || name === 'columns') {
            const json = this.#model.toJSON();
            this.#model.load({...json, rows: this.rows, columns: Array.isArray(json.columns) ? json.columns : this.columns, columnCount: this.columns});
        }
        if (name === 'locale') {
            this.#model.locale = value;
            this.#all = true;
        }
    }

    getCell(where, col) { return this.model.getCell(where, col); }
    getValue(where, col) { return this.model.getValue(where, col); }
    setCell(where, input) { this.model.setCell(where, input); }
    setCells(changes) { this.model.setCells(changes); }
    load(data) { this.model.load(data); }
    toJSON() { return this.model.toJSON(); }
    toCSV(options) { return this.model.toCSV(options); }
    fromCSV(text, at) { this.model.fromCSV(text, at); }
    insertRows(index, count) { this.model.insertRows(index, count); }
    deleteRows(index, count) { this.model.deleteRows(index, count); }
    insertColumns(index, count) { this.model.insertColumns(index, count); }
    deleteColumns(index, count) { this.model.deleteColumns(index, count); }
    undo() { return this.model.undo(); }
    redo() { return this.model.redo(); }

    // The selected range: {top, left, bottom, right}. Set it with a range, or with text such as 'B2:C4'.
    get selection() {
        return normalizeRange({top: this.#anchor.row, left: this.#anchor.col, bottom: this.#focus.row, right: this.#focus.col});
    }
    set selection(value) {
        const range = typeof value === 'string' ? parseRange(value) : normalizeRange(value);
        if (!range) { throw new Error(`Not a range: ${value}`); }
        this.#select({row: range.top, col: range.left}, {row: range.bottom, col: range.right});
    }
    get activeAddress() { return formatAddress(this.#anchor.row, this.#anchor.col); }
    get editing() { return Boolean(this.#edit); }

    // Calls back after each selection change, each model change, and each change of the editor text.
    // FormulaBar uses this. Returns the removal function.
    watch(callback) {
        this.#watchers.add(callback);
        return () => this.#watchers.delete(callback);
    }

    #tell(reason, text = null) {
        for (const callback of this.#watchers) { callback(reason, text); }
    }

    // A change that the user made, from a part of the sheet or a formula bar. It sends events.
    writeByUser(address, input) {
        if (this.readOnly) { return; }
        this.#asUser(() => this.model.setCell(address, input));
    }
    selectByUser(range) {
        this.#asUser(() => this.#select({row: range.top, col: range.left}, {row: range.bottom, col: range.right}));
    }

    focus(options) {
        this.#built?.viewport.focus({preventScroll: true, ...options});
    }

    #asUser(fn) {
        this.#user++;
        try { return fn(); } finally { this.#user--; }
    }

    // ---------- Actions ----------

    #makeActions() {
        const run = (fn) => ({source} = {}) => this.#asUser(() => fn(source));
        const editing = () => !this.readOnly;
        const make = (id, label, shortcut, fn, extra = {}) => new Action({id, label, shortcut, run: run(fn), ...extra});
        this.actions = {
            undo: make('undo', 'Undo', 'Mod+Z', () => { if (editing()) { this.model.undo(); } }, {enabled: false}),
            redo: make('redo', 'Redo', 'Mod+Y', () => { if (editing()) { this.model.redo(); } }, {enabled: false}),
            cut: make('cut', 'Cut', 'Mod+X', () => this.#copy(true)),
            copy: make('copy', 'Copy', 'Mod+C', () => this.#copy(false)),
            paste: make('paste', 'Paste', 'Mod+V', () => this.#pasteFromSystem()),
            clear: make('clear', 'Clear contents', 'Delete', () => { if (editing()) { this.model.clear(this.selection); } }),
            fillDown: make('fillDown', 'Fill down', 'Mod+D', () => { if (editing()) { this.model.fill(this.selection, 'down'); } }),
            fillRight: make('fillRight', 'Fill right', 'Mod+R', () => { if (editing()) { this.model.fill(this.selection, 'right'); } }),
            bold: make('bold', 'Bold', 'Mod+B', () => this.#toggleStyle('bold'), {checkable: true}),
            italic: make('italic', 'Italic', 'Mod+I', () => this.#toggleStyle('italic'), {checkable: true}),
            today: make('today', 'Insert today', 'Mod+;', () => this.#insertToday()),
            selectAll: make('selectAll', 'Select all', 'Mod+A', () => this.#select({row: 0, col: 0}, {row: this.model.rowCount - 1, col: this.model.columnCount - 1})),
            insertRow: make('insertRow', 'Insert row', null, () => { if (editing()) { this.model.insertRows(this.selection.top, this.selection.bottom - this.selection.top + 1); } }),
            deleteRow: make('deleteRow', 'Delete row', null, () => { if (editing()) { this.model.deleteRows(this.selection.top, this.selection.bottom - this.selection.top + 1); this.#clampSelection(); } }),
            insertColumn: make('insertColumn', 'Insert column', null, () => { if (editing()) { this.model.insertColumns(this.selection.left, this.selection.right - this.selection.left + 1); } }),
            deleteColumn: make('deleteColumn', 'Delete column', null, () => { if (editing()) { this.model.deleteColumns(this.selection.left, this.selection.right - this.selection.left + 1); this.#clampSelection(); } }),
        };
        // A checkable action changes its checked state before it runs. The style decides it, so set it back.
        for (const id of ['bold', 'italic']) {
            this.actions[id].addEventListener('trigger', () => queueMicrotask(() => this.#updateActions()));
        }
        // Copy, cut, and paste go through the clipboard events of the browser, so they are not in the map
        const keys = Object.values(this.actions).filter(action => !['cut', 'copy', 'paste'].includes(action.id));
        keys.push(new Action({id: 'redoShift', shortcut: 'Mod+Shift+Z', run: () => this.actions.redo.trigger()}));
        keys.push(new Action({id: 'clearBack', shortcut: 'Backspace', run: () => this.actions.clear.trigger()}));
        this.#shortcuts = new ShortcutMap(keys, {ignoreInFields: false});
    }

    #updateActions() {
        if (!this.#model) { return; }
        const writable = !this.readOnly;
        const {undo, redo, bold, italic} = this.actions;
        undo.enabled = writable && this.#model.canUndo;
        redo.enabled = writable && this.#model.canRedo;
        for (const id of ['cut', 'paste', 'clear', 'fillDown', 'fillRight', 'bold', 'italic', 'today', 'insertRow', 'deleteRow', 'insertColumn', 'deleteColumn']) {
            this.actions[id].enabled = writable;
        }
        const style = this.#model.getCell(this.#anchor.row, this.#anchor.col).style ?? {};
        bold.checked = Boolean(style.bold);
        italic.checked = Boolean(style.italic);
    }

    #toggleStyle(name) {
        if (this.readOnly) { return; }
        const on = !this.model.getCell(this.#anchor.row, this.#anchor.col).style?.[name];
        this.model.setStyle(this.selection, {[name]: on || null});
        this.#updateActions();
    }

    #insertToday() {
        if (this.readOnly) { return; }
        const now = new Date();
        const text = formatDate({year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate()});
        if (this.#edit) {
            this.#edit.editor.setRangeText(text, this.#edit.editor.selectionStart, this.#edit.editor.selectionEnd, 'end');
            return;
        }
        this.model.setCell(this.activeAddress, text);
    }

    // ---------- Lifecycle ----------

    connectedCallback() {
        super.connectedCallback();
        if (!this.#built) { this.#build(); }
        this.applyStyles(this.#built.wrapper);
        this.model.addEventListener('change', this.#modelListener);
        this.own(() => this.#model?.removeEventListener('change', this.#modelListener));
        const {viewport} = this.#built;
        this.listen(viewport, 'scroll', () => this.#onScroll(), {passive: true});
        this.listen(viewport, 'keydown', (e) => this.#onKeydown(e));
        this.listen(viewport, 'pointerdown', (e) => this.#onPointerDown(e));
        this.listen(viewport, 'pointermove', (e) => this.#onPointerMove(e));
        this.listen(viewport, 'pointerup', (e) => this.#onPointerUp(e));
        this.listen(viewport, 'pointercancel', (e) => this.#onPointerUp(e));
        this.listen(viewport, 'dblclick', (e) => this.#onDoubleClick(e));
        // The browser sends a clipboard event to the body when the focused element is not a text
        // field, so the sheet listens on the document and checks that its grid has the focus
        this.listen(document, 'copy', (e) => this.#onClipboard(e, 'copy'));
        this.listen(document, 'cut', (e) => this.#onClipboard(e, 'cut'));
        this.listen(document, 'paste', (e) => this.#onPaste(e));
        this.listen(viewport, 'input', (e) => { if (this.#edit && e.target === this.#edit.editor) { this.#tell('edit', e.target.value); } });
        this.own(observeResize(viewport, () => this.invalidate()));
        this.own(() => clearTimeout(this.#announceTimer));
        this.#measure();
        this.#layoutColumns();
        this.#updateActions();
        this.#all = true;
        this.render();
    }

    #build() {
        const wrapper = document.createElement('div');
        wrapper.className = 'zest-sheet';
        wrapper.setAttribute('part', 'sheet');
        const viewport = document.createElement('div');
        viewport.className = 'zest-viewport';
        viewport.setAttribute('part', 'grid');
        viewport.setAttribute('role', 'grid');
        viewport.setAttribute('aria-multiselectable', 'true');
        viewport.tabIndex = 0;
        const sizer = document.createElement('div');
        sizer.className = 'zest-sizer';
        sizer.setAttribute('role', 'presentation');
        const headRow = document.createElement('div');
        headRow.className = 'zest-head-row';
        headRow.setAttribute('role', 'row');
        headRow.setAttribute('aria-rowindex', '1');
        const corner = document.createElement('div');
        corner.className = 'zest-corner';
        corner.setAttribute('role', 'columnheader');
        corner.setAttribute('aria-colindex', '1');
        corner.dataset.kind = 'corner';
        headRow.append(corner);
        const selection = document.createElement('div');
        selection.className = 'zest-selection';
        selection.setAttribute('aria-hidden', 'true');
        const active = document.createElement('div');
        active.className = 'zest-active';
        active.setAttribute('aria-hidden', 'true');
        sizer.append(headRow, selection, active);
        viewport.append(sizer);
        const live = document.createElement('div');
        live.className = 'zest-live';
        live.setAttribute('aria-live', 'polite');
        wrapper.append(viewport, live);
        this.root.replaceChildren(wrapper);
        this.#built = {wrapper, viewport, sizer, headRow, selection, active, live, bar: null};
    }

    #measure() {
        const size = parseFloat(getComputedStyle(this.#built.viewport).fontSize) || 16;
        this.#rowPx = Math.max(24, Math.round(size * 1.75));
        this.#defaultWidth = Math.round(size * 6.5);
        const digits = String(this.model.rowCount).length;
        this.#headPx = Math.round(size * Math.max(3, digits * 0.62 + 1.4));
        this.#built.wrapper.style.setProperty('--_row-px', `${this.#rowPx}px`);
        this.#built.wrapper.style.setProperty('--_head-px', `${this.#headPx}px`);
    }

    widthOf(col) {
        return this.#widths.get(col) ?? this.model.column(col).width ?? this.#defaultWidth;
    }

    // Sets the width of a column in CSS pixels
    setColumnWidth(col, width) {
        const value = Math.max(24, Math.round(width));
        this.#widths.delete(col);
        this.model.setColumn(col, {width: value});
    }

    #layoutColumns() {
        if (!this.#built) { return; }
        const count = this.model.columnCount;
        const lefts = new Float64Array(count + 1);
        for (let col = 0; col < count; col++) { lefts[col + 1] = lefts[col] + this.widthOf(col); }
        this.#lefts = lefts;
        this.#all = true;
    }

    // The first index whose left edge is after x
    #columnAt(x) {
        const lefts = this.#lefts;
        let low = 0;
        let high = lefts.length - 2;
        while (low < high) {
            const middle = (low + high + 1) >> 1;
            if (lefts[middle] <= x) { low = middle; } else { high = middle - 1; }
        }
        return Math.max(0, low);
    }

    // ---------- Render ----------

    #onScroll() {
        if (this.#edit && !this.#isVisible(this.#edit.row, this.#edit.col)) {
            // The cell element of the editor goes to another row, so the edit ends first
            this.#asUser(() => this.#commitEdit());
        }
        this.invalidate();
    }

    #window() {
        const {viewport} = this.#built;
        const height = viewport.clientHeight || 400;
        const width = viewport.clientWidth || 800;
        const rows = this.model.rowCount;
        const top = viewport.scrollTop;
        const left = viewport.scrollLeft;
        const r0 = Math.min(rows - 1, Math.max(0, Math.floor(top / this.#rowPx)));
        const r1 = Math.min(rows - 1, Math.floor((top + height) / this.#rowPx));
        const c0 = this.#columnAt(left);
        const c1 = Math.min(this.model.columnCount - 1, this.#columnAt(left + width - this.#headPx));
        return {r0, r1, c0, c1, height, width};
    }

    #isVisible(row, col) {
        const view = this.#window();
        return row >= view.r0 && row <= view.r1 && col >= view.c0 && col <= view.c1;
    }

    render() {
        if (!this.#built) { return; }
        const model = this.model;
        const {wrapper, viewport, sizer, headRow, selection: selectionBox, active: activeBox} = this.#built;
        wrapper.classList.toggle('zest-readonly', this.readOnly);
        this.#formulaBar();
        const rowCount = model.rowCount;
        const colCount = model.columnCount;
        if (this.#lefts.length !== colCount + 1) { this.#layoutColumns(); }
        const totalWidth = this.#headPx + this.#lefts[colCount];
        sizer.style.width = `${totalWidth}px`;
        sizer.style.height = `${this.#rowPx * (rowCount + 1)}px`;
        headRow.style.width = `${totalWidth}px`;
        viewport.setAttribute('aria-rowcount', rowCount + 1);
        viewport.setAttribute('aria-colcount', colCount + 1);
        viewport.setAttribute('aria-label', this.label);
        viewport.setAttribute('aria-readonly', String(this.readOnly));

        const view = this.#window();
        // Enough elements for each row and column that can show at the same time, and one more
        const neededRows = Math.min(rowCount, Math.ceil(view.height / this.#rowPx) + 2);
        let neededCols = 1;
        for (let left = viewport.scrollLeft, col = view.c0; col < colCount && this.#lefts[col] < left + view.width; col++) { neededCols = col - view.c0 + 2; }
        neededCols = Math.min(colCount, Math.max(neededCols, this.#poolSize.cols));
        if (neededRows !== this.#poolSize.rows || neededCols !== this.#poolSize.cols) { this.#makePool(neededRows, neededCols); }

        const selection = this.selection;
        const all = this.#all;
        const dirty = this.#dirty;
        this.#all = false;
        this.#dirty = null;
        const cellTag = tagFor(SheetCell, 'sheet-cell');
        const C = this.#poolSize.cols;
        const R = this.#poolSize.rows;

        // Column headers
        for (let col = view.c0; col <= view.c1; col++) {
            const head = this.#headPool[col % C];
            const inRange = col >= selection.left && col <= selection.right;
            if (all || head.col !== col) {
                head.col = col;
                head.element.hidden = false;
                head.element.style.left = `${this.#headPx + this.#lefts[col]}px`;
                head.element.style.width = `${this.widthOf(col)}px`;
                head.label.textContent = model.column(col).title ? `${columnName(col)} ${model.column(col).title}` : columnName(col);
                head.element.setAttribute('aria-colindex', col + 2);
                head.element.dataset.col = col;
                head.resize.dataset.col = col;
            }
            if (head.inRange !== inRange) {
                head.inRange = inRange;
                head.element.classList.toggle('zest-in-range', inRange);
            }
        }

        let activeId = null;
        for (let row = view.r0; row <= view.r1; row++) {
            const slot = this.#pool[row % R];
            const newRow = slot.row !== row;
            if (newRow) {
                slot.row = row;
                slot.element.hidden = false;
                slot.element.style.top = `${this.#rowPx * (row + 1)}px`;
                slot.element.setAttribute('aria-rowindex', row + 2);
                slot.head.textContent = row + 1;
            }
            if (newRow || all) { slot.element.style.width = `${totalWidth}px`; }
            const rowInRange = row >= selection.top && row <= selection.bottom;
            if (slot.inRange !== rowInRange) {
                slot.inRange = rowInRange;
                slot.head.classList.toggle('zest-in-range', rowInRange);
            }
            for (let col = view.c0; col <= view.c1; col++) {
                const q = col % C;
                const cell = slot.cells[q];
                const moved = newRow || slot.cols[q] !== col;
                if (moved || all) {
                    slot.cols[q] = col;
                    cell.hidden = false;
                    cell.style.left = `${this.#headPx + this.#lefts[col]}px`;
                    cell.style.width = `${this.widthOf(col)}px`;
                    cell.setAttribute('aria-colindex', col + 2);
                    cell.row = row;
                    cell.col = col;
                }
                if (moved || all || dirty?.has(row * MAX_COLUMNS + col)) {
                    if (!(this.#edit && this.#edit.cell === cell)) { cell.show(model.getCell(row, col)); }
                }
                const selected = rowInRange && col >= selection.left && col <= selection.right;
                if (cell.selected !== selected) {
                    cell.selected = selected;
                    cell.setAttribute('aria-selected', String(selected));
                }
                if (row === this.#anchor.row && col === this.#anchor.col) { activeId = cell.id; }
            }
        }
        if (activeId) {
            viewport.setAttribute('aria-activedescendant', activeId);
        } else {
            viewport.removeAttribute('aria-activedescendant');
        }

        // The rectangles of the selection and of the active cell
        const box = (element, range) => {
            element.hidden = false;
            element.style.left = `${this.#headPx + this.#lefts[range.left]}px`;
            element.style.top = `${this.#rowPx * (range.top + 1)}px`;
            element.style.width = `${this.#lefts[range.right + 1] - this.#lefts[range.left] + 1}px`;
            element.style.height = `${this.#rowPx * (range.bottom - range.top + 1) + 1}px`;
        };
        const single = selection.top === selection.bottom && selection.left === selection.right;
        if (single) { selectionBox.hidden = true; } else { box(selectionBox, selection); }
        box(activeBox, {top: this.#anchor.row, left: this.#anchor.col, bottom: this.#anchor.row, right: this.#anchor.col});
    }

    #makePool(rows, cols) {
        const {sizer, headRow} = this.#built;
        const cellTag = tagFor(SheetCell, 'sheet-cell');
        for (const slot of this.#pool) {
            if (this.#edit && slot.cells.includes(this.#edit.cell)) { this.#asUser(() => this.#commitEdit()); }
            slot.element.remove();
        }
        for (const head of this.#headPool) { head.element.remove(); }
        this.#pool = [];
        this.#headPool = [];
        for (let q = 0; q < cols; q++) {
            const element = document.createElement('div');
            element.className = 'zest-head';
            // A part of the pool is hidden until it gets a column, so that it does not cover a real one
            element.hidden = true;
            element.setAttribute('role', 'columnheader');
            element.dataset.kind = 'column';
            const label = document.createElement('span');
            const resize = document.createElement('div');
            resize.className = 'zest-resize';
            resize.dataset.kind = 'resize';
            resize.setAttribute('aria-hidden', 'true');
            element.append(label, resize);
            headRow.append(element);
            this.#headPool.push({element, label, resize, col: -1, inRange: null});
        }
        const fragment = document.createDocumentFragment();
        for (let p = 0; p < rows; p++) {
            const element = document.createElement('div');
            element.className = 'zest-row';
            element.hidden = true;
            element.setAttribute('role', 'row');
            const head = document.createElement('div');
            head.className = 'zest-row-head';
            head.setAttribute('role', 'rowheader');
            head.setAttribute('aria-colindex', '1');
            head.dataset.kind = 'row';
            element.append(head);
            const cells = [];
            for (let q = 0; q < cols; q++) {
                const cell = document.createElement(cellTag);
                cell.classList.add('zest-in-sheet');
                cell.hidden = true;
                cell.setAttribute('role', 'gridcell');
                cell.id = `${this.#id}-${p}-${q}`;
                cell.dataset.kind = 'cell';
                cells.push(cell);
                element.append(cell);
            }
            fragment.append(element);
            this.#pool.push({element, head, cells, row: -1, cols: new Int32Array(cols).fill(-1), inRange: null});
        }
        sizer.append(fragment);
        this.#poolSize = {rows, cols};
        this.#all = true;
    }

    #formulaBar() {
        const built = this.#built;
        if (this.formulaBar && !built.bar) {
            built.bar = document.createElement(tagFor(FormulaBar, 'formula-bar'));
            built.bar.sheet = this;
            built.wrapper.prepend(built.bar);
        } else if (!this.formulaBar && built.bar) {
            built.bar.remove();
            built.bar = null;
        }
    }

    // ---------- Changes ----------

    #onModelChange(e) {
        const detail = e.detail;
        if (detail.structure || detail.loaded || detail.columns) {
            this.#layoutColumns();
            this.#clampSelection();
            if (detail.loaded) { this.#measure(); }
            this.#all = true;
        } else if (detail.cells.size > 2000 || this.#all) {
            this.#all = true;
        } else {
            this.#dirty ??= new Set();
            for (const key of detail.cells) { this.#dirty.add(key); }
        }
        this.#updateActions();
        this.invalidate();
        this.#tell('change');
        if (this.#user && detail.changes.length) {
            this.emit('spreadsheet-change', {changes: detail.changes});
        }
    }

    #clampSelection() {
        if (!this.#model) { return; }
        const clamp = (point) => ({
            row: Math.max(0, Math.min(this.#model.rowCount - 1, point.row)),
            col: Math.max(0, Math.min(this.#model.columnCount - 1, point.col)),
        });
        this.#anchor = clamp(this.#anchor);
        this.#focus = clamp(this.#focus);
    }

    #select(anchor, focus = anchor, {reveal = true, announce = true} = {}) {
        const before = this.selection;
        const activeBefore = this.activeAddress;
        this.#anchor = anchor;
        this.#focus = focus;
        this.#clampSelection();
        if (reveal) { this.#reveal(this.#focus.row, this.#focus.col); }
        this.#updateActions();
        this.invalidate();
        const range = this.selection;
        const changed = formatRange(before) !== formatRange(range) || activeBefore !== this.activeAddress;
        if (!changed) { return; }
        this.#tell('select');
        if (announce) { this.#announceSelection(); }
        if (this.#user) {
            this.emit('spreadsheet-select', {range, address: formatRange(range), active: this.activeAddress});
        }
    }

    #reveal(row, col) {
        const {viewport} = this.#built ?? {};
        if (!viewport) { return; }
        const height = viewport.clientHeight || 400;
        const width = viewport.clientWidth || 800;
        const top = this.#rowPx * (row + 1);
        if (top < viewport.scrollTop + this.#rowPx) {
            viewport.scrollTop = top - this.#rowPx;
        } else if (top + this.#rowPx > viewport.scrollTop + height) {
            viewport.scrollTop = top + this.#rowPx - height;
        }
        const left = this.#headPx + this.#lefts[col];
        const right = left + this.widthOf(col);
        if (left < viewport.scrollLeft + this.#headPx) {
            viewport.scrollLeft = left - this.#headPx;
        } else if (right > viewport.scrollLeft + width) {
            viewport.scrollLeft = Math.min(left - this.#headPx, right - width);
        }
    }

    // The live region tells the cell after a short time, so that a held arrow key does not make a queue
    #announceSelection() {
        clearTimeout(this.#announceTimer);
        this.#announceTimer = setTimeout(() => {
            const range = this.selection;
            const cell = this.model.getCell(this.#anchor.row, this.#anchor.col);
            const size = (range.bottom - range.top + 1) * (range.right - range.left + 1);
            const content = cell.display || 'blank';
            const formula = cell.formula ? `, formula ${cell.input}` : '';
            this.#say(size > 1 ? `${formatRange(range)} selected, ${size} cells. ${cell.address} ${content}` : `${cell.address} ${content}${formula}`);
        }, 120);
    }

    #say(text) {
        if (!this.#built) { return; }
        this.#built.live.textContent = text;
    }

    // ---------- Keyboard ----------

    #onKeydown(e) {
        if (e.defaultPrevented) { return; }
        if (this.#edit) { this.#onEditKey(e); return; }
        if (e.isComposing) { return; }
        const mod = isMacPlatform() ? e.metaKey : e.ctrlKey;
        if (this.#asUser(() => this.#shortcuts.handle(e))) { return; }
        const nav = NAV[e.key];
        if (nav && !e.altKey) {
            e.preventDefault();
            let [dRow, dCol] = nav;
            if (getComputedStyle(this.#built.viewport).direction === 'rtl') { dCol = -dCol; }
            const from = e.shiftKey ? this.#focus : this.#anchor;
            const to = mod ? this.model.dataEdge(from.row, from.col, dRow, dCol) : {row: from.row + dRow, col: from.col + dCol};
            this.#move(to, e.shiftKey);
            return;
        }
        if (e.altKey && e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
            // The keyboard way to change the width of a column
            e.preventDefault();
            if (this.readOnly) { return; }
            const col = this.#anchor.col;
            this.#asUser(() => this.setColumnWidth(col, this.widthOf(col) + (e.key === 'ArrowRight' ? 16 : -16)));
            this.#say(`Column ${columnName(col)} width ${this.widthOf(col)} pixels`);
            return;
        }
        const page = Math.max(1, Math.floor(((this.#built.viewport.clientHeight || 400) - this.#rowPx) / this.#rowPx));
        const from = e.shiftKey ? this.#focus : this.#anchor;
        switch (e.key) {
            case 'Home':
                e.preventDefault();
                this.#move(mod ? {row: 0, col: 0} : {row: from.row, col: 0}, e.shiftKey);
                return;
            case 'End': {
                e.preventDefault();
                const used = this.model.usedRange;
                if (mod) {
                    this.#move({row: Math.max(0, used.bottom), col: Math.max(0, used.right)}, e.shiftKey);
                } else {
                    let col = this.model.columnCount - 1;
                    while (col > 0 && this.model.isEmpty(from.row, col)) { col--; }
                    this.#move({row: from.row, col}, e.shiftKey);
                }
                return;
            }
            case 'PageDown':
            case 'PageUp':
                e.preventDefault();
                this.#move({row: from.row + (e.key === 'PageDown' ? page : -page), col: from.col}, e.shiftKey);
                return;
            case 'Tab':
                if (e.ctrlKey || e.metaKey || e.altKey) { return; }
                // At the first or the last column, Tab leaves the grid as with any other control
                if ((e.shiftKey && this.#anchor.col === 0) || (!e.shiftKey && this.#anchor.col === this.model.columnCount - 1)) { return; }
                e.preventDefault();
                this.#move({row: this.#anchor.row, col: this.#anchor.col + (e.shiftKey ? -1 : 1)}, false);
                return;
            case 'Enter':
                if (e.altKey) { return; }
                e.preventDefault();
                if (mod) { this.#startEdit('edit'); return; }
                this.#move({row: this.#anchor.row + (e.shiftKey ? -1 : 1), col: this.#anchor.col}, false);
                return;
            case 'F2':
                e.preventDefault();
                this.#startEdit('edit');
                return;
            case ' ':
                if (e.shiftKey && !mod) {
                    e.preventDefault();
                    this.#asUser(() => this.#select({row: from.row, col: 0}, {row: from.row, col: this.model.columnCount - 1}, {reveal: false}));
                    return;
                }
                if (mod && !e.shiftKey) {
                    e.preventDefault();
                    this.#asUser(() => this.#select({row: 0, col: from.col}, {row: this.model.rowCount - 1, col: from.col}, {reveal: false}));
                    return;
                }
                break;
            case 'Escape':
                if (this.#cut) {
                    e.preventDefault();
                    this.#cut = null;
                    this.#say('The cut stopped');
                }
                return;
            case 'Process':
            case 'Unidentified':
                // An input method starts. The editor gets the focus now, and the composed text goes into it.
                this.#startEdit('enter', '', {keepKey: true});
                return;
        }
        // A character starts an edit, and the character replaces the content of the cell
        if (e.key.length === 1 && (!e.ctrlKey && !e.metaKey || (e.ctrlKey && e.altKey)) ) {
            e.preventDefault();
            this.#startEdit('enter', e.key);
        }
    }

    #move(to, extend) {
        const target = {
            row: Math.max(0, Math.min(this.model.rowCount - 1, to.row)),
            col: Math.max(0, Math.min(this.model.columnCount - 1, to.col)),
        };
        this.#asUser(() => (extend ? this.#select(this.#anchor, target) : this.#select(target, target)));
    }

    // ---------- Editing ----------

    #cellElement(row, col) {
        const R = this.#poolSize.rows;
        const C = this.#poolSize.cols;
        if (!R || !C) { return null; }
        const slot = this.#pool[row % R];
        if (slot.row !== row || slot.cols[col % C] !== col) { return null; }
        return slot.cells[col % C];
    }

    // mode 'enter': started by typing, so an arrow key ends the edit. mode 'edit': the arrow keys move the caret.
    #startEdit(mode, text = null, {keepKey = false} = {}) {
        if (this.readOnly) { this.#say('The sheet is read only'); return; }
        const {row, col} = this.#anchor;
        this.#reveal(row, col);
        // The cell element must exist now, so render the visible window first
        this.render();
        const cell = this.#cellElement(row, col);
        if (!cell) { return; }
        const original = this.model.getInput(row, col);
        const address = formatAddress(row, col);
        const editor = cell.startEdit(text ?? original, {caret: 'end', label: `Edit ${address}`});
        this.#edit = {row, col, cell, editor, mode, original};
        this.#say(`Editing ${address}`);
        this.#tell('edit', editor.value);
        if (keepKey) { editor.value = ''; }
    }

    #onEditKey(e) {
        const edit = this.#edit;
        if (e.target !== edit.editor) { return; }
        if (e.isComposing) { return; }
        const mod = isMacPlatform() ? e.metaKey : e.ctrlKey;
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                this.#cancelEdit();
                return;
            case 'Enter':
                e.preventDefault();
                if (e.altKey) {
                    edit.editor.setRangeText('\n', edit.editor.selectionStart, edit.editor.selectionEnd, 'end');
                    edit.editor.dispatchEvent(new Event('input', {bubbles: true}));
                    return;
                }
                if (mod) {
                    // Ctrl+Enter puts the text in each cell of the selection
                    this.#asUser(() => this.#commitEdit({fillSelection: true}));
                    return;
                }
                this.#asUser(() => {
                    this.#commitEdit();
                    this.#move({row: this.#anchor.row + (e.shiftKey ? -1 : 1), col: this.#anchor.col}, false);
                });
                return;
            case 'Tab':
                e.preventDefault();
                this.#asUser(() => {
                    this.#commitEdit();
                    this.#move({row: this.#anchor.row, col: this.#anchor.col + (e.shiftKey ? -1 : 1)}, false);
                });
                return;
            case 'F2':
                e.preventDefault();
                edit.mode = edit.mode === 'enter' ? 'edit' : 'enter';
                this.#say(edit.mode === 'edit' ? 'Edit mode: the arrow keys move in the text' : 'Enter mode: the arrow keys go to another cell');
                return;
        }
        if (NAV[e.key] && edit.mode === 'enter' && !e.shiftKey && !e.altKey && !mod) {
            e.preventDefault();
            const [dRow, dCol] = NAV[e.key];
            this.#asUser(() => {
                this.#commitEdit();
                this.#move({row: this.#anchor.row + dRow, col: this.#anchor.col + dCol}, false);
            });
            return;
        }
        if (mod && e.key === ';') {
            e.preventDefault();
            this.#insertToday();
        }
    }

    #commitEdit({fillSelection = false} = {}) {
        const edit = this.#edit;
        if (!edit) { return; }
        this.#edit = null;
        const text = edit.cell.endEdit();
        const address = formatAddress(edit.row, edit.col);
        if (fillSelection) {
            const range = this.selection;
            const changes = [];
            for (let row = range.top; row <= range.bottom; row++) {
                for (let col = range.left; col <= range.right; col++) {
                    const input = text.startsWith('=') ? '=' + shiftFormula(text.slice(1), row - edit.row, col - edit.col) : text;
                    changes.push({row, col, input});
                }
            }
            this.model.setCells(changes);
        } else if (text !== edit.original) {
            this.model.setCell(address, text);
        }
        edit.cell.show(this.model.getCell(edit.row, edit.col));
        this.#built.viewport.focus({preventScroll: true});
        this.#tell('select');
        this.invalidate();
    }

    #cancelEdit() {
        const edit = this.#edit;
        if (!edit) { return; }
        this.#edit = null;
        edit.cell.endEdit();
        edit.cell.show(this.model.getCell(edit.row, edit.col));
        this.#built.viewport.focus({preventScroll: true});
        this.#say(`Edit of ${formatAddress(edit.row, edit.col)} canceled`);
        this.#tell('select');
    }

    // ---------- Pointer ----------

    // The cell under a point of the window
    #cellAtPoint(x, y) {
        const rect = this.#built.viewport.getBoundingClientRect();
        const viewport = this.#built.viewport;
        const innerX = x - rect.left - viewport.clientLeft + viewport.scrollLeft - this.#headPx;
        const innerY = y - rect.top - viewport.clientTop + viewport.scrollTop - this.#rowPx;
        return {
            row: Math.max(0, Math.min(this.model.rowCount - 1, Math.floor(innerY / this.#rowPx))),
            col: Math.max(0, Math.min(this.model.columnCount - 1, this.#columnAt(innerX))),
        };
    }

    #onPointerDown(e) {
        if (e.button !== 0) { return; }
        const target = e.target.closest?.('[data-kind]');
        if (!target || (this.#edit && this.#edit.editor === e.target)) { return; }
        if (this.#edit) { this.#asUser(() => this.#commitEdit()); }
        const kind = target.dataset.kind;
        const lastRow = this.model.rowCount - 1;
        const lastCol = this.model.columnCount - 1;
        if (kind === 'resize') {
            if (this.readOnly) { return; }
            e.preventDefault();
            const col = Number(target.dataset.col);
            this.#drag = {kind: 'resize', col, startX: e.clientX, startWidth: this.widthOf(col), handle: target, pointer: e.pointerId};
            target.classList.add('zest-active');
            this.#built.viewport.setPointerCapture?.(e.pointerId);
            return;
        }
        e.preventDefault();
        this.focus();
        if (kind === 'corner') {
            this.#asUser(() => this.#select({row: 0, col: 0}, {row: lastRow, col: lastCol}, {reveal: false}));
            return;
        }
        const point = this.#cellAtPoint(e.clientX, e.clientY);
        if (kind === 'column') {
            const col = Number(target.dataset.col);
            if (e.shiftKey) {
                this.#asUser(() => this.#select({row: 0, col: this.#anchor.col}, {row: lastRow, col}, {reveal: false}));
            } else {
                this.#asUser(() => this.#select({row: 0, col}, {row: lastRow, col}, {reveal: false}));
            }
            this.#drag = {kind: 'column', start: col, pointer: e.pointerId, moved: false};
        } else if (kind === 'row') {
            if (e.shiftKey) {
                this.#asUser(() => this.#select({row: this.#anchor.row, col: 0}, {row: point.row, col: lastCol}, {reveal: false}));
            } else {
                this.#asUser(() => this.#select({row: point.row, col: 0}, {row: point.row, col: lastCol}, {reveal: false}));
            }
            this.#drag = {kind: 'row', start: point.row, pointer: e.pointerId, moved: false};
        } else {
            if (e.shiftKey) {
                this.#asUser(() => this.#select(this.#anchor, point, {reveal: false}));
            } else {
                this.#asUser(() => this.#select(point, point, {reveal: false}));
            }
            this.#drag = {kind: 'cell', pointer: e.pointerId, moved: false};
        }
    }

    #onPointerMove(e) {
        const drag = this.#drag;
        if (!drag || drag.pointer !== e.pointerId) { return; }
        if (drag.kind === 'resize') {
            const width = Math.max(24, drag.startWidth + (e.clientX - drag.startX));
            // A preview while the pointer moves; the model gets the width at the end
            this.#widths.set(drag.col, width);
            this.#layoutColumns();
            this.invalidate();
            return;
        }
        if (!drag.moved) {
            drag.moved = true;
            this.#built.viewport.setPointerCapture?.(e.pointerId);
        }
        const point = this.#cellAtPoint(e.clientX, e.clientY);
        const lastRow = this.model.rowCount - 1;
        const lastCol = this.model.columnCount - 1;
        this.#asUser(() => {
            if (drag.kind === 'cell') { this.#select(this.#anchor, point, {reveal: false}); }
            if (drag.kind === 'column') { this.#select({row: 0, col: drag.start}, {row: lastRow, col: point.col}, {reveal: false}); }
            if (drag.kind === 'row') { this.#select({row: drag.start, col: 0}, {row: point.row, col: lastCol}, {reveal: false}); }
        });
    }

    #onPointerUp(e) {
        const drag = this.#drag;
        if (!drag || drag.pointer !== e.pointerId) { return; }
        this.#drag = null;
        if (drag.kind === 'resize') {
            drag.handle.classList.remove('zest-active');
            const width = this.#widths.get(drag.col);
            if (width !== undefined) {
                this.#asUser(() => this.setColumnWidth(drag.col, width));
                this.#say(`Column ${columnName(drag.col)} width ${this.widthOf(drag.col)} pixels`);
            }
        }
    }

    #onDoubleClick(e) {
        const target = e.target.closest?.('[data-kind="cell"]');
        if (!target || this.#edit) { return; }
        e.preventDefault();
        this.#asUser(() => this.#select({row: target.row, col: target.col}, undefined, {reveal: false}));
        this.#startEdit('edit');
    }

    // ---------- Clipboard ----------

    #copy(cut) {
        const clip = this.model.copy(this.selection);
        this.#clip = clip;
        this.#cut = cut ? this.selection : null;
        navigator.clipboard?.writeText?.(clip.text).catch(() => {});
        this.#say(`${cut ? 'Cut' : 'Copied'} ${formatRange(this.selection)}`);
        return clip;
    }

    async #pasteFromSystem() {
        if (this.readOnly) { return; }
        let text = null;
        try { text = await navigator.clipboard?.readText?.(); } catch { text = null; }
        this.#asUser(() => this.#paste(text ?? this.#clip?.text ?? ''));
    }

    #hasClipboardFocus(e) {
        const viewport = this.#built.viewport;
        return !this.#edit && !e.defaultPrevented && (e.composedPath()[0] === viewport || viewport.matches(':focus'));
    }

    #onClipboard(e, kind) {
        if (!this.#hasClipboardFocus(e)) { return; }
        if (kind === 'cut' && this.readOnly) { return; }
        e.preventDefault();
        const clip = this.#asUser(() => this.#copy(kind === 'cut'));
        e.clipboardData?.setData('text/plain', clip.text);
    }

    #onPaste(e) {
        if (!this.#hasClipboardFocus(e)) { return; }
        e.preventDefault();
        if (this.readOnly) { return; }
        const text = e.clipboardData?.getData('text/plain') ?? '';
        this.#asUser(() => this.#paste(text));
    }

    // The copy of this sheet keeps its formulas. Text from another program becomes inputs.
    #paste(text) {
        const target = this.selection;
        const own = this.#clip && (text === this.#clip.text || text === '');
        let pasted;
        this.model.batch(() => {
            pasted = own ? this.model.paste(target, this.#clip) : this.model.pasteText(target, text);
            if (own && this.#cut) {
                // A paste after a cut moves the cells: the cut cells outside the new place become empty
                const cut = this.#cut;
                const changes = [];
                for (let row = cut.top; row <= cut.bottom; row++) {
                    for (let col = cut.left; col <= cut.right; col++) {
                        const inside = row >= pasted.top && row <= pasted.bottom && col >= pasted.left && col <= pasted.right;
                        if (!inside) { changes.push({row, col, input: '', style: null}); }
                    }
                }
                this.model.setCells(changes);
                this.#cut = null;
                this.#clip = null;
            }
        });
        if (pasted) {
            this.#select({row: pasted.top, col: pasted.left}, {row: pasted.bottom, col: pasted.right});
            this.#say(`Pasted to ${formatRange(pasted)}`);
        }
    }
}

class ShadowSpreadSheet extends SpreadSheet {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}

// The names of helpers start with "sheet" or "cell", so that they do not meet a name of another package
// Defines the default tags of the spreadsheet that have no tag yet. Importing defines nothing.
function defineSpreadsheet() {
    defineElements({'spread-sheet': SpreadSheet, 'shadow-spread-sheet': ShadowSpreadSheet, 'sheet-cell': SheetCell, 'formula-bar': FormulaBar});
}

export {
    defineSpreadsheet,
    SpreadSheet, ShadowSpreadSheet, SheetCell, FormulaBar, SheetModel, SheetDate, SheetError,
    readInput as readCellInput, TYPES as SHEET_TYPES, FUNCTIONS as SHEET_FUNCTIONS,
    MAX_ROWS as SHEET_MAX_ROWS, MAX_COLUMNS as SHEET_MAX_COLUMNS,
    parseDelimited as parseDelimitedText, toDelimited as toDelimitedText,
    columnName as sheetColumnName, columnIndex as sheetColumnIndex,
    formatAddress as formatCellAddress, parseAddress as parseCellAddress,
    formatRange as formatCellRange, parseRange as parseCellRange, normalizeRange as normalizeCellRange,
    evaluate as evaluateFormula, parseFormula, references as formulaReferences, shiftFormula,
    adjustForInsertDelete as adjustFormulaReferences, tokenize as tokenizeFormula,
};
