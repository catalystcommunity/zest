// A store of data by collection and key. Events come in through listen(), and each change goes out as
// one `data-changed` event, so that a component holds no state and decides what a change means to it.
export default class BasicDataService extends EventTarget {
    data; // Read and write through the methods. A direct write sends no event.
    #broker;
    #eventName;
    #depth = 0;
    #pending = new Map();
    // Changes made while the store sends go out after the current send, so each subscriber hears them in order
    #outbox = [];
    #sending = false;

    constructor({broker = null, eventName = 'data-changed'} = {}){
        super();
        this.data = {};
        this.#broker = broker;
        this.#eventName = eventName;
    }
    get(collection, key) {
        return this.data[collection]?.get(key);
    }
    has(collection, key) {
        return this.data[collection]?.has(key) ?? false;
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
    // Removes each key of the collection, in one event
    clear(collection) {
        this.transaction(() => {
            for (const key of [...(this.data[collection]?.keys() ?? [])]) { this.remove(collection, key); }
        });
    }
    // Makes the collection hold only these [key, value] pairs, in one event. A key with the same value
    // is not in the event, and a key that is not in the pairs is removed.
    replace(collection, entries) {
        const next = new Map(entries);
        this.transaction(() => {
            for (const key of [...(this.data[collection]?.keys() ?? [])]) {
                if (!next.has(key)) { this.remove(collection, key); }
            }
            for (const [key, value] of next) { this.set(collection, key, value); }
        });
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
    // Updates the store from an event. The reducer gets (detail, service, event). Returns the removal function.
    // With isActive, the listener removes itself when isActive() does not return true.
    listen(target, eventName, reducer, {isActive} = {}) {
        const handler = (event) => {
            if (isActive && isActive() !== true) { remove(); return; }
            this.transaction(() => reducer(event.detail, this, event));
        };
        const remove = () => target.removeEventListener(eventName, handler);
        target.addEventListener(eventName, handler);
        return remove;
    }
    // Calls the handler with the changes that match. Returns the removal function. All the options are
    // optional: collection, keys, filter(change, collection), and isActive, as for listen.
    subscribe(handler, {collection, keys, filter, isActive} = {}) {
        const wanted = keys ? new Set(keys) : null;
        const listener = (event) => {
            if (isActive && isActive() !== true) { remove(); return; }
            if (collection !== undefined && event.detail.collection !== collection) { return; }
            const changes = event.detail.changes.filter(change =>
                (!wanted || wanted.has(change.key)) && (!filter || filter(change, event.detail.collection)));
            if (changes.length) { handler({collection: event.detail.collection, changes}); }
        };
        const remove = () => this.removeEventListener(this.#eventName, listener);
        this.addEventListener(this.#eventName, listener);
        return remove;
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
            if (real.length) { this.#outbox.push({collection, changes: real}); }
        }
        // A subscriber that changes the store while it hears a change gets here again. The loop below sends it.
        if (this.#sending) { return; }
        this.#sending = true;
        try {
            while (this.#outbox.length) {
                const detail = this.#outbox.shift();
                this.dispatchEvent(new CustomEvent(this.#eventName, {detail}));
                this.#broker?.FireEvent(this.#eventName, detail);
            }
        } finally {
            this.#sending = false;
        }
    }
}
