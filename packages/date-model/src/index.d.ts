// Type declarations for @catalystcommunity/date-model. The source is JavaScript; keep this file in
// step with src/index.js. __tests__/types.spec.js checks that each export has a declaration.
//
// A value is a set of wall clock parts, not a Date. `month` is 1 to 12. A kind tells which parts
// are in the value.

export type Kind = 'year' | 'month' | 'week' | 'date' | 'time' | 'datetime';
export type Selection = 'single' | 'range' | 'multiple';
/** The text form of `formatDisplay`. */
export type DisplayFormat = 'iso' | 'short' | 'medium' | 'long' | 'full';

export interface YearParts { year: number; }
export interface MonthParts { year: number; month: number; }
export interface DateParts { year: number; month: number; day: number; }
export interface TimeParts { hour: number; minute: number; second: number; }
export interface DateTimeParts extends DateParts, TimeParts {}
/** Any set of parts. A missing part counts as its lowest value. */
export interface WallClockParts { year?: number; month?: number; day?: number; hour?: number; minute?: number; second?: number; }

/** The parts that each kind holds. A week is its Monday. */
export interface KindParts {
    year: YearParts;
    month: MonthParts;
    week: DateParts;
    date: DateParts;
    time: TimeParts;
    datetime: DateTimeParts;
}
export type PartsOf<K extends Kind> = KindParts[K];

// Shared Intl formatters, one for each locale and options. Use these, not `new Intl.*`.
export declare function dateFormat(locale?: string | string[], options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat;
export declare function numberFormat(locale?: string | string[], options?: Intl.NumberFormatOptions): Intl.NumberFormat;
export declare function relativeFormat(locale?: string | string[], options?: Intl.RelativeTimeFormatOptions): Intl.RelativeTimeFormat;
export declare function pluralRules(locale?: string | string[], options?: Intl.PluralRulesOptions): Intl.PluralRules;

/** `month` is 1 to 12. */
export declare function daysInMonth(year: number, month: number): number;
export declare function addDays<T extends WallClockParts>(parts: T, days: number): T & DateParts;
/** The day stays in the month: one month after January 31 is the last day of February. */
export declare function addMonths<T extends MonthParts & {day?: number}>(parts: T, months: number): T & DateParts;
/** 0 is Sunday. */
export declare function weekday(parts: DateParts): number;
/** Days since 1970-01-01. */
export declare function dayNumber(parts: DateParts): number;
export declare function fromDayNumber(number: number): DateParts;
/** Negative when `b` is before `a`. */
export declare function daysBetween(a: DateParts, b: DateParts): number;
/** `firstDay` is 0 for Sunday, as `firstDayOfWeek` gives. */
export declare function startOfWeek(parts: DateParts, firstDay?: number): DateParts;
/** Negative, zero, or positive. Compares only the parts of the kind. */
export declare function compare(a: WallClockParts, b: WallClockParts, kind: Kind): number;
export declare function isoWeek(parts: DateParts): {year: number; week: number};
/** The Monday of the ISO week. */
export declare function fromIsoWeek(year: number, week: number): DateParts;
/** Reduces parts to what the kind holds. A week becomes its Monday. */
export declare function truncate<K extends Kind>(parts: WallClockParts, kind: K): PartsOf<K>;

/** `YYYY-MM-DD`. */
export declare function formatDate(parts: DateParts): string;
/** `HH:MM`, or `HH:MM:SS` with seconds or a second that is not zero. */
export declare function formatTime(parts: Partial<TimeParts>, includeSeconds?: boolean): string;
/** The ISO 8601 text of the kind. */
export declare function formatValue(parts: WallClockParts, kind: Kind, includeSeconds?: boolean): string;

/** The wall clock at an instant, in a time zone, or in the zone of this browser. */
export declare function fromInstant(date: Date, timeZone?: string): DateTimeParts;
/** The instant of a wall clock. A time in a gap moves forward. A time in an overlap takes the first. */
export declare function toInstant(parts: WallClockParts, timeZone?: string): Date;

export interface ParseValueOptions {
    /** The zone for text with an offset. */
    timeZone?: string;
    /** A date alone is 23:59:59 for a datetime. */
    endOfDay?: boolean;
}
/** Strict ISO 8601. Returns null for text that the kind cannot use. */
export declare function parseValue<K extends Kind>(text: string | null | undefined, kind: K, options?: ParseValueOptions): PartsOf<K> | null;
/** A range is `start/end`, multiple values are `a,b,c`. Returns null when a part cannot be read, and [] for empty text. */
export declare function parseSelection<K extends Kind>(text: string | null | undefined, kind: K, selection?: Selection, options?: ParseValueOptions): PartsOf<K>[] | null;
export declare function formatSelection(values: WallClockParts[], kind: Kind, selection?: Selection, includeSeconds?: boolean): string;

/** 0 is Sunday. Unknown locales give 0. */
export declare function firstDayOfWeek(locale: string): number;
export declare function usesTwentyFourHours(locale?: string): boolean;
/** Twelve names. Index 0 is January. */
export declare function monthNames(locale?: string, style?: 'long' | 'short' | 'narrow'): string[];
/** Seven names. Index 0 is Sunday. */
export declare function weekdayNames(locale?: string, style?: 'long' | 'short' | 'narrow'): string[];
/** A number in the digits of the locale, with at least `width` digits and no grouping. */
export declare function formatNumber(value: number, locale?: string, width?: number): string;

export interface DisplayOptions {
    locale?: string;
    format?: DisplayFormat;
    /** The default comes from the locale. */
    twentyFourHours?: boolean;
    includeSeconds?: boolean;
}
/** The text that a person reads. */
export declare function formatDisplay(parts: WallClockParts, kind: Kind, options?: DisplayOptions): string;
/** The words for AM and PM that `parseText` accepts. */
export declare function dayPeriods(locale?: string): {am: string[]; pm: string[]};

export interface ParseTextOptions {
    locale?: string;
    /** The wall clock now. Words such as "tomorrow" and a date with no year need it. */
    reference?: WallClockParts;
    timeZone?: string;
}
/** Reads what a person typed: ISO 8601, the display text of the locale, numbers, month names, times, and words. */
export declare function parseText<K extends Kind>(text: string | null | undefined, kind: K, options?: ParseTextOptions): PartsOf<K> | null;

/** What `getDayInfo` can return for a day. */
export interface DayInfo {
    disabled?: boolean;
    /** Classes for the day, with spaces between them. */
    className?: string;
    title?: string;
    /** Text for a screen reader. */
    label?: string;
    /** A small text on the day. */
    badge?: string | number;
}
export type IsDateDisabled = (isoDate: string, parts: DateParts) => boolean;
/** `day` is null in `time` mode. */
export type IsTimeDisabled = (isoTime: string, parts: TimeParts, day: DateParts | null) => boolean;
export type GetDayInfo = (isoDate: string, parts: DateParts) => DayInfo | null | undefined | void;

/** The options of `buildRules`. Text forms are the same as the attributes of the picker. */
export interface RuleOptions {
    min?: string | null;
    max?: string | null;
    minTime?: string | null;
    maxTime?: string | null;
    /** Dates and ranges: `2024-03-10,2024-03-20/2024-03-22`, or an array of them. */
    disabledDates?: string | string[] | null;
    /** 0 is Sunday: `0,6`, or an array. */
    disabledWeekdays?: string | Array<number | string> | null;
    isDateDisabled?: IsDateDisabled;
    isTimeDisabled?: IsTimeDisabled;
    getDayInfo?: GetDayInfo;
    hourStep?: number | string | null;
    minuteStep?: number | string | null;
    secondStep?: number | string | null;
    minRangeDays?: number | string | null;
    maxRangeDays?: number | string | null;
    allowDisabledInRange?: boolean;
    timeZone?: string;
}
export interface Rules {
    kind: Kind;
    min: WallClockParts | null;
    max: WallClockParts | null;
    minTime: TimeParts | null;
    maxTime: TimeParts | null;
    /** First and last day of each disabled range. */
    disabledDates: Array<[DateParts, DateParts]>;
    disabledWeekdays: Set<number>;
    isDateDisabled?: IsDateDisabled;
    isTimeDisabled?: IsTimeDisabled;
    getDayInfo?: GetDayInfo;
    hourStep: number;
    minuteStep: number;
    secondStep: number;
    minRangeDays: number;
    maxRangeDays: number;
    allowDisabledInRange: boolean;
}
export type ValueProblem = 'before-min' | 'after-max' | 'disabled-date' | 'disabled-time' | 'step';
export type RangeProblem = 'range-too-short' | 'range-too-long' | 'disabled-in-range';

export declare function buildRules(options: RuleOptions, kind: Kind): Rules;
export declare function dayIsDisabled(parts: DateParts, rules: Rules): boolean;
/** For the month and year views: only the minimum and the maximum count. */
export declare function periodIsDisabled(parts: WallClockParts, kind: Kind, rules: Rules): boolean;
/** `day` matters for a datetime, because the minimum and the maximum are on one day only. */
export declare function timeIsDisabled(time: TimeParts, day: DateParts | null | undefined, rules: Rules): boolean;
export declare function stepIsWrong(time: Partial<TimeParts>, rules: Pick<Rules, 'hourStep' | 'minuteStep' | 'secondStep'>): boolean;
/** Why a value is not allowed, or null. */
export declare function valueProblem(parts: WallClockParts, rules: Rules): ValueProblem | null;
/** Why two values cannot be a range, or null. */
export declare function rangeProblem(start: DateParts, end: DateParts, rules: Rules): RangeProblem | null;
/** The names of AM and PM, for a select. */
export declare function meridiemNames(locale?: string): {am: string; pm: string};
