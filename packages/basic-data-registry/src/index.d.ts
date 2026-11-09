// Type declarations for @catalystcommunity/basic-data-registry. The source is JavaScript; keep this
// file in step with src/index.js. __tests__/types.spec.js checks that each export has a declaration.

/**
 * A data registration function, as a data component calls it. The result can hold the data of the
 * component (for example `pickerConfig` or `calendarConfig`) and an `unregisterFunc`.
 */
export type DataFunction = (instanceId: string, registerData: unknown, isActive: () => boolean) => unknown;

/** A holder of data registration functions. Each function is a property, under its name. */
export default class BasicDataRegistry {
    /** A registered function. Narrow it with `typeof` before a call. */
    [name: string]: unknown;
    /** Throws if the name is already registered, or if `dataFunc` is not a function. */
    AddDataFunction(name: string, dataFunc: DataFunction): void;
}
