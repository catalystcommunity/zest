// A store of data by collection and key. Events come in through listen(), and each change goes out as
// one `data-changed` event, so that a component holds no state and decides what a change means to it.
// Reports an error now, as the browser does for an event listener that throws
function report(error) {
    if (typeof reportError === 'function') { reportError(error); return; }
    const event = typeof ErrorEvent === 'function' ? new ErrorEvent('error', {error, message: String(error?.message ?? error), cancelable: true}) : null;
    if (event && typeof dispatchEvent === 'function' && !dispatchEvent(event)) { return; }
    console.error(error);
}

export default class BasicDataService extends EventTarget {
    data; // Read and write through the methods. A direct write sends no event.
    #broker;
    #eventName;
    #depth = 0;
    #pending = new Map();
    // Changes made while the store sends go out after the current send, so each subscriber hears them in order
    #outbox = [];
    #sending = false;
    // Subscriptions in the order that they were made. A subscription with keys is also in an index
    // by collection and key, so that a write reaches only its subscribers, not all of them.
    #order = 0;
    #general = new Set();
    #keyed = new Map();

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
        const entry = {order: this.#order++, handler, collection, filter, isActive, keys: keys ? new Set(keys) : null, active: true};
        const remove = () => {
            if (!entry.active) { return; }
            entry.active = false;
            if (!entry.keys) { this.#general.delete(entry); return; }
            const byKey = this.#keyed.get(collection);
            for (const key of entry.keys) {
                const entries = byKey?.get(key);
                entries?.delete(entry);
                if (entries && !entries.size) { byKey.delete(key); }
            }
        };
        entry.remove = remove;
        if (!entry.keys) {
            this.#general.add(entry);
        } else {
            // A subscription with keys and no collection is in the index under undefined, which each collection reads
            if (!this.#keyed.has(collection)) { this.#keyed.set(collection, new Map()); }
            const byKey = this.#keyed.get(collection);
            for (const key of entry.keys) {
                if (!byKey.has(key)) { byKey.set(key, new Set()); }
                byKey.get(key).add(entry);
            }
        }
        return remove;
    }
    // The subscriptions that a change of the collection reaches, with the changes for each, in order
    #reached(collection, changes) {
        const reached = new Map();
        for (const entry of this.#general) {
            if (entry.collection === undefined || entry.collection === collection) { reached.set(entry, changes); }
        }
        const indexes = [this.#keyed.get(collection), collection === undefined ? null : this.#keyed.get(undefined)].filter(Boolean);
        for (const byKey of indexes) {
            for (const change of changes) {
                for (const entry of byKey.get(change.key) ?? []) {
                    if (!reached.has(entry)) { reached.set(entry, []); }
                    reached.get(entry).push(change);
                }
            }
        }
        return [...reached].sort(([a], [b]) => a.order - b.order);
    }
    #deliver(detail) {
        for (const [entry, changes] of this.#reached(detail.collection, detail.changes)) {
            // A handler before this one can remove it
            if (!entry.active) { continue; }
            if (entry.isActive && entry.isActive() !== true) { entry.remove(); continue; }
            const wanted = entry.filter ? changes.filter(change => entry.filter(change, detail.collection)) : changes;
            if (!wanted.length) { continue; }
            try {
                entry.handler({collection: detail.collection, changes: wanted});
            } catch (e) {
                // One subscriber that fails must not stop the others, the same as an event listener
                report(e);
            }
        }
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
                this.#deliver(detail);
                this.#broker?.FireEvent(this.#eventName, detail);
            }
        } finally {
            this.#sending = false;
        }
    }
}
