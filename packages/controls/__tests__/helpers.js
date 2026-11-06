import { vi } from 'vitest';
import { flushRenders } from '@catalystcommunity/base-components';
import { defineControls } from '../src';

defineControls({shadow: true});

// jsdom has no form values or validity in ElementInternals, so a test gives a fake
export function fakeInternals() {
    return {
        value: undefined,
        state: undefined,
        flags: {},
        message: '',
        anchor: null,
        form: null,
        setFormValue: vi.fn(function (value, state) { this.value = value; this.state = state; }),
        setValidity: vi.fn(function (flags = {}, message = '', anchor = null) { this.flags = flags; this.message = message; this.anchor = anchor; }),
    };
}

export function make(tag, attributes = {}, ...children) {
    const element = document.createElement(tag);
    element.internals = fakeInternals();
    for (const [name, value] of Object.entries(attributes)) {
        if (name.startsWith('.')) { element[name.slice(1)] = value; } else { element.setAttribute(name, value); }
    }
    element.append(...children);
    document.body.append(element);
    return element;
}

export async function settle() {
    await Promise.resolve();
    await Promise.resolve();
    flushRenders();
    await Promise.resolve();
}

// Records the input and change events of an element
export function record(element) {
    const events = [];
    for (const type of ['input', 'change']) {
        element.addEventListener(type, (e) => {
            if (e.target === element) { events.push(type); }
        });
    }
    return events;
}

export function key(target, name, init = {}) {
    const event = new KeyboardEvent('keydown', {key: name, bubbles: true, composed: true, cancelable: true, ...init});
    target.dispatchEvent(event);
    return event;
}

export function option(text, attributes = {}) {
    const element = document.createElement('option');
    element.textContent = text;
    for (const [name, value] of Object.entries(attributes)) { element.setAttribute(name, value); }
    return element;
}
