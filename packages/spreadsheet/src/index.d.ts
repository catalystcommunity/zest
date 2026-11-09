// Type declarations for @catalystcommunity/spreadsheet. The source is JavaScript; keep this
// file in step with src/*.js. __tests__/types.spec.js checks that each export has a declaration.
import { BaseComponent, type Removal } from '@catalystcommunity/base-components';
import type { Action } from '@catalystcommunity/actions';

// Addresses. Rows and columns start at 0.

export interface CellPosition { row: number; col: number; }
export interface CellAddress extends CellPosition { rowAbs: boolean; colAbs: boolean; }
export interface CellRange { top: number; left: number; bottom: number; right: number; }
/** A range, or text such as `'B2:C4'` or `'B2'`. */
export type RangeLike = CellRange | string;

export declare const SHEET_MAX_ROWS: number;
export declare const SHEET_MAX_COLUMNS: number;
/** 0 gives 'A', 26 gives 'AA'. */
export declare function sheetColumnName(col: number): string;
export declare function sheetColumnIndex(name: string): number;
export declare function formatCellAddress(row: number, col: number, options?: {rowAbs?: boolean; colAbs?: boolean}): string;
/** 'B3' or '$B$3'. Null if the text is not an address in the sheet. */
export declare function parseCellAddress(text: string): CellAddress | null;
export declare function parseCellRange(text: string): CellRange | null;
/** `bottom` and `right` default to `top` and `left`. */
export declare function normalizeCellRange(range: {top: number; left: number; bottom?: number; right?: number}): CellRange;
export declare function formatCellRange(range: CellRange): string;

// Values

export type SheetErrorCode = '#DIV/0!' | '#REF!' | '#NAME?' | '#VALUE!' | '#CYCLE!' | '#NUM!' | '#N/A' | '#ERROR!';

/** An error value. It goes through each calculation that uses it. */
export declare class SheetError {
    constructor(code: SheetErrorCode | string, message?: string);
    code: SheetErrorCode | string;
    message: string;
    toString(): string;
}

/** A date: the number of days from 1970-01-01. It acts as a number in a calculation. */
export declare class SheetDate {
    constructor(days: number);
    days: number;
    valueOf(): number;
}

export type SheetValue = number | string | boolean | SheetDate | SheetError | null | undefined;
export type SheetType = 'auto' | 'text' | 'number' | 'currency' | 'percent' | 'date' | 'boolean';
export declare const SHEET_TYPES: SheetType[];

// Formulas

export interface FormulaToken {
    type: 'space' | 'string' | 'error' | 'ref' | 'number' | 'name' | 'op' | 'bad';
    text: string;
    /** The index in the text. */
    at: number;
}

export type FormulaRefNode = {t: 'ref'} & CellAddress;
export type FormulaNode =
    | {t: 'num'; v: number}
    | {t: 'str'; v: string}
    | {t: 'bool'; v: boolean}
    | {t: 'blank'}
    | {t: 'err'; code: string; message?: string}
    | {t: 'name'; name: string}
    | FormulaRefNode
    | {t: 'range'; from: FormulaRefNode; to: FormulaRefNode}
    | {t: 'neg'; a: FormulaNode}
    | {t: 'pct'; a: FormulaNode}
    | {t: 'call'; name: string; args: FormulaNode[]}
    | {t: 'bin'; op: string; a: FormulaNode; b: FormulaNode};

/** A reference or a range in a function call. */
export interface FormulaRangeArgument { range: CellRange; values: SheetValue[]; }
export type FormulaArgument = SheetValue | FormulaRangeArgument;
/** Gets an array of arguments. Returns a value or a `SheetError`. */
export type SheetFunction = (args: FormulaArgument[]) => SheetValue;
/** The functions of the formulas. Add a function with an upper-case name. */
export declare const SHEET_FUNCTIONS: Record<string, SheetFunction>;

export interface FormulaContext {
    value(row: number, col: number): SheetValue;
    /** The values of a range, row by row. */
    values(range: CellRange): SheetValue[];
}

export declare function tokenizeFormula(text: string): FormulaToken[];
/** Reads a formula with no "=". A formula that does not parse gives `{t: 'err', code: '#ERROR!'}`. */
export declare function parseFormula(text: string): FormulaNode;
export declare function evaluateFormula(tree: FormulaNode, context: FormulaContext): SheetValue | FormulaRangeArgument;
/** Each cell and range that a tree reads. */
export declare function formulaReferences(tree: FormulaNode, found?: {cells: CellPosition[]; ranges: CellRange[]}): {cells: CellPosition[]; ranges: CellRange[]};
/** A copy to a place that is `dRows` down and `dCols` right. An absolute part ($) stays. */
export declare function shiftFormula(text: string, dRows: number, dCols: number): string;
/** Rows or columns were added (count > 0) or removed (count < 0) at `index`. A reference to a removed cell becomes #REF!. */
export declare function adjustFormulaReferences(text: string, axis: 'row' | 'col', index: number, count: number): string;

export interface CellInputResult {
    value?: SheetValue;
    /** The type that the input showed, or null for an empty input or a formula. */
    type: SheetType | null;
    formula?: FormulaNode;
    /** The currency symbol of the input, for example '$'. */
    symbol?: string;
}

/** Reads what a user typed. An apostrophe at the start keeps the text. */
export declare function readCellInput(input: string | null | undefined, type?: SheetType): CellInputResult;
export declare function parseDelimitedText(text: string, delimiter: string): string[][];
export declare function toDelimitedText(rows: readonly (readonly unknown[])[], delimiter: string): string;

// Model

export interface CellStyle {
    bold?: boolean;
    italic?: boolean;
    align?: 'start' | 'center' | 'end';
}

export interface SheetColumn {
    title?: string;
    type?: SheetType;
    decimals?: number;
    /** The default is `USD`. */
    currency?: string;
    grouping?: boolean;
    dateStyle?: 'medium' | 'short' | 'long' | 'iso' | 'full';
    /** CSS pixels. */
    width?: number;
}

export interface SheetCellInfo {
    address: string;
    row: number;
    col: number;
    input: string;
    formula: boolean;
    type: SheetType;
    value: SheetValue;
    display: string;
    style: CellStyle | null;
    error: SheetError | null;
}

/** A change for `setCells`: an address, or a row and a column. */
export type SheetCellChange = ({address: string} | CellPosition) & {
    input?: string | number | null;
    style?: CellStyle | null;
    type?: SheetType | null;
};

export interface SheetChange {
    address: string;
    row: number;
    col: number;
    oldInput: string;
    newInput: string;
}

export interface SheetModelChangeDetail {
    changes: SheetChange[];
    /** The keys (`row * SHEET_MAX_COLUMNS + col`) of each cell to show again, also recalculated cells. */
    keys: Set<number>;
    cells: Set<number>;
    history: {canUndo: boolean; canRedo: boolean};
    /** The columns that `setColumn` changed. */
    columns?: number[];
    /** Rows or columns that were added or removed. */
    structure?: {axis: 'row' | 'col'; index: number; count: number};
    loaded?: boolean;
}

export interface SheetData {
    rows?: number | (readonly unknown[])[];
    columns?: number | SheetColumn[];
    columnCount?: number;
    /** `{A1: 'text'}` or `{A1: {input, style, type}}`. */
    cells?: Record<string, string | number | {input?: string | number; style?: CellStyle | null; type?: SheetType | null}> | null;
    /** Rows of inputs, in place of `rows` as an array. */
    data?: (readonly unknown[])[] | null;
}

export interface SheetJSON {
    rows: number;
    columns: number | SheetColumn[];
    columnCount: number;
    cells: Record<string, {input: string; style?: CellStyle; type?: SheetType}>;
}

/** A copy of a range: the inputs for a paste in a sheet, and text with tabs for other programs. */
export interface SheetClip {
    range: {top: number; left: number; bottom?: number; right?: number};
    rows: {input: string; style: CellStyle | null; type: SheetType | null; display?: string}[][];
    text?: string;
}

export interface SheetSummary {
    count: number;
    numbers: number;
    sum: number;
    average: number | null;
}

export interface SheetModelEventMap {
    change: CustomEvent<SheetModelChangeDetail>;
}

/** The cells, the formulas, and the undo steps, with no DOM. Two sheets can show one model. */
export declare class SheetModel extends EventTarget {
    /** `columns` is a count or a list of column formats. */
    constructor(options?: {rows?: number; columns?: number | SheetColumn[]; locale?: string});
    locale: string | undefined;
    /** The count of cells that the last change recalculated. */
    lastRecalculated?: number;
    readonly rowCount: number;
    readonly columnCount: number;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly cellCount: number;

    column(col: number): SheetColumn;
    /** Changes the format, the title, or the width of a column. */
    setColumn(col: number, changes: SheetColumn): void;
    getCell(address: string): SheetCellInfo;
    getCell(row: number, col: number): SheetCellInfo;
    getValue(address: string): SheetValue;
    getValue(row: number, col: number): SheetValue;
    getInput(address: string): string;
    getInput(row: number, col: number): string;
    /** The type of the cell, then of the column, then what the input showed. */
    typeAt(row: number, col: number): SheetType;
    /** The text that a cell shows. */
    format(value: SheetValue, type: SheetType, cell?: object | null, col?: number): string;
    /** Puts many changes into one undo step and one change event. */
    batch<T>(fn: () => T): T;
    setCell(address: string, input: string | number | null | undefined): void;
    setCells(changes: readonly SheetCellChange[]): void;
    /** Merges a style into each cell. A value of null or false removes that part. */
    setStyle(range: RangeLike, style: {[K in keyof CellStyle]?: CellStyle[K] | null}): void;
    setType(range: RangeLike, type: SheetType | null): void;
    clear(range: RangeLike): void;
    /** Returns false when there is no step. */
    undo(): boolean;
    redo(): boolean;
    insertRows(index: number, count?: number): void;
    deleteRows(index: number, count?: number): void;
    insertColumns(index: number, count?: number): void;
    deleteColumns(index: number, count?: number): void;
    copy(range: RangeLike): Required<SheetClip>;
    /** Relative references move with the cells. A copy of one cell fills all of a larger target. Returns the changed range. */
    paste(target: RangeLike, clip: SheetClip): CellRange;
    /** Pastes text with tabs between cells and lines between rows. */
    pasteText(target: RangeLike, text: string): CellRange;
    /** Copies the top row to the other rows, or the first column to the other columns. */
    fill(range: CellRange, direction?: 'down' | 'right'): void;
    /** The last row and column with content, or -1. */
    readonly usedRange: CellRange;
    isEmpty(row: number, col: number): boolean;
    /** Where Ctrl and an arrow key go. */
    dataEdge(row: number, col: number, dRow: number, dCol: number): CellPosition;
    summary(range: CellRange): SheetSummary;
    /** `values: false` gives the inputs, so that formulas stay formulas. */
    toCSV(options?: {range?: CellRange | null; values?: boolean}): string;
    /** Reads CSV at a cell, as one undo step. */
    fromCSV(text: string, at?: string): void;
    toJSON(): SheetJSON;
    /** Replaces all of the data. A load is not an undo step. */
    load(data?: SheetData): void;

    addEventListener<K extends keyof SheetModelEventMap>(type: K, listener: (this: SheetModel, event: SheetModelEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof SheetModelEventMap>(type: K, listener: (this: SheetModel, event: SheetModelEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
}

// Elements

/**
 * A cell. The sheet uses it, and it can also stand alone. An editable cell that stands alone
 * sends `change` (a `CustomEvent` with `{input}`) when Enter saves an edit.
 */
export declare class SheetCell extends BaseComponent {
    input: string;
    /** Attribute `type`. */
    cellType: SheetType;
    editable: boolean;
    readonly editing: boolean;
    readonly editor: HTMLTextAreaElement | null;
    /** The sheet calls this. It changes the DOM only when the text or the classes change. */
    show(cell: SheetCellInfo): void;
    /** Puts an editor in the cell. */
    startEdit(text: string, options?: {caret?: 'end' | 'start' | 'select'; label?: string}): HTMLTextAreaElement;
    /** Removes the editor and gives its text, or null. */
    endEdit(): string | null;
}

/** Why a `watch` callback runs. With `edit`, `text` is the text of the editor. */
export type SheetWatchReason = 'select' | 'change' | 'edit';

/** Shows and changes the active cell of a sheet. */
export declare class FormulaBar extends BaseComponent {
    /** The id of the sheet. */
    for: string;
    /** The sheet. The default is the element with the id `for`. */
    get sheet(): SpreadSheet | null;
    set sheet(element: SpreadSheet | null);
    update(reason?: SheetWatchReason, text?: string | null): void;
}

export type SpreadSheetActionId = 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'clear' | 'fillDown' | 'fillRight'
    | 'bold' | 'italic' | 'today' | 'selectAll' | 'insertRow' | 'deleteRow' | 'insertColumn' | 'deleteColumn';

export interface SpreadSheetChangeDetail { changes: SheetChange[]; }
export interface SpreadSheetSelectDetail {
    range: CellRange;
    /** The range as text, for example 'B2:C4'. */
    address: string;
    /** The address of the active cell. */
    active: string;
}

/** A grid of cells with formulas. It shows a `SheetModel`. */
export declare class SpreadSheet extends BaseComponent {
    /** The size of a new model. */
    rows: number;
    columns: number;
    /** Attribute `readonly`. */
    readOnly: boolean;
    /** Attribute `formula-bar`. */
    formulaBar: boolean;
    locale: string;
    /** The accessible name of the grid. */
    label: string;

    /** The commands of the sheet. A menu or a toolbar can use the same actions. */
    actions: Record<SpreadSheetActionId, Action>;
    /** Set it to show a different model. */
    model: SheetModel;

    getCell(address: string): SheetCellInfo;
    getCell(row: number, col: number): SheetCellInfo;
    getValue(address: string): SheetValue;
    getValue(row: number, col: number): SheetValue;
    setCell(address: string, input: string | number | null | undefined): void;
    setCells(changes: readonly SheetCellChange[]): void;
    load(data?: SheetData): void;
    toJSON(): SheetJSON;
    toCSV(options?: {range?: CellRange | null; values?: boolean}): string;
    fromCSV(text: string, at?: string): void;
    insertRows(index: number, count?: number): void;
    deleteRows(index: number, count?: number): void;
    insertColumns(index: number, count?: number): void;
    deleteColumns(index: number, count?: number): void;
    undo(): boolean;
    redo(): boolean;

    /** Set it with a range, or with text such as 'B2:C4'. */
    get selection(): CellRange;
    set selection(value: RangeLike);
    readonly activeAddress: string;
    readonly editing: boolean;
    /** Calls back after each change of the selection, the data, or the editor text. */
    watch(callback: (reason: SheetWatchReason, text: string | null) => void): Removal;
    /** A change as if the user made it. It sends events. */
    writeByUser(address: string, input: string): void;
    selectByUser(range: CellRange): void;
    focus(options?: FocusOptions): void;
    widthOf(col: number): number;
    /** CSS pixels. */
    setColumnWidth(col: number, width: number): void;
}

export declare class ShadowSpreadSheet extends SpreadSheet {
    shadow: ShadowRoot;
}

/** Defines the default tags that have no tag yet. */
export declare function defineSpreadsheet(): void;

declare global {
    interface HTMLElementTagNameMap {
        'spread-sheet': SpreadSheet;
        'shadow-spread-sheet': ShadowSpreadSheet;
        'sheet-cell': SheetCell;
        'formula-bar': FormulaBar;
    }
    interface HTMLElementEventMap {
        'spreadsheet-change': CustomEvent<SpreadSheetChangeDetail>;
        'spreadsheet-select': CustomEvent<SpreadSheetSelectDetail>;
    }
}
