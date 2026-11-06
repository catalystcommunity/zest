// The selection of a view, with no DOM. The view gives an index, and a function that gives the key of
// an index. The selection keeps keys, so it stays with the items when the order changes.

export class SelectionModel {
    #keys = new Set();
    multiple;
    // The index where a Shift range starts
    anchor = -1;

    constructor({multiple = false} = {}) {
        this.multiple = multiple;
    }

    has(key) { return this.#keys.has(key); }
    get size() { return this.#keys.size; }
    get keys() { return [...this.#keys]; }

    clear() {
        const changed = this.#keys.size > 0;
        this.#keys.clear();
        return changed;
    }

    // Replaces the selection. A single selection keeps only the first key.
    set(keys) {
        this.#keys = new Set(this.multiple ? keys : [...keys].slice(0, 1));
    }

    // Selects only this index. Returns true when the selection changed.
    selectOnly(index, keyAt) {
        this.anchor = index;
        const key = keyAt(index);
        if (this.#keys.size === 1 && this.#keys.has(key)) { return false; }
        this.#keys = new Set([key]);
        return true;
    }

    // Ctrl and a click: adds or removes one index
    toggle(index, keyAt) {
        if (!this.multiple) { return this.selectOnly(index, keyAt); }
        this.anchor = index;
        const key = keyAt(index);
        if (this.#keys.has(key)) { this.#keys.delete(key); } else { this.#keys.add(key); }
        return true;
    }

    // Shift: selects from the anchor to this index, and nothing else
    extend(index, keyAt) {
        if (!this.multiple) { return this.selectOnly(index, keyAt); }
        if (this.anchor < 0) { this.anchor = index; }
        const [from, to] = this.anchor < index ? [this.anchor, index] : [index, this.anchor];
        this.#keys = new Set();
        for (let i = from; i <= to; i++) { this.#keys.add(keyAt(i)); }
        return true;
    }

    selectAll(count, keyAt) {
        if (!this.multiple) { return false; }
        this.#keys = new Set();
        for (let i = 0; i < count; i++) { this.#keys.add(keyAt(i)); }
        return true;
    }

    // A pointer selection: Shift extends, Ctrl or Meta toggles, and a plain click selects one
    fromPointer(index, event, keyAt) {
        if (event.shiftKey) { return this.extend(index, keyAt); }
        if (event.ctrlKey || event.metaKey) { return this.toggle(index, keyAt); }
        return this.selectOnly(index, keyAt);
    }
}

// Typing letters goes to the next row whose text starts with what the user typed in the last second
export class Typeahead {
    #typed = '';
    #at = 0;

    find(key, start, count, textAt, now = Date.now()) {
        this.#typed = now - this.#at < 1000 ? this.#typed + key.toLowerCase() : key.toLowerCase();
        this.#at = now;
        // With one letter, the search starts after the current row. With more, the current row can match.
        const offset = this.#typed.length > 1 ? 0 : 1;
        for (let step = 0; step < count; step++) {
            const index = (start + offset + step) % count;
            if (String(textAt(index) ?? '').trim().toLowerCase().startsWith(this.#typed)) { return index; }
        }
        return -1;
    }
}
