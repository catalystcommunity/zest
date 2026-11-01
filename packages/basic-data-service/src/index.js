// A store of data by collection and key. Events come in through listen(), and each change goes out as
// one `data-changed` event, so that a component holds no state and decides what a change means to it.
export default class BasicDataService extends EventTarget {
    data; // Read and write through the methods. A direct write sends no event.
    #broker;
    #eventName;
    #depth = 0;
    #pending = new Map();

    constructor({broker = null, eventName = 'data-changed'} = {}){
        super();
        this.data = {};
        this.#broker = broker;
        this.#eventName = eventName;
    }
    get(collection, key) {
        return this.data[collection]?.get(key);
    }
    list(collection) {
        return [...(this.data[collection] ?? [])];
    }
    set(collection, key, value) {
        this.data[collection] ??= new Map();
        const items = this.data[collection];
        const oldValue = items.get(key);
        if (items.has(key) && Object.is(oldValue, value)) { return; }
        items.set(key, value);
        this.#record(collection, key, oldValue, value);
    }
    remove(collection, key) {
        const items = this.data[collection];
        if (!items?.has(key)) { return; }
        const oldValue = items.get(key);
        items.delete(key);
        this.#record(collection, key, oldValue, undefined);
    }
    // All the changes in the function go out together, in one event for each collection.
    // If the function throws, the changes that it made stay and are published.
    transaction(change) {
        this.#depth++;
        try {
            return change(this);
        } finally {
            this.#depth--;
            if (this.#depth === 0) { this.#publish(); }
        }
    }
    // Updates the store from an event. The reducer gets (detail, service, event).
    listen(target, eventName, reducer, {signal} = {}) {
        const handler = (event) => this.transaction(() => reducer(event.detail, this, event));
        target.addEventListener(eventName, handler, {signal});
        return () => target.removeEventListener(eventName, handler);
    }
    // Calls the handler with the changes that match. All the options are optional:
    // collection, keys, filter(change, collection), and signal.
    subscribe(handler, {collection, keys, filter, signal} = {}) {
        const wanted = keys ? new Set(keys) : null;
        const listener = (event) => {
            if (collection !== undefined && event.detail.collection !== collection) { return; }
            const changes = event.detail.changes.filter(change =>
                (!wanted || wanted.has(change.key)) && (!filter || filter(change, event.detail.collection)));
            if (changes.length) { handler({collection: event.detail.collection, changes}); }
        };
        this.addEventListener(this.#eventName, listener, {signal});
        return () => this.removeEventListener(this.#eventName, listener);
    }
    #record(collection, key, oldValue, newValue) {
        if (!this.#pending.has(collection)) { this.#pending.set(collection, new Map()); }
        const changes = this.#pending.get(collection);
        // More than one change to a key is one change, from the first value to the last
        const first = changes.has(key) ? changes.get(key).oldValue : oldValue;
        changes.set(key, {key, oldValue: first, newValue});
        if (this.#depth === 0) { this.#publish(); }
    }
    #publish() {
        const pending = this.#pending;
        this.#pending = new Map();
        for (const [collection, changes] of pending) {
            const real = [...changes.values()].filter(change => !Object.is(change.oldValue, change.newValue));
            if (!real.length) { continue; }
            const detail = {collection, changes: real};
            this.dispatchEvent(new CustomEvent(this.#eventName, {detail}));
            this.#broker?.FireEvent(this.#eventName, detail);
        }
    }
}
