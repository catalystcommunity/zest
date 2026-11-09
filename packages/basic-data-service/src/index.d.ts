// Type declarations for @catalystcommunity/basic-data-service. The source is JavaScript; keep this
// file in step with src/index.js. __tests__/types.spec.js checks that each export has a declaration.

/**
 * The value type of each collection, by collection name. For example
 * `BasicDataService<{bookings: Booking; rooms: Room}>`. The default lets each name hold any value.
 */
export type CollectionMap = Record<string, unknown>;

/** One change of one key. A removed key has `newValue: undefined`. A new key has `oldValue: undefined`. */
export interface DataChange<V = unknown, Key = string> {
    key: Key;
    oldValue: V | undefined;
    newValue: V | undefined;
}

/** The changes of one collection, from one write or one transaction. */
export interface DataChangedDetail<C extends string = string, V = unknown, Key = string> {
    collection: C;
    changes: DataChange<V, Key>[];
}

/** A change detail of any collection of the map. */
export type AnyDataChangedDetail<S extends CollectionMap = CollectionMap, Key = string> =
    {[C in keyof S & string]: DataChangedDetail<C, S[C], Key>}[keyof S & string];

/** Gets each change, with `FireEvent(eventName, detail)`. An `EventBroker` is one. */
export interface DataBroker {
    FireEvent(eventName: string, detail: unknown): void;
}

export interface DataServiceOptions {
    broker?: DataBroker | null;
    /** The name of the change event. The default is `data-changed`. */
    eventName?: string;
}

export interface ListenOptions {
    /** If this does not return `true` at an event, the listener removes itself. */
    isActive?: () => boolean;
}

export interface SubscribeOptions<C extends string, V, Key> extends ListenOptions {
    collection?: C;
    /** Only changes of these keys. A write calls only the handlers of its key. */
    keys?: Iterable<Key>;
    /** Return true to keep a change. */
    filter?: (change: DataChange<V, Key>, collection: C) => boolean;
}

/** The detail type of a custom event in `HTMLElementEventMap`. */
type DetailOf<E> = E extends CustomEvent<infer D> ? D : undefined;

/**
 * A store of data by collection and key. Events come in through `listen()`. Each change goes out
 * to the subscribers and as one `data-changed` event on the store.
 */
export default class BasicDataService<S extends CollectionMap = CollectionMap, Key = string> extends EventTarget {
    /** Read and write through the methods. A direct write sends no event. */
    data: {[C in keyof S]?: Map<Key, S[C]>};
    constructor(options?: DataServiceOptions);
    get<C extends keyof S & string>(collection: C, key: Key): S[C] | undefined;
    has<C extends keyof S & string>(collection: C, key: Key): boolean;
    /** `[key, value]` pairs. */
    list<C extends keyof S & string>(collection: C): Array<[Key, S[C]]>;
    /** A value that is the same by `Object.is` sends no event. */
    set<C extends keyof S & string>(collection: C, key: Key, value: S[C]): void;
    remove<C extends keyof S & string>(collection: C, key: Key): void;
    /** Removes each key of the collection, in one event. */
    clear<C extends keyof S & string>(collection: C): void;
    /** Makes the collection hold only these pairs, in one event. A key with the same value is not in the event. */
    replace<C extends keyof S & string>(collection: C, entries: Iterable<readonly [Key, S[C]]>): void;
    /** The changes in the function go out together, one event for each collection. Returns what the function returns. */
    transaction<R>(change: (service: this) => R): R;
    /** Updates the store from an event, in one transaction. Returns the removal function. */
    listen<E extends keyof HTMLElementEventMap>(target: EventTarget, eventName: E, reducer: (detail: DetailOf<HTMLElementEventMap[E]>, service: this, event: HTMLElementEventMap[E]) => unknown, options?: ListenOptions): () => void;
    listen<D = unknown>(target: EventTarget, eventName: string, reducer: (detail: D, service: this, event: CustomEvent<D>) => unknown, options?: ListenOptions): () => void;
    /** Calls the handler with the changes that match. Returns the removal function. */
    subscribe<C extends keyof S & string>(handler: (detail: DataChangedDetail<C, S[C], Key>) => void, options: SubscribeOptions<C, S[C], Key> & {collection: C}): () => void;
    subscribe(handler: (detail: AnyDataChangedDetail<S, Key>) => void, options?: SubscribeOptions<keyof S & string, S[keyof S], Key>): () => void;

    addEventListener(type: 'data-changed', listener: ((event: CustomEvent<AnyDataChangedDetail<S, Key>>) => void) | null, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: 'data-changed', listener: ((event: CustomEvent<AnyDataChangedDetail<S, Key>>) => void) | null, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
}
