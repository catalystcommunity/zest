// Type declarations for @catalystcommunity/date-time-picker. The source is JavaScript; keep this
// file in step with src/index.js. __tests__/types.spec.js checks that each export has a declaration.
import { DataComponent } from '@catalystcommunity/base-components';
import type { DateTimeParts, DisplayFormat, GetDayInfo, IsDateDisabled, IsTimeDisabled, Kind, Selection, ValueProblem, RangeProblem, WallClockParts } from '@catalystcommunity/date-model';

export type { DayInfo } from '@catalystcommunity/date-model';

export type PickerMode = Kind;
export type PickerSelection = Selection;
/** Why the picker refused a selection or typed text. */
export type PickerInvalidReason = 'unreadable' | ValueProblem | RangeProblem;
/** Why the value is not valid. */
export type PickerProblem = 'value-missing' | ValueProblem | RangeProblem;

export interface PickerLabels {
    previousMonth: string; nextMonth: string;
    previousYear: string; nextYear: string;
    previousYears: string; nextYears: string;
    chooseMonth: string; chooseYear: string;
    open: string; dialog: string;
    hour: string; minute: string; second: string; period: string;
    start: string; end: string; week: string; clear: string; done: string;
    timeZone: string; localTimeZone: string;
}

export interface TimeSlot {
    /** `HH:MM` or `HH:MM:SS`. */
    value: string;
    label?: string;
    disabled?: boolean;
}

export interface PickerPreset {
    label: string;
    /** ISO text, or a function that gets the wall clock now and returns ISO text. */
    value: string | ((now: DateTimeParts) => string);
}

/**
 * The options of `updateConfig` and of a registry `pickerConfig`. An attribute wins over the same
 * option here. Text options take the same text as their attributes.
 */
export interface PickerConfig {
    /** Sets the value, as the `value` property does. */
    value?: string;
    mode?: PickerMode;
    selection?: PickerSelection;
    min?: string;
    max?: string;
    minTime?: string;
    maxTime?: string;
    hourStep?: number | string;
    minuteStep?: number | string;
    secondStep?: number | string;
    disabledDates?: string | string[];
    disabledWeekdays?: string | Array<number | string>;
    firstDayOfWeek?: number | string;
    locale?: string;
    twentyFourHourFormat?: boolean | string;
    includeSeconds?: boolean | string;
    format?: DisplayFormat;
    timeZone?: string;
    timeZoneSelectable?: boolean | string;
    timeView?: 'selects' | 'list';
    timeSlots?: string | Array<string | TimeSlot>;
    defaultTime?: string;
    months?: number | string;
    showWeekNumbers?: boolean | string;
    fixedWeeks?: boolean | string;
    inline?: boolean | string;
    clearable?: boolean | string;
    showNow?: boolean | string;
    minRangeDays?: number | string;
    maxRangeDays?: number | string;
    allowDisabledInRange?: boolean | string;
    placeholder?: string;
    label?: string;
    initialDate?: string;
    noTyping?: boolean | string;
    required?: boolean | string;
    disabled?: boolean | string;
    readonly?: boolean | string;
    isDateDisabled?: IsDateDisabled;
    isTimeDisabled?: IsTimeDisabled;
    getDayInfo?: GetDayInfo;
    presets?: PickerPreset[];
    /** Your text for the input. */
    formatDisplay?: (isoValue: string, parts: WallClockParts) => string | null | undefined;
    /** Reads typed text. Return ISO text, or nothing to use the built-in reader. */
    parseText?: (text: string) => string | null | undefined;
    labels?: Partial<PickerLabels>;
    validationMessages?: Partial<Record<PickerProblem, string>>;
}

/** In the detail of each picker event. */
export interface PickerEventBase {
    instanceId: string;
    name: string | null;
    mode: PickerMode;
    selection: PickerSelection;
}
export interface DateChangedDetail extends PickerEventBase {
    value: string;
    /** The first value as an instant, or null. */
    date: Date | null;
    dates: Date[];
    /** For a range only. */
    start: Date | null;
    end: Date | null;
    parts: WallClockParts[];
    timeZone: string | null;
}
export interface DateRangeStartDetail extends PickerEventBase {
    value: string;
    date: Date;
}
export interface DateInvalidDetail extends PickerEventBase {
    text: string;
    reason: PickerInvalidReason;
}
export interface DateViewChangedDetail extends PickerEventBase {
    year: number;
    month: number;
    /** `YYYY-MM-DD`: the first and last day of the months that show. */
    firstDate: string;
    lastDate: string;
    /** `YYYY-MM-DD`: the first and last day of the grid, with days of other months. */
    firstVisibleDate: string;
    lastVisibleDate: string;
}
export interface DateNowDetail extends PickerEventBase {
    /** The exact moment. The value can be rounded to the steps. */
    date: Date;
    parts: DateTimeParts;
    value: string;
}
export interface DateTimeZoneChangedDetail extends PickerEventBase {
    timeZone: string | null;
}
export type DatePickerToggleDetail = PickerEventBase;

export default class DateTimePicker extends DataComponent {
    static formAssociated: boolean;
    input: HTMLInputElement;
    /** The panel. */
    picker: HTMLDivElement;
    toggle: HTMLButtonElement;

    /** The values in effect, from the attribute or the config. */
    readonly mode: PickerMode;
    readonly selection: PickerSelection;
    readonly locale: string;
    readonly timeZone: string | undefined;
    /** The first month that shows. */
    readonly viewMonth: {year: number; month: number};

    /** The value as ISO text. A set sends no event. Text that the picker cannot read clears the value. */
    get value(): string;
    set value(text: string | null | undefined);
    get valueAsDate(): Date | null;
    set valueAsDate(date: Date | null | undefined);
    /** Each value as an instant. A time alone is on today. */
    readonly dates: Date[];
    readonly userSelected: boolean;
    /** The first value, or else the date that the panel starts at. A set changes where the panel starts. */
    selectedDate: Date;

    get name(): string | null;
    set name(value: string);
    disabled: boolean;
    required: boolean;
    readOnly: boolean;
    readonly form: HTMLFormElement | null;
    readonly validity: ValidityState | undefined;
    readonly validationMessage: string;
    readonly willValidate: boolean;
    /** The reason that the value is not valid, or null. */
    readonly validationProblem: PickerProblem | null;
    checkValidity(): boolean;
    reportValidity(): boolean;
    setCustomValidity(message: string): void;
    formResetCallback(): void;
    formDisabledCallback(disabled: boolean): void;
    formStateRestoreCallback(state: unknown): void;

    /** Merges options and draws again. */
    updateConfig(partial?: PickerConfig): void;
    openPicker(): void;
    closePicker(): void;
    /** Moves the view by a count of months. */
    changeMonth(offset: number): void;
    clearDate(): void;
    /** Selects the wall clock of this instant, as a person does. */
    selectDate(date: Date): void;
    initInput(): void;
    initPicker(): void;
}

export declare class ShadowDateTimePicker extends DateTimePicker {
    shadow: ShadowRoot;
}

export { DateTimePicker };

declare global {
    interface HTMLElementEventMap {
        'date-changed': CustomEvent<DateChangedDetail>;
        'date-range-start': CustomEvent<DateRangeStartDetail>;
        'date-invalid': CustomEvent<DateInvalidDetail>;
        'date-view-changed': CustomEvent<DateViewChangedDetail>;
        'date-now': CustomEvent<DateNowDetail>;
        'date-time-zone-changed': CustomEvent<DateTimeZoneChangedDetail>;
        'date-picker-open': CustomEvent<DatePickerToggleDetail>;
        'date-picker-close': CustomEvent<DatePickerToggleDetail>;
    }
    interface HTMLElementTagNameMap {
        'date-time-picker': DateTimePicker;
    }
}
