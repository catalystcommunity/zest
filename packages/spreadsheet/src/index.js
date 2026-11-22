import { BaseComponent, createElementOf, defineElements, observeResize, placePopup, tagFor, tokenAliases, visuallyHidden } from "@catalystcommunity/base-components";
import { DateTimePicker } from "@catalystcommunity/date-time-picker";
import { Action, ShortcutMap } from "@catalystcommunity/actions";
import { attachTypeahead } from "@catalystcommunity/controls";
import { showNotice } from "@catalystcommunity/menus";
import { validators } from "@catalystcommunity/validators";
import { RecordRows } from "./records.js";
import { toCanonicalInput, toLocalInput, sheetLocale, textFormat, detectCsvFormat } from "./locale.js";
import { readClipboardTable } from "./clipboard.js";
import { formatDate, fromDayNumber } from "@catalystcommunity/date-model";
import { SheetModel, readInput, TYPES, parseDelimited, toDelimited, columnOptions } from "./model.js";
import {
    SheetDate, SheetError, FUNCTIONS, MAX_ROWS, MAX_COLUMNS, columnName, columnIndex, evaluate, formatAddress, formatRange,
    normalizeRange, parseAddress, parseFormula, parseRange, references, shiftFormula, adjustForInsertDelete, tokenize,
    referenceSpans, canInsertReference, cycleReference, functionNameAt, argumentAt, rewriteFormula,
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
.zest-sheet .zest-date-button {
    display: none;
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    width: 1.4em;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    cursor: pointer;
    background: var(--_highlight);
    color: var(--_highlight-text, Canvas);
    font-size: 0.8em;
}
.zest-sheet .zest-active.zest-has-date .zest-date-button {
    display: flex;
}
.zest-date-popup {
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    overflow: visible;
}
.zest-date-popup:not(:popover-open) {
    display: none;
}
.zest-sheet .zest-viewport:not(:focus-within) .zest-active {
    border-style: dashed;
}
.zest-sheet .zest-row-head .zest-state {
    margin-inline-start: 0.2em;
    font-weight: bold;
}
.zest-sheet .zest-row-head .zest-words, .zest-sheet .zest-help {
    ${visuallyHidden}
}
.zest-sheet .zest-row[data-state="error"] .zest-row-head, .zest-sheet .zest-row[data-state="conflict"] .zest-row-head {
    background: color-mix(in srgb, var(--_invalid) 18%, var(--_header-face));
    color: var(--_window-text);
}
.zest-sheet .zest-row[data-state="pending"] .zest-row-head, .zest-sheet .zest-row[data-state="sent"] .zest-row-head {
    color: var(--_secondary-text);
}
.zest-sheet .zest-row[data-state="pending"] .zest-cell {
    cursor: progress;
}
/* The editor has its own row, so that it stays when the rows of the pool move */
.zest-sheet .zest-editor-row {
    position: absolute;
    left: 0;
    width: 0;
    height: var(--_row-px);
    z-index: 2;
}
.zest-sheet .zest-editor-row .zest-editor-cell {
    position: absolute;
    top: 0;
    z-index: 2;
}
/* The references of the formula in the editor. A color for each reference, and the box of the
   reference that the arrow keys or the pointer move has a dashed line. */
.zest-sheet .zest-arg-hint {
    position: absolute;
    z-index: 6;
    padding: 0.1em 0.5em;
    border: var(--_border-width) solid var(--_line);
    border-radius: 3px;
    background: var(--zest-spread-sheet-hint-background, light-dark(#fffbe6, #2b2a20));
    color: inherit;
    font-size: 0.85em;
    white-space: nowrap;
    pointer-events: none;
}
.zest-sheet .zest-arg-hint[hidden] { display: none; }
.zest-sheet .zest-arg-hint b { font-weight: bold; }
.zest-sheet .zest-ref-box {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    pointer-events: none;
    border: 2px solid var(--_ref-color);
    background: color-mix(in srgb, var(--_ref-color) 10%, transparent);
}
.zest-sheet .zest-ref-box[data-color="0"] { --_ref-color: var(--zest-spread-sheet-reference-1, light-dark(#1f5fbf, #7fb0ff)); }
.zest-sheet .zest-ref-box[data-color="1"] { --_ref-color: var(--zest-spread-sheet-reference-2, light-dark(#b3261e, #ff8f87)); }
.zest-sheet .zest-ref-box[data-color="2"] { --_ref-color: var(--zest-spread-sheet-reference-3, light-dark(#6b3fa0, #c9a6ff)); }
.zest-sheet .zest-ref-box[data-color="3"] { --_ref-color: var(--zest-spread-sheet-reference-4, light-dark(#1b7f3a, #7ad69a)); }
.zest-sheet .zest-ref-box[data-color="4"] { --_ref-color: var(--zest-spread-sheet-reference-5, light-dark(#a35400, #ffb86b)); }
.zest-sheet .zest-ref-box[data-color="5"] { --_ref-color: var(--zest-spread-sheet-reference-6, light-dark(#00707a, #6fd8e0)); }
.zest-sheet .zest-ref-box.zest-pointing {
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
    .zest-sheet .zest-ref-box { border-color: CanvasText; background: transparent; }
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
.zest-cell .zest-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 1.1em;
    height: 1.1em;
    border: 1.5px solid currentColor;
    border-radius: 3px;
    vertical-align: middle;
    cursor: pointer;
    line-height: 1;
}
.zest-cell .zest-check[aria-checked="true"]::after {
    content: '✓';
    font-weight: bold;
}
.zest-cell .zest-check[aria-readonly="true"] {
    cursor: default;
    opacity: 0.7;
}
.zest-cell:has(> .zest-check) {
    text-align: center;
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
.zest-cell.zest-locked {
    background: var(--zest-spread-sheet-face-locked, color-mix(in srgb, var(--_field) 88%, var(--_face)));
    color: var(--zest-spread-sheet-text-locked, var(--_field-text));
}
/* An invalid cell has a red inner border and a mark in the corner, so that it is not color only */
.zest-cell.zest-invalid {
    box-shadow: inset 0 0 0 2px var(--_invalid);
}
.zest-cell.zest-invalid::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    border-style: solid;
    border-width: 0 0.5em 0.5em 0;
    border-color: transparent var(--_invalid) transparent transparent;
}
@media (forced-colors: active) {
    .zest-cell.zest-invalid { box-shadow: inset 0 0 0 2px CanvasText; }
    .zest-cell.zest-invalid::after { border-right-color: CanvasText; }
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
    // `checkbox` is the name of the column, when its boolean cells show as check boxes.
    show(cell, locked = false, checkbox = null) {
        if (this.#editor) { return; }
        const asCheck = checkbox !== null && (cell.type === 'boolean' || cell.input === '');
        const display = asCheck ? `\u0001${cell.value === true}\u0001${locked}\u0001${checkbox}` : cell.display;
        const parts = [cell.error ? 'zest-error' : `zest-${cell.type}`];
        if (cell.style?.bold) { parts.push('zest-bold'); }
        if (cell.style?.italic) { parts.push('zest-italic'); }
        if (cell.style?.align) { parts.push(`zest-align-${cell.style.align}`); }
        const invalid = Boolean(cell.mark?.invalid);
        if (locked) { parts.push('zest-locked'); }
        if (invalid) { parts.push('zest-invalid'); }
        const className = `zest-in-sheet zest-cell ${parts.join(' ')}`;
        if (this.#shown.display !== display) {
            if (asCheck) {
                // A check box that a screen reader knows. Space or a click on it changes the cell.
                const box = Object.assign(document.createElement('span'), {className: 'zest-check'});
                box.setAttribute('role', 'checkbox');
                box.setAttribute('aria-checked', String(cell.value === true));
                box.setAttribute('aria-label', checkbox);
                if (locked) { box.setAttribute('aria-readonly', 'true'); }
                this.replaceChildren(box);
            } else {
                this.textContent = display;
            }
            this.#shown.display = display;
        }
        if (this.#shown.className !== className) {
            this.className = className;
            this.#shown.className = className;
            if (locked) { this.setAttribute('aria-readonly', 'true'); } else { this.removeAttribute('aria-readonly'); }
            if (invalid) { this.setAttribute('aria-invalid', 'true'); } else { this.removeAttribute('aria-invalid'); }
        }
        const message = invalid ? (cell.mark.message ?? '') : '';
        if (this.#shown.message !== message) {
            this.#shown.message = message;
            if (message) { this.title = message; } else { this.removeAttribute('title'); }
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
            formula.value = sheet.inputText(sheet.activeAddress);
        }
        formula.setAttribute('aria-label', `Input of cell ${sheet.activeAddress}`);
    }
}

const NAV = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]};
const IMPLICIT = {number: validators.float(), boolean: validators.bool()};
// The sign in the row header for each state of a row in data entry. The words also tell it.
const ROW_SIGNS = {changed: '•', draft: '•', empty: '*', pending: '…', sent: '✓', error: '!', conflict: '≠'};
const ROW_WORDS = {changed: 'changed, not sent', draft: 'new, not sent', empty: 'new row', pending: 'sending', sent: 'sent', error: 'not sent', conflict: 'changed here and elsewhere, not sent'};
// A required column with a validator: the copy, made one time for each validator
const requiredCopies = new WeakMap();
const ANY = validators.any();

// The arguments of each built-in function, for the list of functions in the editor
const FUNCTION_HINTS = {
    SUM: 'number, ...', AVERAGE: 'number, ...', MIN: 'number, ...', MAX: 'number, ...', PRODUCT: 'number, ...',
    COUNT: 'value, ...', COUNTA: 'value, ...', COUNTBLANK: 'range', ABS: 'number', SQRT: 'number', INT: 'number',
    ROUND: 'number, digits', MOD: 'number, divisor', IF: 'test, if true, if false', IFERROR: 'value, if error',
    AND: 'test, ...', OR: 'test, ...', NOT: 'test', CONCAT: 'text, ...', CONCATENATE: 'text, ...', LEN: 'text',
    UPPER: 'text', LOWER: 'text', TRIM: 'text', TODAY: '',
};
// The parts of the hint of a function: its arguments, and the index of the part that repeats
function functionHint(name) {
    if (!(name in FUNCTION_HINTS)) { return null; }
    const text = FUNCTION_HINTS[name];
    return text ? text.split(', ') : [];
}
let functionList = {count: -1, items: []};
// The items of the list of functions. An application can add a function to SHEET_FUNCTIONS at any time.
function functionItems() {
    const names = Object.keys(FUNCTIONS);
    if (functionList.count !== names.length) {
        functionList = {
            count: names.length,
            items: names.sort().map(name => ({label: name, insertText: `${name}(`, description: name in FUNCTION_HINTS ? `${name}(${FUNCTION_HINTS[name]})` : ''})),
        };
    }
    return functionList.items;
}
// The wall clock of an instant in a time zone, as ISO text with no zone: '2026-03-13T09:30'
function wallTime(date, timeZone) {
    const parts = {};
    for (const part of new Intl.DateTimeFormat('en-CA', {timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'}).formatToParts(date)) {
        parts[part.type] = part.value;
    }
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
const isMacPlatform = () => /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');

let sheetCount = 0;
let helpCount = 0;
const functionValidators = new WeakMap();

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
        // Tab and Enter go past locked cells
        skipLocked: {type: Boolean, attribute: 'skip-locked', render: false},
        // 'refuse': a change that touches a locked cell does nothing. 'skip': the other cells change.
        lockedCells: {type: String, default: 'refuse', attribute: 'locked-cells', render: false},
        // A notice tells the person that a cell is locked
        lockedNotice: {type: Boolean, default: true, attribute: 'locked-notice', render: false},
        // Data entry: the number of empty rows after the records
        entryRows: {type: Number, default: 0, attribute: 'entry-rows', render: false},
        // The name of the field that identifies a record
        recordKey: {type: String, default: 'id', attribute: 'record-key', render: false},
        // When a changed row goes to onSubmitRow: 'leave-row', 'enter', 'change', or 'manual'
        submitOn: {type: String, default: 'leave-row', attribute: 'submit-on', render: false},
        // With submit-on="change", the problems of a row show when the person leaves it, not while they type
        quietRows: {type: Boolean, attribute: 'quiet-rows', render: false},
        // Data entry: a paste of many rows sends each complete row at once
        pasteSubmits: {type: Boolean, attribute: 'paste-submits', render: false},
        // Data entry: a text value of a record stays a text, also when it reads as a number or a date
        keepText: {type: Boolean, attribute: 'keep-text', render: false},
        // Data entry: a changed row that also changed elsewhere shows it, and does not go until the person decides
        showConflicts: {type: Boolean, attribute: 'show-conflicts', render: false},
        // Messages of the validators for this sheet, by reason, for example a translation
        messages: {type: Object, default: null, attribute: false, render: false},
    };

    // The commands of the sheet. A menu or a toolbar can use the same actions.
    actions;
    // (cell) => true, false, or undefined. A rule for locks, after readonly and before the model.
    lockRule = null;
    // (detail) => void, in place of the notice for a refused change
    onLocked = null;
    // (context) => void, in place of the default mark on an invalid cell. context.mark() adds the default mark.
    onInvalid = null;
    // (context) => void, after the mark on an invalid cell
    afterInvalid = null;
    // (context) => void, after a cell becomes valid. The mark goes away first.
    onValid = null;
    // (record, context) => a value or a promise. Sends a row: an RPC call, an event, a POST, or other.
    onSubmitRow = null;
    // (context) => boolean, in place of submitOn. A row with a problem never goes.
    submitWhen = null;
    // (record, context) => {key: message}, a message, or null. The checks that use more than one cell.
    validateRow = null;
    // (record, context) => an id for a new row, before its send, for example crypto.randomUUID()
    newRecordId = null;
    // The reason for the next leave of a row: 'enter' for the Enter key
    #leaving = null;
    #lockNotice = null;
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
    // The column where a run of Tab keys started. Enter goes to the next row in this column.
    #tabStart = null;
    #keepTab = false;
    // A reference that the arrow keys or the pointer put in the formula: {start, end, anchor, focus}
    #point = null;
    #pointWriting = false;
    #refBoxes = [];
    #argHint = null;
    #leaveArmed = false;
    #datePicker = null;
    #datePickerOutside = null;
    #argHintKey = '';
    // The editor has its own cell element, so that a scroll or rows that move do not end the edit
    #editorCell = null;
    #editorRow = null;
    #typeahead = null;
    // The record rows and the entry rows, when `records` or `entryRows` is set
    #records = null;

    constructor() {
        super();
        this.template = '';
        this.#makeActions();
    }

    // ---------- Data ----------

    get model() {
        if (!this.#model) { this.model = new SheetModel({rows: this.rows, columns: this.columns, locale: this.effectiveLocale}); }
        return this.#model;
    }

    // The locale of numbers, dates, and formulas: `locale`, else the `lang` of the page, else the browser
    get effectiveLocale() {
        return this.locale || globalThis.document?.documentElement?.lang || globalThis.navigator?.language || null;
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
        if (name === 'entryRows') {
            if (this.#records || value > 0) { this.#startRecords().setRecords(this.#records?.records ?? []); }
            return;
        }
        if (!this.#model) { return; }
        if ((name === 'rows' || name === 'columns') && !this.#records) {
            const json = this.#model.toJSON();
            this.#model.load({...json, rows: this.rows, columns: Array.isArray(json.columns) ? json.columns : this.columns, columnCount: this.columns});
        }
        if (name === 'locale') {
            this.#model.locale = this.effectiveLocale;
            this.#all = true;
        }
    }

    getCell(where, col) { return this.model.getCell(where, col); }
    getValue(where, col) { return this.model.getValue(where, col); }
    // Code changes cells also when they are locked. With `respectLocks`, the change follows the
    // locks as a change by the person does (for code that acts for the person, as a macro does).
    // The result is false when the locks refused the change.
    setCell(where, input, {respectLocks = false} = {}) {
        if (!respectLocks) { this.model.setCell(where, input); return true; }
        return this.#guarded('code', () => { this.model.setCell(where, input); return true; }) ?? false;
    }
    setCells(changes, {respectLocks = false} = {}) {
        if (!respectLocks) { this.model.setCells(changes); return true; }
        return this.#guarded('code', () => { this.model.setCells(changes); return true; }) ?? false;
    }
    load(data) { this.model.load(data); }
    toJSON() { return this.model.toJSON(); }
    toCSV(options) { return this.model.toCSV(options); }
    // Reads CSV at a cell. `locale`, or `decimal`, `group`, and `order`, tell the signs of the file,
    // so that '1.234,5' becomes 1234.5. detectCsvFormat(text) finds them from the data.
    fromCSV(text, at = 'A1', options = {}) {
        const {delimiter = ',', locale = null} = options;
        const info = locale ? sheetLocale(locale) : (options.decimal || options.order ? textFormat(options) : null);
        this.model.fromCSV(text, at, {delimiter, mapInput: info ? (input, row, col) => (this.model.columnType(col) === 'text' ? input : toCanonicalInput(input, info)) : null});
    }
    insertRows(index, count) { this.model.insertRows(index, count); }
    deleteRows(index, count) { this.model.deleteRows(index, count); }
    insertColumns(index, count) { this.model.insertColumns(index, count); }
    deleteColumns(index, count) { this.model.deleteColumns(index, count); }
    undo() { return this.model.undo(); }
    redo() { return this.model.redo(); }

    // ---------- Data entry ----------

    // The settings of each column: [{key, title, type, validate, options, required, formula, locked, width}]
    setColumns(list) {
        this.model.setColumns(list);
        if (this.#records) { this.#records.setRecords(this.#records.records, {force: true}); }
    }

    // The data of the application: an array of objects, one for each row. Set it again each time
    // that the data changes, also from another person or another part of the page. The rows that
    // the person changed stay as they are, so that no work is lost.
    get records() { return this.#records?.records ?? null; }
    set records(list) {
        const records = this.#startRecords();
        records.setRecords(list ?? []);
        const rows = records.takeConflicts();
        if (!this.showConflicts) { return; }
        for (const row of rows) {
            const conflict = records.conflictOf(row);
            this.emit('spreadsheet-row-conflict', {row, ...conflict});
            this.#say(`Row ${row + 1} changed elsewhere: ${conflict.fields.join(', ')}`);
        }
    }

    // A row that the person changed, and that also changed elsewhere: {original, incoming, fields}, or null
    rowConflict(row) { return this.#records?.conflictOf(row) ?? null; }
    // Keeps the changes of the person on top of the new version, so that the row can go.
    // discardRow(row) takes the new version.
    keepRowChanges(row = this.#anchor.row) {
        if (!this.#records) { return false; }
        return this.#asCode(() => this.#records.keepMine(row));
    }

    // The state of a row: 'clean', 'changed', 'empty', 'draft', 'pending', 'sent', 'error', or null
    rowState(row) { return this.#records?.stateOf(row) ?? null; }
    // The message of a row whose send failed
    rowError(row) { return this.#records?.rowInfo(row)?.error ?? null; }
    // The values of a row, from the validators: {record, errors, valid, empty}
    rowRecord(row) { return this.#records?.check(row) ?? null; }

    // Sends a row now, if it has changes and no problem. Returns true if it went.
    submitRow(row = this.#anchor.row) {
        if (!this.#records) { return false; }
        if (this.#edit) { this.#asUser(() => this.#commitEdit()); }
        return this.#records.consider(row, 'manual');
    }
    // Sends each row with changes and no problem. Returns the number of rows.
    submitAll() {
        if (!this.#records) { return 0; }
        if (this.#edit) { this.#asUser(() => this.#commitEdit()); }
        return this.#records.submitAll();
    }
    // Puts a row back as its record, or empties an entry row
    discardRow(row = this.#anchor.row) {
        if (!this.#records) { return false; }
        if (this.#edit && this.#edit.row === row) { this.#cancelEdit(); }
        return this.#asCode(() => this.#records.discard(row));
    }

    #startRecords() {
        if (!this.#records) {
            this.#records = new RecordRows(this.#recordHost());
            this.#updateActions();
        }
        return this.#records;
    }

    #asCode(fn) {
        const user = this.#user;
        this.#user = 0;
        try { return fn(); } finally { this.#user = user; }
    }

    #recordHost() {
        return {
            sheet: this,
            recordKey: () => this.recordKey || 'id',
            entryRows: () => Math.max(0, Math.floor(this.entryRows || 0)),
            submitOn: () => this.submitOn || 'leave-row',
            submitWhen: () => this.submitWhen,
            quietRows: () => this.quietRows,
            showConflicts: () => this.showConflicts,
            onSubmitRow: () => this.onSubmitRow,
            validateRow: () => this.validateRow,
            newRecordId: () => this.newRecordId,
            editingRow: () => (this.#edit ? this.#edit.row : -1),
            columns: () => {
                const list = [];
                for (let col = 0; col < this.model.columnCount; col++) {
                    const info = this.model.column(col);
                    list.push({key: info.key, col, formula: info.formula ?? null});
                }
                return list;
            },
            inputOf: (value, col) => this.#inputOfValue(value, col),
            inputAt: (row, col) => this.model.getInput(row, col),
            formulaFor: (column, row) => '=' + shiftFormula(String(column.formula).replace(/^=/, ''), row, 0),
            write: (changes) => this.#asCode(() => this.model.setCells(changes, {history: false})),
            remap: (mapping, count) => this.#remap(mapping, count),
            setRowCount: (count) => this.#asCode(() => this.model.setRowCount(count)),
            parseCell: (row, col) => this.#parseCell(row, col),
            reportProblems: (problems) => this.#reportProblems(problems),
            clearMarks: (row) => {
                const marks = [];
                for (let col = 0; col < this.model.columnCount; col++) { if (this.model.getMark(row, col)) { marks.push({row, col, mark: null}); } }
                if (marks.length) { this.model.setMarks(marks); }
            },
            rowsChanged: () => {
                this.#all = true;
                this.#updateActions();
                this.invalidate();
            },
            say: (text) => this.#say(text),
            emit: (name, detail) => this.emit(name, detail, {cancelable: true}),
        };
    }

    // The input for a value of a record
    #inputOfValue(value, col) {
        if (value === null || value === undefined) { return ''; }
        const info = this.model.column(col);
        const validator = this.#validatorOf(col);
        const type = this.model.columnType(col);
        let text;
        if (columnOptions(info)) {
            text = String(value);
        } else if (value instanceof Date) {
            text = type === 'date' || validator?.kind === 'date' ? value.toISOString().slice(0, 10) : value.toISOString();
        } else if (typeof value === 'boolean') {
            text = value ? 'TRUE' : 'FALSE';
        } else if (validator?.format && !['any', 'text'].includes(validator.kind) && typeof value !== 'string') {
            text = validator.format(value);
        } else if (value instanceof Uint8Array) {
            text = [...value].map(byte => byte.toString(16).padStart(2, '0')).join('');
        } else {
            text = String(value);
        }
        if (typeof value === 'string' && type !== 'text') {
            if (text.startsWith('=') || text.startsWith("'")) {
                // Data never becomes a formula, so that a value from outside cannot calculate
                text = `'${text}`;
            } else if (this.keepText && !validator && readInput(text, type ?? 'auto').type !== 'text') {
                // With keep-text, a text stays a text, also when it reads as a number or a date
                text = `'${text}`;
            }
        }
        return text;
    }

    // The value of a cell for a record: {valid, value} or {valid: false, message, reason}
    #parseCell(row, col) {
        const input = this.model.getInput(row, col);
        const validator = this.#validatorOf(col) ?? this.#implicitValidator(col);
        if (input.startsWith('=')) {
            const value = this.model.getValue(row, col);
            if (value instanceof SheetError) { return {valid: false, message: `The formula gives ${value.code}.`, reason: 'formula'}; }
            const plain = value instanceof SheetDate ? formatDate(fromDayNumber(value.days)) : value;
            return validator ? validator.parse(plain === null ? '' : String(plain), this.#parseContext()) : {valid: true, value: plain};
        }
        const text = input.startsWith("'") ? input.slice(1) : input;
        if (validator) { return validator.parse(text, this.#parseContext()); }
        const value = this.model.getValue(row, col);
        if (value === null || value === undefined || value === '') { return {valid: true, value: null}; }
        return {valid: true, value: value instanceof SheetDate ? formatDate(fromDayNumber(value.days)) : value};
    }

    // In data entry, a number or boolean column with no validator still checks its type
    #implicitValidator(col) {
        if (!this.#records) { return null; }
        const type = this.model.columnType(col);
        if (type === 'number') { return IMPLICIT.number; }
        if (type === 'boolean') { return IMPLICIT.boolean; }
        return null;
    }

    // Marks cells with problems from a send, with the same handlers as a validation
    #reportProblems(problems) {
        const marks = [];
        for (const {row, col, message, reason} of problems) {
            const context = {row, col, address: formatAddress(row, col), input: this.model.getInput(row, col), source: 'user', sheet: this, column: this.model.column(col)};
            const mark = (text = message) => marks.push({row, col, mark: {invalid: true, message: text}});
            const invalidContext = {...context, message, reason, mark};
            if (this.onInvalid) { this.onInvalid(invalidContext); } else { mark(); }
            this.afterInvalid?.(invalidContext);
        }
        if (marks.length) { this.model.setMarks(marks); }
    }

    // Rows moved because of new data. The active cell, the editor, and the view follow their rows.
    #remap(mapping, rowCount) {
        let identity = rowCount === this.model.rowCount;
        for (let row = 0; identity && row < mapping.length; row++) { if (mapping[row] !== row) { identity = false; } }
        if (identity) { return; }
        const map = (row) => (row < mapping.length ? mapping[row] : row);
        const viewport = this.#built?.viewport;
        const before = this.#anchor.row;
        const visible = viewport ? (before * this.#rowPx >= viewport.scrollTop && (before + 1) * this.#rowPx <= viewport.scrollTop + viewport.clientHeight) : false;
        const after = map(before) >= 0 ? map(before) : Math.min(before, rowCount - 1);
        const focusRow = map(this.#focus.row) >= 0 ? map(this.#focus.row) : after;
        if (this.#edit) {
            this.#edit.row = map(this.#edit.row) >= 0 ? map(this.#edit.row) : this.#edit.row;
            // The references in an open formula follow their rows, as the references of saved formulas do
            const editor = this.#edit.editor;
            if (editor?.value.startsWith('=')) {
                const move = (ref) => { const row = map(ref.row); return row >= 0 ? {...ref, row} : null; };
                const caret = editor.selectionStart;
                const text = '=' + rewriteFormula(editor.value.slice(1), {move});
                if (text !== editor.value) {
                    const before = '=' + rewriteFormula(editor.value.slice(1, Math.max(1, caret)), {move});
                    editor.value = text;
                    editor.setSelectionRange(before.length, before.length);
                }
            }
        }
        if (this.#point) {
            for (const end of ['anchor', 'focus']) {
                const row = map(this.#point[end].row);
                if (row >= 0) { this.#point[end] = {...this.#point[end], row}; }
            }
        }
        this.#cut = null;
        this.#clip = null;
        this.#asCode(() => this.model.remapRows(mapping, rowCount));
        this.#anchor = {row: Math.min(after, rowCount - 1), col: this.#anchor.col};
        this.#focus = {row: Math.min(focusRow, rowCount - 1), col: this.#focus.col};
        // The active row stays at the same place on the screen, so the view does not jump
        if (viewport && visible && after !== before) { viewport.scrollTop += (after - before) * this.#rowPx; }
        this.#all = true;
        this.#updateRefBoxes();
        this.invalidate();
    }

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

    // ---------- Locks ----------

    // True when the user cannot change the cell: readonly, then a row that the sheet is sending,
    // then lockRule, then the cell, its row, and its column in the model
    isLocked(row, col) {
        if (this.readOnly) { return true; }
        if (this.#rowIsBusy(row)) { return true; }
        // In data entry, a calculated column is not for typing
        if (this.#records && this.model.column(col).formula) { return true; }
        // Each source can lock a cell. None unlocks a cell that another source locks.
        if (this.lockRule?.({row, col, address: formatAddress(row, col), sheet: this}) === true) { return true; }
        return this.model.isLocked(row, col);
    }

    // Shows each cell again, for example after the data that lockRule reads changed
    refresh() {
        this.#all = true;
        this.invalidate();
    }

    #skipsLocked() { return this.skipLocked; }

    // A row that the sheet sends with onSubmitRow is locked until the answer comes
    #rowIsBusy(row) { return this.#records?.isBusy(row) ?? false; }

    // Runs a change of the model for the user. With 'refuse', a change that touches a locked cell
    // does nothing, and the person is told. With 'skip', only the unlocked cells change.
    #guarded(operation, fn) {
        const locked = (row, col) => this.isLocked(row, col);
        if (this.lockedCells === 'skip') {
            const guard = {mode: 'skip', locked, hits: []};
            const result = this.model.withGuard(guard, fn);
            if (guard.hits.length) { this.#say(`${guard.hits.length} locked ${guard.hits.length === 1 ? 'cell' : 'cells'} did not change`); }
            return result;
        }
        const probe = {mode: 'probe', locked, hits: []};
        this.model.withGuard(probe, fn);
        if (probe.hits.length) {
            this.#refuse(operation, probe.hits.map(key => ({row: Math.floor(key / MAX_COLUMNS), col: key % MAX_COLUMNS})));
            return undefined;
        }
        return fn();
    }

    // Tells the person that a change did nothing because of locked cells
    #refuse(operation, cells) {
        const first = cells[0];
        const address = formatAddress(first.row, first.col);
        const message = cells.length === 1
            ? `Cell ${address} is locked. You cannot change it.`
            : `${cells.length} cells are locked, for example ${address}. Nothing changed.`;
        this.#say(message);
        const detail = {operation, cells: cells.map(cell => ({...cell, address: formatAddress(cell.row, cell.col)})), message};
        const go = this.emit('spreadsheet-locked', detail, {cancelable: true});
        if (!go) { return; }
        if (this.onLocked) { this.onLocked(detail); return; }
        if (!this.lockedNotice || this.#lockNotice) { return; }
        // One notice at a time, so that a held key does not make a stack of them
        const notice = showNotice({text: message, kind: 'warning', timeout: 4000});
        this.#lockNotice = notice;
        notice.closed.then(() => { if (this.#lockNotice === notice) { this.#lockNotice = null; } });
    }

    // Each locked cell with content in the rows or the columns, and each locked row
    #lockedIn(axis, range) {
        const cells = [];
        if (axis === 'row') {
            for (let row = range.top; row <= range.bottom && cells.length < 1000; row++) {
                if (this.#rowIsBusy(row) || this.model.row(row).locked) { cells.push({row, col: 0}); }
            }
        }
        const probe = {mode: 'probe', locked: (row, col) => this.isLocked(row, col), hits: []};
        const area = axis === 'row'
            ? {top: range.top, bottom: range.bottom, left: 0, right: this.model.columnCount - 1}
            : {top: 0, bottom: this.model.rowCount - 1, left: range.left, right: range.right};
        this.model.withGuard(probe, () => this.model.clear(area));
        for (const key of probe.hits) { cells.push({row: Math.floor(key / MAX_COLUMNS), col: key % MAX_COLUMNS}); }
        return cells;
    }

    #changeStructure(operation, axis, range, fn) {
        if (this.#records) { this.#say('In data entry, rows and columns do not change'); return; }
        if (operation.startsWith('delete')) {
            const locked = this.#lockedIn(axis, range);
            if (locked.length) { this.#refuse(operation, locked); return; }
        }
        fn();
    }

    #history(side) {
        const cells = this.model.historyCells(side);
        const locked = (cells ?? []).filter(cell => this.isLocked(cell.row, cell.col));
        if (locked.length) { this.#refuse(side, locked); return; }
        if (side === 'undo') { this.model.undo(); } else { this.model.redo(); }
    }

    // ---------- Validation ----------

    // The options of a column with a list: [{value, label}], or null
    optionsOf(col) { return columnOptions(this.model.column(col)); }

    #validatorOf(col) {
        const info = this.model.column(col);
        let validator = info.validate ?? null;
        if (typeof validator === 'function') {
            const fn = validator;
            validator = functionValidators.get(fn) ?? {kind: 'any', parse: fn, check: fn, format: String};
            functionValidators.set(fn, validator);
        } else if (validator && typeof validator.parse !== 'function') {
            validator = null;
        }
        if (info.required) {
            const base = validator ?? this.#implicitValidator(col) ?? ANY;
            let copy = requiredCopies.get(base);
            if (!copy) {
                copy = validators.required(base);
                requiredCopies.set(base, copy);
            }
            return copy;
        }
        return validator;
    }

    // The text that the editor starts with: the label of an option, not its value
    // The text of the input in the form of the locale: '1234,5' in German. The formula bar shows it too.
    #editText(row, col) {
        const input = this.model.getInput(row, col);
        const options = this.optionsOf(col);
        if (!options || input.startsWith('=')) {
            if (this.model.columnType(col) === 'text') { return input; }
            return toLocalInput(input, this.effectiveLocale, this.model.getCell(row, col).type);
        }
        return options.find(item => String(item.value) === input)?.label ?? input;
    }
    inputText(where, col) {
        const {row, col: column} = typeof where === 'string' ? parseAddress(where) : {row: where, col};
        return this.#editText(row, column);
    }

    // The input to save: an option label becomes the value of the option, and a number, a date, or
    // a formula of the locale becomes canonical. `raw` is an input that is canonical already.
    #inputFor(col, text, {raw = false} = {}) {
        const options = this.optionsOf(col);
        if (!options || text.startsWith('=')) {
            if (raw || this.model.columnType(col) === 'text') { return text; }
            return toCanonicalInput(text, this.effectiveLocale);
        }
        const folded = text.trim().toLowerCase();
        const item = options.find(option => option.label.toLowerCase() === folded) ?? options.find(option => String(option.value).toLowerCase() === folded);
        return item ? String(item.value) : text;
    }

    // Validates cells after their input changed: [{row, col}]. The default post-invalid handler
    // marks the cell. onInvalid replaces it, and afterInvalid runs after it. onValid runs after the
    // mark goes away. source is 'user' or 'code'.
    #validate(cells, source) {
        const marks = [];
        for (const {row, col} of cells) {
            const validator = this.#validatorOf(col);
            if (!validator) { continue; }
            const input = this.model.getInput(row, col);
            const context = {row, col, address: formatAddress(row, col), input, source, sheet: this, column: this.model.column(col)};
            // A formula cell has a calculated value, which an error already shows
            const result = input.startsWith('=') ? {valid: true, value: this.model.getValue(row, col)} : validator.parse(input, this.#parseContext());
            if (result.valid) {
                if (this.model.getMark(row, col)?.invalid) { marks.push({row, col, mark: null}); }
                this.onValid?.({...context, value: result.value});
                continue;
            }
            const mark = (message = result.message) => marks.push({row, col, mark: {invalid: true, message}});
            const invalidContext = {...context, message: result.message, reason: result.reason, mark};
            if (this.onInvalid) { this.onInvalid(invalidContext); } else { mark(); }
            this.afterInvalid?.(invalidContext);
        }
        if (marks.length) { this.model.setMarks(marks); }
    }

    #validateAll() {
        const cells = [];
        const columns = new Set();
        for (let col = 0; col < this.model.columnCount; col++) { if (this.#validatorOf(col)) { columns.add(col); } }
        if (!columns.size) { return; }
        this.model.forEachCell((row, col) => { if (columns.has(col)) { cells.push({row, col}); } });
        this.#validate(cells, 'code');
    }

    // A change that the user made, from a part of the sheet or a formula bar. It sends events.
    writeByUser(address, input) {
        if (this.readOnly) { return; }
        const {col} = parseAddress(address);
        this.#asUser(() => this.#guarded('edit', () => this.model.setCell(address, this.#inputFor(col, input))));
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
            undo: make('undo', 'Undo', 'Mod+Z', () => { if (editing()) { this.#history('undo'); } }, {enabled: false}),
            redo: make('redo', 'Redo', 'Mod+Y', () => { if (editing()) { this.#history('redo'); } }, {enabled: false}),
            cut: make('cut', 'Cut', 'Mod+X', () => this.#copy(true)),
            copy: make('copy', 'Copy', 'Mod+C', () => this.#copy(false)),
            paste: make('paste', 'Paste', 'Mod+V', () => this.#pasteFromSystem()),
            clear: make('clear', 'Clear contents', 'Delete', () => { if (editing()) { this.#guarded('clear', () => this.model.clear(this.selection)); } }),
            fillDown: make('fillDown', 'Fill down', 'Mod+D', () => { if (editing()) { this.#guarded('fillDown', () => this.model.fill(this.selection, 'down')); } }),
            fillRight: make('fillRight', 'Fill right', 'Mod+R', () => { if (editing()) { this.#guarded('fillRight', () => this.model.fill(this.selection, 'right')); } }),
            bold: make('bold', 'Bold', 'Mod+B', () => this.#toggleStyle('bold'), {checkable: true}),
            italic: make('italic', 'Italic', 'Mod+I', () => this.#toggleStyle('italic'), {checkable: true}),
            today: make('today', 'Insert today', 'Mod+;', () => this.#insertToday()),
            selectAll: make('selectAll', 'Select all', 'Mod+A', () => this.#select({row: 0, col: 0}, {row: this.model.rowCount - 1, col: this.model.columnCount - 1})),
            insertRow: make('insertRow', 'Insert row', null, () => { if (editing()) { this.#changeStructure('insertRow', 'row', this.selection, () => this.model.insertRows(this.selection.top, this.selection.bottom - this.selection.top + 1)); } }),
            deleteRow: make('deleteRow', 'Delete row', null, () => { if (editing()) { this.#changeStructure('deleteRow', 'row', this.selection, () => { this.model.deleteRows(this.selection.top, this.selection.bottom - this.selection.top + 1); this.#clampSelection(); }); } }),
            insertColumn: make('insertColumn', 'Insert column', null, () => { if (editing()) { this.#changeStructure('insertColumn', 'col', this.selection, () => this.model.insertColumns(this.selection.left, this.selection.right - this.selection.left + 1)); } }),
            submitRow: make('submitRow', 'Send row', null, () => this.submitRow(), {enabled: false}),
            discardRow: make('discardRow', 'Discard row changes', null, () => this.discardRow(), {enabled: false}),
            deleteColumn: make('deleteColumn', 'Delete column', null, () => { if (editing()) { this.#changeStructure('deleteColumn', 'col', this.selection, () => { this.model.deleteColumns(this.selection.left, this.selection.right - this.selection.left + 1); this.#clampSelection(); }); } }),
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
        for (const id of ['cut', 'paste', 'clear', 'fillDown', 'fillRight', 'bold', 'italic', 'today']) {
            this.actions[id].enabled = writable;
        }
        // In data entry, the rows are the records, and the columns are the fields
        for (const id of ['insertRow', 'deleteRow', 'insertColumn', 'deleteColumn']) {
            this.actions[id].enabled = writable && !this.#records;
        }
        const state = this.#records?.stateOf(this.#anchor.row);
        this.actions.submitRow.enabled = writable && ['changed', 'draft', 'error'].includes(state);
        this.actions.discardRow.enabled = writable && ['changed', 'draft', 'error'].includes(state);
        const style = this.#model.getCell(this.#anchor.row, this.#anchor.col).style ?? {};
        bold.checked = Boolean(style.bold);
        italic.checked = Boolean(style.italic);
    }

    #toggleStyle(name) {
        if (this.readOnly) { return; }
        const on = !this.model.getCell(this.#anchor.row, this.#anchor.col).style?.[name];
        this.#guarded(name, () => this.model.setStyle(this.selection, {[name]: on || null}));
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
        const address = this.activeAddress;
        this.#guarded('today', () => this.model.setCell(address, text));
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
        // Data entry: a row that the person leaves for another part of the page can go
        this.listen(viewport, 'focusout', (e) => {
            const inside = (node) => Boolean(node) && (this.contains(node) || this.root.contains?.(node));
            if (!this.#records || inside(e.relatedTarget)) { return; }
            // The end of an edit removes the editor, and the browser then sends a focusout with
            // no relatedTarget. So the sheet looks where the focus is after the move.
            setTimeout(() => {
                const focused = this.root.activeElement ?? document.activeElement;
                if (!this.isConnected || this.#edit || inside(focused) || this.#built.viewport.matches(':focus-within')) { return; }
                const row = this.#anchor.row;
                this.#asCode(() => this.#records.consider(row, 'leave'));
            }, 0);
        });
        // The browser sends a clipboard event to the body when the focused element is not a text
        // field, so the sheet listens on the document and checks that its grid has the focus
        this.listen(document, 'copy', (e) => this.#onClipboard(e, 'copy'));
        this.listen(document, 'cut', (e) => this.#onClipboard(e, 'cut'));
        this.listen(document, 'paste', (e) => this.#onPaste(e));
        this.listen(viewport, 'input', (e) => {
            if (!this.#edit || e.target !== this.#edit.editor) { return; }
            if (e.target.hasAttribute('aria-invalid')) {
                e.target.removeAttribute('aria-invalid');
                e.target.removeAttribute('title');
                this.#edit.cell.classList.remove('zest-invalid');
            }
            // A change that the person typed ends the reference that the arrow keys move
            if (!this.#pointWriting) { this.#point = null; }
            this.#updateRefBoxes();
            this.#tell('edit', e.target.value);
        });
        // A move of the caret can go into the arguments of another function
        const caretMoved = (e) => { if (this.#edit && e.target === this.#edit.editor) { this.#updateArgHint(); } };
        this.listen(viewport, 'keyup', caretMoved);
        // A click on a check box changes it. The press before the click selected the cell.
        this.listen(viewport, 'click', (e) => {
            if (this.#edit || !e.target.closest?.('.zest-check')) { return; }
            this.#asUser(() => this.#toggleBoolean());
        });
        this.listen(viewport, 'pointerup', caretMoved);
        this.own(observeResize(viewport, () => this.invalidate()));
        this.own(() => clearTimeout(this.#announceTimer));
        this.own(() => this.#closeDatePicker(false));
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
        const dateButton = Object.assign(document.createElement('span'), {className: 'zest-date-button', textContent: '▾', title: 'Calendar (Alt+Arrow Down)'});
        dateButton.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) { return; }
            e.preventDefault();
            e.stopPropagation();
            this.#asUser(() => this.#openDatePicker());
        });
        active.append(dateButton);
        sizer.append(headRow, selection, active);
        viewport.append(sizer);
        const live = document.createElement('div');
        live.className = 'zest-live';
        live.setAttribute('aria-live', 'polite');
        // Tab goes from row to row, so the grid tells how to leave it (WCAG 2.1.2, No Keyboard Trap)
        const help = Object.assign(document.createElement('div'), {className: 'zest-help', id: `zest-sheet-help-${++helpCount}`});
        help.textContent = 'Tab goes to the next cell. Press Escape, then Tab, to leave the sheet.';
        viewport.setAttribute('aria-describedby', help.id);
        wrapper.append(viewport, live, help);
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
            const rowState = this.#records?.shownStateOf(row) ?? null;
            const rowError = rowState === 'error' ? this.#records.rowInfo(row).error
                : (rowState === 'conflict' ? `Changed elsewhere: ${this.#records.conflictOf(row).fields.join(', ')}` : null);
            if (newRow) {
                slot.row = row;
                slot.element.hidden = false;
                slot.element.style.top = `${this.#rowPx * (row + 1)}px`;
                slot.element.setAttribute('aria-rowindex', row + 2);
            }
            if (newRow || slot.state !== rowState || slot.error !== rowError) {
                slot.state = rowState;
                slot.error = rowError;
                this.#showRowHead(slot, row, rowState, rowError);
            }
            if (newRow || all) { slot.element.style.width = `${totalWidth}px`; }
            // A calculated column is blank in an empty entry row, so that the row looks empty
            const blank = rowState === 'empty';
            const rowRedraw = slot.blank !== blank;
            slot.blank = blank;
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
                if (moved || all || rowRedraw || dirty?.has(row * MAX_COLUMNS + col)) {
                    const info = model.getCell(row, col);
                    cell.show(blank && model.column(col).formula ? {...info, display: '', error: null} : info, this.isLocked(row, col), this.#checkboxOf(col));
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
        // A date cell has a button for the calendar, for a pointer. The keyboard uses Alt+Arrow Down.
        const dateKind = !this.readOnly && this.#dateKindOf(this.#anchor.col) && !this.isLocked(this.#anchor.row, this.#anchor.col);
        activeBox.classList.toggle('zest-has-date', Boolean(dateKind));
        if (this.#edit) {
            this.#placeEditor();
            this.#updateRefBoxes();
        }
    }

    // The editor cell goes over the cell that it edits
    #placeEditor() {
        const edit = this.#edit;
        const element = this.#editorCell;
        if (!edit || !element) { return; }
        this.#editorRow.style.top = `${this.#rowPx * (edit.row + 1)}px`;
        this.#editorRow.setAttribute('aria-rowindex', edit.row + 2);
        element.setAttribute('aria-colindex', edit.col + 2);
        element.style.left = `${this.#headPx + this.#lefts[edit.col]}px`;
        element.style.width = `${this.widthOf(edit.col)}px`;
        element.style.height = `${this.#rowPx}px`;
    }

    // A box with a color for each reference of the formula in the editor
    #updateRefBoxes() {
        if (!this.#built) { return; }
        const edit = this.#edit;
        const text = edit?.editor.value ?? '';
        const seen = new Map();
        if (edit && text.startsWith('=')) {
            for (const span of referenceSpans(text)) {
                const key = formatRange(span.range);
                if (!seen.has(key) && seen.size < 24) { seen.set(key, span.range); }
            }
        }
        const point = this.#point;
        const pointKey = point ? formatRange(normalizeRange({top: point.anchor.row, left: point.anchor.col, bottom: point.focus.row, right: point.focus.col})) : null;
        const rows = this.model.rowCount;
        const cols = this.model.columnCount;
        let index = 0;
        for (const [key, range] of seen) {
            let element = this.#refBoxes[index];
            if (!element) {
                element = document.createElement('div');
                element.className = 'zest-ref-box';
                element.setAttribute('aria-hidden', 'true');
                this.#built.sizer.append(element);
                this.#refBoxes.push(element);
            }
            const top = Math.min(range.top, rows - 1);
            const bottom = Math.min(range.bottom, rows - 1);
            const left = Math.min(range.left, cols - 1);
            const right = Math.min(range.right, cols - 1);
            element.hidden = false;
            element.dataset.color = String(index % 6);
            element.classList.toggle('zest-pointing', key === pointKey);
            element.style.left = `${this.#headPx + this.#lefts[left]}px`;
            element.style.top = `${this.#rowPx * (top + 1)}px`;
            element.style.width = `${this.#lefts[right + 1] - this.#lefts[left] + 1}px`;
            element.style.height = `${this.#rowPx * (bottom - top + 1) + 1}px`;
            index++;
        }
        for (; index < this.#refBoxes.length; index++) { this.#refBoxes[index].hidden = true; }
        this.#updateArgHint();
    }

    // The arguments of the function at the caret, above the editor, with the current one in bold.
    // A screen reader hears the name of the current argument when it changes.
    #updateArgHint() {
        const edit = this.#edit;
        const editor = edit?.editor;
        const call = editor && editor.selectionStart === editor.selectionEnd ? argumentAt(editor.value, editor.selectionStart, sheetLocale(this.effectiveLocale).argument) : null;
        const parts = call ? functionHint(call.name) : null;
        if (!parts || !this.#built) {
            if (this.#argHint) { this.#argHint.hidden = true; }
            this.#argHintKey = '';
            return;
        }
        if (!this.#argHint) {
            this.#argHint = Object.assign(document.createElement('div'), {className: 'zest-arg-hint'});
            this.#argHint.setAttribute('aria-hidden', 'true');
        }
        if (this.#argHint.parentNode !== this.#built.sizer) { this.#built.sizer.append(this.#argHint); }
        // The last part '...' repeats the part before it
        const repeats = parts[parts.length - 1] === '...';
        const current = parts.length ? (repeats && call.index >= parts.length - 1 ? parts.length - 2 : Math.min(call.index, parts.length - 1)) : -1;
        const key = `${call.name}\u0000${current}`;
        if (key !== this.#argHintKey) {
            this.#argHintKey = key;
            const children = [`${call.name}(`];
            const separator = `${sheetLocale(this.effectiveLocale).argument} `;
            parts.forEach((part, i) => {
                if (i) { children.push(separator); }
                children.push(i === current ? Object.assign(document.createElement('b'), {textContent: part}) : part);
            });
            children.push(')');
            this.#argHint.replaceChildren(...children);
            if (current >= 0) { this.#say(`${call.name}, ${parts[current]}`); }
        }
        this.#argHint.hidden = false;
        const left = this.#headPx + this.#lefts[edit.col];
        this.#argHint.style.left = `${left}px`;
        // Above the cell, so that the list of functions under the editor does not cover it
        this.#argHint.style.top = `${this.#rowPx * (edit.row + 1) - 1}px`;
        this.#argHint.style.transform = 'translateY(-100%)';
    }

    // The number of a row, and its state in data entry: a sign, and words for a screen reader
    #showRowHead(slot, row, state, error) {
        const sign = ROW_SIGNS[state] ?? '';
        const words = ROW_WORDS[state] ?? '';
        if (!sign && !words) {
            slot.head.textContent = row + 1;
            slot.element.removeAttribute('data-state');
            slot.head.removeAttribute('title');
            return;
        }
        const mark = Object.assign(document.createElement('span'), {className: 'zest-state', textContent: sign});
        mark.setAttribute('aria-hidden', 'true');
        const text = Object.assign(document.createElement('span'), {className: 'zest-words', textContent: `, ${words}${error ? `: ${error}` : ''}`});
        slot.head.replaceChildren(String(row + 1), mark, text);
        slot.element.dataset.state = state;
        if (error) { slot.head.title = error; } else if (words) { slot.head.title = words; }
    }

    #makePool(rows, cols) {
        const {sizer, headRow} = this.#built;
        const cellTag = tagFor(SheetCell, 'sheet-cell');
        for (const slot of this.#pool) { slot.element.remove(); }
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
        if (detail.loaded || detail.columns) {
            this.#validateAll();
        } else if (detail.changes.length) {
            this.#validate(detail.changes, this.#user ? 'user' : 'code');
        }
        if (this.#user && detail.changes.length) {
            this.emit('spreadsheet-change', {changes: detail.changes});
            if (this.#records) {
                const rows = new Set(detail.changes.map(change => change.row));
                this.#asCode(() => this.#records.userChanged(rows));
            }
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
        if (!this.#keepTab) { this.#tabStart = null; }
        this.#anchor = anchor;
        this.#focus = focus;
        this.#clampSelection();
        if (reveal) { this.#reveal(this.#focus.row, this.#focus.col); }
        this.#updateActions();
        this.invalidate();
        const range = this.selection;
        const changed = formatRange(before) !== formatRange(range) || activeBefore !== this.activeAddress;
        if (!changed) { return; }
        const leftRow = parseAddress(activeBefore).row;
        if (this.#records && leftRow !== this.#anchor.row) {
            const reason = this.#leaving ?? 'leave';
            this.#asCode(() => this.#records.consider(leftRow, reason));
        }
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
            const locked = this.isLocked(cell.row, cell.col) && !this.readOnly ? ', locked' : '';
            const invalid = cell.mark?.invalid ? `, invalid: ${cell.mark.message}` : '';
            this.#say(size > 1 ? `${formatRange(range)} selected, ${size} cells. ${cell.address} ${content}` : `${cell.address} ${content}${formula}${locked}${invalid}`);
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
        if (e.key !== 'Tab' && e.key !== 'Escape' && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) { this.#leaveArmed = false; }
        const mod = isMacPlatform() ? e.metaKey : e.ctrlKey;
        if (this.#asUser(() => this.#shortcuts.handle(e))) { return; }
        if (e.altKey && e.key === 'ArrowDown' && this.#dateKindOf(this.#anchor.col)) {
            e.preventDefault();
            this.#openDatePicker();
            return;
        }
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
            case 'Tab': {
                if (e.ctrlKey || e.metaKey || e.altKey) { return; }
                // After Escape, Tab leaves the grid as with any other control
                if (this.#leaveArmed) { this.#leaveArmed = false; return; }
                const next = this.#tabTarget(e.shiftKey ? -1 : 1);
                if (!next) { return; }
                e.preventDefault();
                this.#tabTo(next);
                return;
            }
            case 'Enter':
                if (e.altKey) { return; }
                e.preventDefault();
                if (mod) { this.#startEdit('edit'); return; }
                this.#enterTo(e.shiftKey ? -1 : 1);
                return;
            case 'F2':
                e.preventDefault();
                this.#startEdit('edit');
                return;
            case ' ':
                if (!e.shiftKey && !mod && !e.altKey && this.#isBooleanColumn(from.col)) {
                    // Space changes a boolean cell, as a check box does
                    e.preventDefault();
                    this.#toggleBoolean();
                    return;
                }
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
                    return;
                }
                // The way out of the grid: the next Tab goes to the next control of the page
                this.#leaveArmed = true;
                this.#say('Press Tab to leave the sheet');
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

    // Rows wrap for Tab: after the last column, Tab goes to the next row

    // The cell that Tab (1) or Shift+Tab (-1) goes to, or null to leave the grid
    #tabTarget(direction) {
        const lastCol = this.model.columnCount - 1;
        const lastRow = this.model.rowCount - 1;
        let {row, col} = this.#anchor;
        const start = this.#tabStart ?? col;
        // A limit, so that a sheet that is all locked does not make a long loop
        for (let step = 0; step < 4096; step++) {
            col += direction;
            if (col > lastCol || col < 0) {
                // Tab goes on to the next row. Only the last cell (or Shift+Tab at the first) leaves.
                row += direction;
                if (row > lastRow || row < 0) { return null; }
                col = direction > 0 ? (this.#skipsLocked() ? 0 : Math.min(start, lastCol)) : lastCol;
            }
            if (!this.#skipsLocked() || !this.isLocked(row, col)) { return {row, col}; }
        }
        return null;
    }

    #tabTo(target) {
        if (this.#tabStart === null) { this.#tabStart = this.#anchor.col; }
        this.#keepTab = true;
        try {
            this.#move(target, false);
        } finally {
            this.#keepTab = false;
        }
    }

    // Enter goes down (1) or up (-1), to the column where the run of Tab keys started
    #enterTo(direction) {
        this.#leaving = 'enter';
        try {
            this.#enterMove(direction);
        } finally {
            this.#leaving = null;
        }
    }

    #enterMove(direction) {
        const col = this.#tabStart ?? this.#anchor.col;
        let row = this.#anchor.row + direction;
        if (this.#skipsLocked()) {
            const lastRow = this.model.rowCount - 1;
            for (let step = 0; step < 4096 && row >= 0 && row <= lastRow && this.isLocked(row, col); step++) { row += direction; }
            if (row < 0 || row > lastRow) { row = this.#anchor.row; }
        }
        this.#tabStart = null;
        this.#move({row, col}, false);
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
    #isBooleanColumn(col) {
        const kind = this.model.column(col).validate?.kind;
        return kind === 'bool' || this.model.columnType(col) === 'boolean';
    }

    // 'date' or 'timestamp' for a column of dates, or null
    #dateKindOf(col) {
        const kind = this.#validatorOf(col)?.kind ?? this.model.column(col).validate?.kind;
        if (kind === 'timestamp') { return 'timestamp'; }
        if (kind === 'date' || this.model.columnType(col) === 'date') { return 'date'; }
        return null;
    }

    // The calendar of a date cell: a zest date-time-picker in a popup next to the cell. A pick
    // writes the cell, as typing does. Escape or a click outside closes it.
    #openDatePicker() {
        if (this.readOnly || this.#edit) { return; }
        const {row, col} = this.#anchor;
        const kind = this.#dateKindOf(col);
        if (!kind) { return; }
        if (this.isLocked(row, col)) { this.#refuse('edit', [{row, col}]); return; }
        this.#closeDatePicker();
        const address = formatAddress(row, col);
        const popup = Object.assign(document.createElement('div'), {className: 'zest-date-popup'});
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-label', `Calendar for ${address}`);
        if (typeof popup.showPopover === 'function') { popup.setAttribute('popover', 'manual'); }
        const picker = createElementOf(DateTimePicker, 'date-time-picker');
        picker.setAttribute('inline', '');
        picker.setAttribute('mode', kind === 'timestamp' ? 'datetime' : 'date');
        picker.setAttribute('label', `Date for ${address}`);
        const locale = this.effectiveLocale;
        if (locale) { picker.setAttribute('locale', locale); }
        const zone = this.#validatorOf(col)?.timeZone;
        if (zone && zone !== 'local') { picker.setAttribute('time-zone', zone); }
        const value = this.model.getValue(row, col);
        if (kind === 'date' && value instanceof SheetDate) {
            picker.setAttribute('value', formatDate(fromDayNumber(value.days)));
        } else if (kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(this.model.getInput(row, col))) {
            picker.setAttribute('value', this.model.getInput(row, col));
        } else if (kind === 'timestamp') {
            const parsed = this.#validatorOf(col)?.parse(this.model.getInput(row, col));
            if (parsed?.valid && parsed.value instanceof Date) { picker.setAttribute('value', wallTime(parsed.value, zone && zone !== 'local' ? zone : undefined)); }
        }
        popup.append(picker);
        this.root.append(popup);
        const state = {popup, picker, row, col, kind};
        this.#datePicker = state;
        picker.addEventListener('date-changed', (e) => {
            const detail = e.detail ?? {};
            let input = '';
            if (kind === 'date') { input = detail.value ?? ''; } else if (detail.date instanceof Date) { input = detail.date.toISOString(); }
            this.#asUser(() => this.#guarded('edit', () => this.model.setCell(address, input)));
            // A date is one pick. A date and time stays open, so that the person can set the time.
            if (kind === 'date') { this.#closeDatePicker(true); }
        });
        popup.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || (e.key === 'Enter' && kind === 'timestamp' && e.ctrlKey)) {
                e.preventDefault();
                e.stopPropagation();
                this.#closeDatePicker(true);
            }
        });
        this.#datePickerOutside = (e) => { if (!e.composedPath().includes(popup)) { this.#closeDatePicker(false); } };
        document.addEventListener('pointerdown', this.#datePickerOutside, true);
        if (popup.showPopover) { try { popup.showPopover(); } catch { /* It is open */ } }
        const anchor = this.#built.active;
        placePopup(popup, anchor, {placement: 'bottom-start'});
        this.#say(`Calendar for ${address}. Press Escape to close it.`);
        requestAnimationFrame(() => {
            if (this.#datePicker !== state) { return; }
            const target = picker.querySelector?.('[aria-selected="true"], [tabindex="0"], button') ?? picker.shadowRoot?.querySelector('[tabindex="0"], button');
            (target ?? picker).focus?.({preventScroll: true});
        });
    }

    #closeDatePicker(focusGrid = false) {
        const state = this.#datePicker;
        if (!state) { return; }
        this.#datePicker = null;
        document.removeEventListener('pointerdown', this.#datePickerOutside, true);
        this.#datePickerOutside = null;
        try { state.popup.hidePopover?.(); } catch { /* It is closed */ }
        state.popup.remove();
        if (focusGrid) { this.#built?.viewport.focus({preventScroll: true}); }
        this.invalidate();
    }

    // The name for the check boxes of a boolean column with `display: 'checkbox'`, or null
    #checkboxOf(col) {
        const info = this.model.column(col);
        if (info.display !== 'checkbox' || !this.#isBooleanColumn(col)) { return null; }
        return info.title || `Column ${columnName(col)}`;
    }

    #toggleBoolean() {
        const {row, col} = this.#anchor;
        if (this.isLocked(row, col)) { this.#refuse('edit', [{row, col}]); return; }
        const value = this.model.getValue(row, col);
        const address = formatAddress(row, col);
        this.#asUser(() => this.#guarded('edit', () => this.model.setCell(address, value === true ? 'FALSE' : 'TRUE')));
        this.#announceSelection();
    }

    #startEdit(mode, text = null, {keepKey = false} = {}) {
        if (this.readOnly) { this.#say('The sheet is read only'); return; }
        const {row, col} = this.#anchor;
        if (this.isLocked(row, col)) { this.#refuse('edit', [{row, col}]); return; }
        this.#reveal(row, col);
        const original = this.#editText(row, col);
        const address = formatAddress(row, col);
        if (!this.#editorCell) {
            this.#editorRow = document.createElement('div');
            this.#editorRow.className = 'zest-editor-row';
            this.#editorRow.setAttribute('role', 'row');
            this.#editorCell = document.createElement(tagFor(SheetCell, 'sheet-cell'));
            this.#editorCell.classList.add('zest-in-sheet');
            this.#editorCell.setAttribute('role', 'gridcell');
            this.#editorRow.append(this.#editorCell);
        }
        const cell = this.#editorCell;
        cell.show(this.model.getCell(row, col));
        cell.classList.add('zest-editor-cell');
        cell.hidden = false;
        this.#built.sizer.append(this.#editorRow);
        this.#edit = {row, col, cell, editor: null, mode, original};
        this.#placeEditor();
        const editor = cell.startEdit(text ?? original, {caret: 'end', label: `Edit ${address}`});
        const inputMode = this.#validatorOf(col)?.inputMode;
        if (inputMode && inputMode !== 'text') { editor.inputMode = inputMode; }
        this.#edit.editor = editor;
        this.#point = null;
        this.#attachTypeahead(this.#edit);
        this.#say(`Editing ${address}`);
        this.#tell('edit', editor.value);
        if (keepKey) { editor.value = ''; }
        this.#updateRefBoxes();
        // A typed first character can start a formula or a match in a list
        if (text) { editor.dispatchEvent(new Event('input', {bubbles: true})); }
    }

    // The list under the editor: the options of a column with a list, or the names of functions
    #attachTypeahead(edit) {
        this.#typeahead?.();
        this.#typeahead = null;
        const options = this.optionsOf(edit.col);
        const title = this.model.column(edit.col).title || columnName(edit.col);
        if (options) {
            this.#typeahead = attachTypeahead(edit.editor, {
                source: options.map(item => item.label),
                autoSelect: true,
                arrowOpens: false,
                enter: 'accept-continue',
                tab: 'accept-continue',
                label: `${title} options`,
            });
        } else {
            this.#typeahead = attachTypeahead(edit.editor, {
                source: functionItems(),
                match: 'prefix',
                query: (field) => functionNameAt(field.value, field.selectionStart),
                autoSelect: true,
                arrowOpens: false,
                enter: 'none',
                tab: 'accept',
                label: 'Functions',
            });
        }
    }

    #endEditor(edit) {
        this.#typeahead?.();
        this.#typeahead = null;
        this.#point = null;
        const text = edit.cell.endEdit();
        edit.cell.hidden = true;
        edit.cell.classList.remove('zest-invalid');
        this.#editorRow.remove();
        this.#updateRefBoxes();
        // The cell under the editor shows the saved value
        this.#dirty ??= new Set();
        this.#dirty.add(edit.row * MAX_COLUMNS + edit.col);
        this.invalidate();
        return text;
    }

    // True when the arrow keys or a click put a reference in the formula, in place of a move.
    // anyMode: also after F2, for a click.
    #pointable({anyMode = false} = {}) {
        const edit = this.#edit;
        if (!edit || (!anyMode && edit.mode !== 'enter')) { return false; }
        const editor = edit.editor;
        const caret = editor.selectionStart;
        if (editor.selectionEnd !== caret) { return false; }
        if (this.#point && caret === this.#point.end) { return true; }
        return canInsertReference(editor.value, caret);
    }

    // Puts the reference to a cell, or to the range from the anchor of the reference, in the formula
    #pointTo(cell, extend) {
        const editor = this.#edit.editor;
        if (!this.#point) {
            const caret = editor.selectionStart;
            this.#point = {start: caret, end: caret, anchor: cell, focus: cell};
        } else if (extend) {
            this.#point.focus = cell;
        } else {
            this.#point.anchor = cell;
            this.#point.focus = cell;
        }
        const point = this.#point;
        const text = formatRange(normalizeRange({top: point.anchor.row, left: point.anchor.col, bottom: point.focus.row, right: point.focus.col}));
        editor.setRangeText(text, point.start, point.end, 'end');
        point.end = point.start + text.length;
        this.#pointWriting = true;
        try {
            editor.dispatchEvent(new Event('input', {bubbles: true}));
        } finally {
            this.#pointWriting = false;
        }
        this.#reveal(point.focus.row, point.focus.col);
        this.#say(`Reference ${text}`);
    }

    #pointMove(dRow, dCol, extend, toEdge) {
        const edit = this.#edit;
        const from = this.#point ? this.#point.focus : {row: edit.row, col: edit.col};
        const raw = toEdge ? this.model.dataEdge(from.row, from.col, dRow, dCol) : {row: from.row + dRow, col: from.col + dCol};
        const to = {
            row: Math.max(0, Math.min(this.model.rowCount - 1, raw.row)),
            col: Math.max(0, Math.min(this.model.columnCount - 1, raw.col)),
        };
        this.#pointTo(to, extend && Boolean(this.#point));
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
                    if (this.#commitEdit() === false) { return; }
                    this.#enterTo(e.shiftKey ? -1 : 1);
                });
                return;
            case 'Tab': {
                e.preventDefault();
                this.#asUser(() => {
                    if (this.#commitEdit() === false) { return; }
                    const next = this.#tabTarget(e.shiftKey ? -1 : 1);
                    if (next) { this.#tabTo(next); }
                });
                return;
            }
            case 'F4': {
                e.preventDefault();
                const editor = edit.editor;
                const cycled = cycleReference(editor.value, editor.selectionStart);
                if (!cycled) { return; }
                editor.value = cycled.text;
                editor.setSelectionRange(cycled.end, cycled.end);
                editor.dispatchEvent(new Event('input', {bubbles: true}));
                return;
            }
            case 'F2':
                e.preventDefault();
                edit.mode = edit.mode === 'enter' ? 'edit' : 'enter';
                this.#say(edit.mode === 'edit' ? 'Edit mode: the arrow keys move in the text' : 'Enter mode: the arrow keys go to another cell');
                return;
        }
        if (NAV[e.key] && !e.altKey && this.#pointable()) {
            // In a formula, after an operator: the arrow keys put a reference to a cell in the formula
            e.preventDefault();
            let [dRow, dCol] = NAV[e.key];
            if (getComputedStyle(this.#built.viewport).direction === 'rtl') { dCol = -dCol; }
            this.#pointMove(dRow, dCol, e.shiftKey, mod);
            return;
        }
        if (NAV[e.key] && edit.mode === 'enter' && !e.shiftKey && !e.altKey && !mod) {
            e.preventDefault();
            const [dRow, dCol] = NAV[e.key];
            this.#asUser(() => {
                if (this.#commitEdit() === false) { return; }
                this.#move({row: this.#anchor.row + dRow, col: this.#anchor.col + dCol}, false);
            });
            return;
        }
        if (!NAV[e.key] && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
            // A key that moves the caret ends the reference that the arrow keys move
            if (['Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) { this.#point = null; }
        }
        if (mod && e.key === ';') {
            e.preventDefault();
            this.#insertToday();
        }
    }

    #commitEdit({fillSelection = false} = {}) {
        const edit = this.#edit;
        if (!edit) { return; }
        // A strict column keeps an invalid edit in the editor, until the person fixes it or presses Escape
        const problem = this.#strictProblem(edit);
        if (problem) { this.#holdEdit(edit, problem); return false; }
        this.#edit = null;
        const text = this.#endEditor(edit);
        const address = formatAddress(edit.row, edit.col);
        if (fillSelection) {
            const range = this.selection;
            const base = this.#inputFor(edit.col, text);
            const changes = [];
            for (let row = range.top; row <= range.bottom; row++) {
                for (let col = range.left; col <= range.right; col++) {
                    const input = base.startsWith('=') ? '=' + shiftFormula(base.slice(1), row - edit.row, col - edit.col) : this.#inputFor(col, text);
                    changes.push({row, col, input});
                }
            }
            this.#guarded('fill', () => this.model.setCells(changes));
        } else if (text !== edit.original) {
            const input = this.#inputFor(edit.col, text);
            if (input !== this.model.getInput(edit.row, edit.col)) { this.#guarded('edit', () => this.model.setCell(address, input)); }
        }
        if (this.#records) { this.#asCode(() => this.#records.editEnded(edit.row)); }
        this.#built.viewport.focus({preventScroll: true});
        this.#tell('select');
        this.invalidate();
    }

    // The inputs of the model are canonical, so a parse needs no locale. `messages` of the sheet win
    // over the shared messages of the validators.
    #parseContext() {
        return this.messages ? {messages: this.messages} : undefined;
    }

    // The message of the validator for the text in the editor of a `strict` column, or null
    #strictProblem(edit) {
        const info = this.model.column(edit.col);
        if (!info.strict) { return null; }
        const text = edit.editor.value;
        // The person did not change the text, or typed a formula, which has no input to check
        if (text === edit.original || text.startsWith('=')) { return null; }
        const validator = this.#validatorOf(edit.col) ?? (this.#records ? this.#implicitValidator(edit.col) : null);
        if (!validator) { return null; }
        const result = validator.parse(this.#inputFor(edit.col, text), this.#parseContext());
        return result.valid ? null : (result.message || 'The value is not valid.');
    }

    #holdEdit(edit, message) {
        edit.editor.setAttribute('aria-invalid', 'true');
        edit.editor.title = message;
        edit.cell.classList.add('zest-invalid');
        edit.editor.focus({preventScroll: true});
        this.#say(`${message} Press Escape to cancel the edit.`);
        this.emit('spreadsheet-edit-refused', {row: edit.row, col: edit.col, address: formatAddress(edit.row, edit.col), text: edit.editor.value, message});
    }

    #cancelEdit() {
        const edit = this.#edit;
        if (!edit) { return; }
        this.#edit = null;
        this.#endEditor(edit);
        if (this.#records) { this.#asCode(() => this.#records.editEnded(edit.row)); }
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
        if (!target || (this.#edit && this.#edit.cell.contains(e.target))) { return; }
        const kind = target.dataset.kind;
        if (this.#edit && kind === 'cell' && this.#pointable({anyMode: true})) {
            // A click in a formula puts a reference to the cell in it. A drag makes a range.
            e.preventDefault();
            const point = this.#cellAtPoint(e.clientX, e.clientY);
            this.#pointTo(point, e.shiftKey && Boolean(this.#point));
            this.#drag = {kind: 'point', pointer: e.pointerId, moved: false};
            this.#edit.editor.focus({preventScroll: true});
            return;
        }
        if (this.#edit && this.#asUser(() => this.#commitEdit()) === false) { e.preventDefault(); return; }
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
        if (drag.kind === 'point') {
            if (this.#edit && this.#point) { this.#pointTo(point, true); }
            return;
        }
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
        if (cut) {
            const probe = {mode: 'probe', locked: (row, col) => this.isLocked(row, col), hits: []};
            this.model.withGuard(probe, () => this.model.clear(this.selection));
            if (probe.hits.length) {
                this.#refuse('cut', probe.hits.map(key => ({row: Math.floor(key / MAX_COLUMNS), col: key % MAX_COLUMNS})));
                cut = false;
            }
        }
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
        // A table of another spreadsheet program has the exact values of its cells
        let table = null;
        try { table = readClipboardTable(e.clipboardData?.getData('text/html') ?? ''); } catch { table = null; }
        this.#asUser(() => this.#paste(text, table));
    }

    // The copy of this sheet keeps its formulas. Text from another program becomes inputs.
    #paste(text, table = null) {
        const target = this.selection;
        const own = this.#clip && (text === this.#clip.text || (text === '' && !table));
        const clip = this.#clip;
        const cut = own ? this.#cut : null;
        if (this.#records) {
            // A paste of many lines makes enough entry rows for them
            const lines = own ? clip.rows.length : (table ? table.length : parseDelimited(text.replace(/\r?\n$/, ''), '\t').length);
            this.#asCode(() => this.#records.ensureRows(target.top + lines));
        }
        const pasted = this.#guarded('paste', () => this.model.batch(() => {
            // A label of an option becomes the value of the option, so that the model keeps values
            // The inputs of a copy in this page are canonical already. A text from another program is in the form of the locale.
            const mapInput = (input, row, col, item) => this.#inputFor(col, input, {raw: Boolean(item?.raw)});
            let range;
            if (own) {
                range = this.model.paste(target, clip, {mapInput: (input, row, col) => this.#inputFor(col, input, {raw: true})});
            } else if (table) {
                const rows = table.map(line => line.map(item => ({input: item.input, raw: item.raw, style: null, type: null})));
                range = this.model.paste(target, {range: {top: target.top, left: target.left}, rows}, {mapInput});
            } else {
                range = this.model.pasteText(target, text, {mapInput});
            }
            if (cut) {
                // A paste after a cut moves the cells: the cut cells outside the new place become empty
                const changes = [];
                for (let row = cut.top; row <= cut.bottom; row++) {
                    for (let col = cut.left; col <= cut.right; col++) {
                        const inside = row >= range.top && row <= range.bottom && col >= range.left && col <= range.right;
                        if (!inside) { changes.push({row, col, input: '', style: null}); }
                    }
                }
                this.model.setCells(changes);
            }
            return range;
        }));
        if (pasted && cut) {
            this.#cut = null;
            this.#clip = null;
        }
        if (pasted) {
            this.#select({row: pasted.top, col: pasted.left}, {row: pasted.bottom, col: pasted.right});
            let message = `Pasted to ${formatRange(pasted)}`;
            if (this.#records && this.pasteSubmits && pasted.bottom > pasted.top) {
                let sent = 0;
                let held = 0;
                this.#asCode(() => {
                    for (let row = pasted.top; row <= pasted.bottom; row++) {
                        const state = this.#records.stateOf(row);
                        if (state !== 'draft' && state !== 'changed' && state !== 'error') { continue; }
                        if (this.#records.consider(row, 'paste')) { sent++; } else { held++; }
                    }
                });
                message += `. ${sent} ${sent === 1 ? 'row' : 'rows'} sent${held ? `, ${held} with problems` : ''}`;
            }
            this.#say(message);
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
    detectCsvFormat, readClipboardTable, toCanonicalInput as canonicalCellInput, toLocalInput as localCellInput,
};
