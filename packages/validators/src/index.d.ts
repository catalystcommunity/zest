// Type declarations for @catalystcommunity/validators. The source is JavaScript; keep this
// file in step with src/index.js. __tests__/types.spec.js checks that each export has a declaration.

export type ValidationResult<T> =
    | {valid: true; value: T | null}
    | {valid: false; message: string; reason: string};

export type ValidatorKind = 'int' | 'uint' | 'float' | 'decimal' | 'text' | 'bool' | 'bytes' | 'timestamp' | 'date' | 'uuid' | 'enum' | 'any';

/** The context of a parse or a format. */
export interface ValidationContext {
    /** The locale of the text, for example 'de-DE': its decimal sign, its group sign, and its order of dates. With no locale, numbers are in the 1,234.5 form and dates are ISO. */
    locale?: string | null;
    /** Messages that win over the shared messages, by reason. The messages of the validator win over these. */
    messages?: MessageTable | null;
    /** The time zone of a timestamp with no offset, when the validator has none: 'local' or a name such as 'Europe/Berlin'. */
    timeZone?: string | null;
}

export type MessageTable = Partial<Record<string, string | ((...args: any[]) => string)>>;

export interface Validator<T = unknown> {
    readonly kind: ValidatorKind;
    readonly required: boolean;
    /** A hint for the keyboard of a phone: 'numeric', 'decimal', or 'text'. */
    readonly inputMode: string;
    /** Set for a CSIL type that can be null. */
    readonly nullable?: boolean;
    /** The options of `oneOf`. */
    readonly options?: readonly OneOfOption<T>[];
    /** The label of a value of `oneOf`. */
    labelOf?(value: T): string;
    /** Reads the text that a person typed. An empty text is valid and null, unless `required`. */
    parse(input: string | null | undefined, context?: ValidationContext): ValidationResult<T>;
    /** Checks a value that is already typed. A text goes through `parse`. */
    check(value: unknown): ValidationResult<T>;
    /** The text for a value, which `parse` with the same context reads back to the same value. With a locale, a number has the decimal sign of the locale and no group signs. */
    format(value: T | null | undefined, context?: ValidationContext): string;
}

export interface OneOfOption<T = unknown> {
    value: T;
    label: string;
}

export interface BaseOptions<T> {
    /** An empty input is invalid. */
    required?: boolean;
    /** Runs after the other checks. Return a message for a problem, or a false value. */
    test?: (value: T) => string | boolean | null | undefined;
    /** Messages in place of the defaults, by reason. A message for a limit can be a function of the limit. */
    messages?: MessageTable;
}

export interface NumberLimits<N> {
    min?: N;
    max?: N;
    /** The value must be more than this. */
    above?: N;
    /** The value must be less than this. */
    below?: N;
    equal?: N;
    notEqual?: N;
}

export interface IntOptions extends BaseOptions<number>, NumberLimits<number | bigint> {
    /** The value is a bigint, and it can be outside the safe range of a number. */
    bigint?: false;
}
export interface BigIntOptions extends BaseOptions<bigint>, NumberLimits<number | bigint> {
    bigint: true;
}
export interface FloatOptions extends BaseOptions<number>, NumberLimits<number> {
    /** `false` also accepts Infinity and -Infinity. The default is true. */
    finite?: boolean;
}
export interface DecimalOptions extends BaseOptions<string>, Omit<NumberLimits<number>, 'equal' | 'notEqual'> {
    /** The most decimals. The value then has exactly this many. */
    scale?: number;
}
export interface TextOptions extends BaseOptions<string> {
    /** In Unicode code points. */
    minLength?: number;
    maxLength?: number;
    /** Must match all of the text. */
    pattern?: string | RegExp;
    /** `false` keeps the spaces at the ends. The default is true. */
    trim?: boolean;
    equal?: string;
    notEqual?: string;
}
export interface BytesOptions extends BaseOptions<Uint8Array> {
    /** The default is 'hex'. */
    encoding?: 'hex' | 'base64';
    /** In bytes. */
    minLength?: number;
    maxLength?: number;
}
export interface TimestampOptions extends BaseOptions<Date> {
    min?: string | Date;
    max?: string | Date;
    /** The time zone of a time with no offset: 'local' or a name such as 'Europe/Berlin'. With none, a time needs Z or an offset. */
    timeZone?: string;
}
export interface DateOptions extends BaseOptions<string> {
    /** ISO dates, such as '2026-01-01'. `min` and `max` include the date. `above` and `below` do not. */
    min?: string;
    max?: string;
    above?: string;
    below?: string;
}
export interface OneOfOptions<T> extends BaseOptions<T> {
    caseSensitive?: boolean;
}

export declare const validators: {
    int(options?: IntOptions): Validator<number>;
    int(options: BigIntOptions): Validator<bigint>;
    uint(options?: IntOptions): Validator<number>;
    uint(options: BigIntOptions): Validator<bigint>;
    float(options?: FloatOptions): Validator<number>;
    /** The value is normalized text, such as "12.50", so that no digit is lost. */
    decimal(options?: DecimalOptions): Validator<string>;
    text(options?: TextOptions): Validator<string>;
    bool(options?: BaseOptions<boolean>): Validator<boolean>;
    bytes(options?: BytesOptions): Validator<Uint8Array>;
    /** ISO 8601 with Z or an offset, or with no offset when the validator has a `timeZone`. */
    timestamp(options?: TimestampOptions): Validator<Date>;
    /** An ISO calendar date, such as "2026-03-13". */
    date(options?: DateOptions): Validator<string>;
    uuid(options?: BaseOptions<string>): Validator<string>;
    oneOf<T = string>(options: readonly (T | {value: T; label?: string})[], settings?: OneOfOptions<T>): Validator<T>;
    any(options?: BaseOptions<string>): Validator<string>;
    required<T>(validator: Validator<T>): Validator<T>;
    optional<T>(validator: Validator<T>): Validator<T>;
};

export interface RecordField {
    key: string;
    validator: Validator | null;
}

export interface RecordResult {
    valid: boolean;
    value: Record<string, unknown>;
    errors: Record<string, string>;
}

/** Validates an object. Each value can be typed text or a typed value. */
export declare function validateRecord(record: Record<string, unknown> | null | undefined, fields: Record<string, Validator | null> | readonly RecordField[]): RecordResult;

export interface CsilField extends RecordField {
    /** False for an optional field (`?`) or a type that can be null. */
    required: boolean;
}

/**
 * The fields of a CSIL record type, each with a validator. `schema` is the decoded schema
 * descriptor, or its `body`. A field with no text form, such as an array, has `validator: null`.
 */
export declare function validatorsFromCsil(schema: unknown, ruleName: string): CsilField[];

/** Changes the messages of all validators, by reason, for example to translate them. null removes the changes. */
export declare function setValidatorMessages(table: MessageTable | null): void;
/** The default messages, by reason. */
export declare const validatorMessages: Readonly<Record<string, string | ((...args: any[]) => string)>>;
/** The decimal sign and the group sign of a locale. */
export declare function numberSeparators(locale?: string | null): {group: string; decimal: string};
/** The order of the parts of a date in a locale, for example ['day', 'month', 'year']. */
export declare function dateOrder(locale?: string | null): ('year' | 'month' | 'day')[];
/** The text of a number of a locale in the 1234.5 form, for example '1234.5' for '1.234,5' in German. null when the text is not a number of the locale. */
export declare function canonicalNumberText(text: string, locale?: string | null): string | null;
