import { describe, it, expect, vi, afterEach } from 'vitest';
import { attachTypeahead, matchSuggestions, typeahead } from '../src';
import { make, settle } from './helpers.js';

afterEach(() => document.body.replaceChildren());

function field(tag = 'input') {
    const element = document.createElement(tag);
    document.body.append(element);
    return element;
}

function type(element, text) {
    element.value = text;
    element.setSelectionRange?.(text.length, text.length);
    element.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
}

function press(element, key, options = {}) {
    const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, composed: true, ...options});
    element.dispatchEvent(event);
    return event;
}

const labels = (element) => typeahead.items(element).map((item) => item.label);
const FRUIT = ['Apple', 'Apricot', 'Banana', 'Pineapple', 'Cherry', 'Grape'];

describe('matchSuggestions', () => {
    it('gives the labels that start with the text first, then the labels that contain it', () => {
        expect(matchSuggestions(FRUIT, 'ap').map((item) => item.label)).toEqual(['Apple', 'Apricot', 'Pineapple', 'Grape']);
        expect(matchSuggestions(FRUIT, 'ap', {match: 'prefix'}).map((item) => item.label)).toEqual(['Apple', 'Apricot']);
        expect(matchSuggestions(FRUIT, '', {max: 2}).map((item) => item.label)).toEqual(['Apple', 'Apricot']);
        expect(matchSuggestions([{value: 1, label: 'One'}], 'on')[0]).toEqual({value: 1, label: 'One', insertText: 'One'});
    });

    it('stays fast for a long list', () => {
        const many = Array.from({length: 100000}, (_, i) => `Item ${i}`);
        matchSuggestions(many, 'x');
        const start = performance.now();
        for (let i = 0; i < 20; i++) { matchSuggestions(many, `item ${i}`); }
        // 20 key presses over 100,000 items. The labels are in lower case one time only.
        expect(performance.now() - start).toBeLessThan(400);
    });
});

describe('attachTypeahead', () => {
    it('opens a list as the person types, and names it for assistive technology', () => {
        const input = field();
        attachTypeahead(input, {source: FRUIT, label: 'Fruit'});
        expect(input.getAttribute('role')).toBe('combobox');
        expect(input.getAttribute('aria-autocomplete')).toBe('list');
        expect(input.getAttribute('aria-expanded')).toBe('false');
        type(input, 'an');
        expect(typeahead.isOpen(input)).toBe(true);
        expect(labels(input)).toEqual(['Banana']);
        expect(input.getAttribute('aria-expanded')).toBe('true');
        expect(typeahead.listOf(input).getAttribute('aria-label')).toBe('Fruit');
        expect(typeahead.listOf(input).querySelector('mark').textContent).toBe('an');
        type(input, '');
        expect(typeahead.isOpen(input)).toBe(false);
    });

    it('moves with the arrow keys, and Enter accepts the active item', () => {
        const input = field();
        const accepted = vi.fn();
        attachTypeahead(input, {source: FRUIT, onAccept: accepted});
        const events = [];
        input.addEventListener('input', () => events.push(input.value));
        type(input, 'ap');
        events.length = 0;
        expect(typeahead.activeItem(input)).toBe(null);
        press(input, 'ArrowDown');
        press(input, 'ArrowDown');
        expect(typeahead.activeItem(input).label).toBe('Apricot');
        expect(input.getAttribute('aria-activedescendant')).toBe(typeahead.listOf(input).children[1].id);
        press(input, 'ArrowUp');
        expect(typeahead.activeItem(input).label).toBe('Apple');
        const enter = press(input, 'Enter');
        expect(enter.defaultPrevented).toBe(true);
        expect(input.value).toBe('Apple');
        expect(events).toEqual(['Apple']);
        expect(typeahead.isOpen(input)).toBe(false);
        expect(accepted).toHaveBeenCalledWith(expect.objectContaining({label: 'Apple'}), expect.any(Object));
    });

    it('Enter with no active item does nothing to the text, so a form can submit', () => {
        const input = field();
        attachTypeahead(input, {source: FRUIT});
        type(input, 'ap');
        const enter = press(input, 'Enter');
        expect(enter.defaultPrevented).toBe(false);
        expect(input.value).toBe('ap');
        expect(typeahead.isOpen(input)).toBe(false);
    });

    it('autoSelect makes the first item active, and Tab accepts it and continues', () => {
        const input = field();
        attachTypeahead(input, {source: FRUIT, autoSelect: true});
        type(input, 'ch');
        expect(typeahead.activeItem(input).label).toBe('Cherry');
        const tab = press(input, 'Tab');
        expect(input.value).toBe('Cherry');
        expect(tab.defaultPrevented).toBe(false);
    });

    it('the keys can only close the list, or accept and use the key', () => {
        const input = field();
        attachTypeahead(input, {source: FRUIT, autoSelect: true, enter: 'none', tab: 'accept'});
        type(input, 'ba');
        press(input, 'Enter');
        expect(input.value).toBe('ba');
        type(input, 'ba');
        const tab = press(input, 'Tab');
        expect(tab.defaultPrevented).toBe(true);
        expect(input.value).toBe('Banana');
        expect(typeahead.isOpen(input)).toBe(false);
    });

    it('Escape closes the list and stops the key, so a parent does not also act', () => {
        const input = field();
        const parent = vi.fn();
        document.body.addEventListener('keydown', parent);
        attachTypeahead(input, {source: FRUIT});
        type(input, 'a');
        const escape = press(input, 'Escape');
        expect(escape.defaultPrevented).toBe(true);
        expect(typeahead.isOpen(input)).toBe(false);
        expect(parent).not.toHaveBeenCalled();
        press(input, 'Escape');
        expect(parent).toHaveBeenCalledTimes(1);
        document.body.removeEventListener('keydown', parent);
    });

    it('Alt+Arrow Down shows all items, and arrowOpens: false leaves the arrow keys to the parent', () => {
        const input = field();
        attachTypeahead(input, {source: FRUIT, arrowOpens: false});
        const down = press(input, 'ArrowDown');
        expect(down.defaultPrevented).toBe(false);
        expect(typeahead.isOpen(input)).toBe(false);
        press(input, 'ArrowDown', {altKey: true});
        expect(typeahead.isOpen(input)).toBe(true);
        expect(typeahead.items(input).length).toBe(6);
    });

    it('completes a part of the text with query()', () => {
        const input = field();
        attachTypeahead(input, {
            source: [{label: 'SUM', insertText: 'SUM('}, {label: 'SQRT', insertText: 'SQRT('}],
            autoSelect: true,
            query: (element) => {
                const before = element.value.slice(0, element.selectionStart);
                const match = /[A-Za-z]+$/.exec(before);
                return match ? {text: match[0], start: match.index, end: element.selectionStart} : null;
            },
        });
        type(input, '=1+s');
        expect(labels(input)).toEqual(['SUM', 'SQRT']);
        press(input, 'ArrowDown');
        press(input, 'Enter');
        expect(input.value).toBe('=1+SQRT(');
        expect(input.selectionStart).toBe(8);
    });

    it('takes a function source, also a promise, and drops an old answer', async () => {
        const input = field();
        const answers = [];
        const source = vi.fn((text) => new Promise((resolve) => answers.push(() => resolve([`${text} one`, `${text} two`]))));
        attachTypeahead(input, {source});
        type(input, 'a');
        type(input, 'ab');
        expect(source).toHaveBeenCalledTimes(2);
        answers[1]();
        await Promise.resolve();
        await Promise.resolve();
        expect(labels(input)).toEqual(['ab one', 'ab two']);
        answers[0]();
        await Promise.resolve();
        await Promise.resolve();
        expect(labels(input)).toEqual(['ab one', 'ab two']);
    });

    it('waits for the delay before it calls a function source', () => {
        vi.useFakeTimers();
        try {
            const input = field();
            const source = vi.fn(() => ['x']);
            attachTypeahead(input, {source, delay: 150});
            type(input, 'a');
            type(input, 'ab');
            expect(source).not.toHaveBeenCalled();
            vi.advanceTimersByTime(150);
            expect(source).toHaveBeenCalledTimes(1);
            expect(source).toHaveBeenCalledWith('ab', expect.any(Object));
        } finally {
            vi.useRealTimers();
        }
    });

    it('a click on an item accepts it, and a disabled item is skipped', () => {
        const input = field();
        attachTypeahead(input, {source: ['One', {label: 'Two', disabled: true}, 'Three']});
        type(input, 't');
        press(input, 'ArrowDown');
        expect(typeahead.activeItem(input).label).toBe('Three');
        typeahead.listOf(input).children[0].dispatchEvent(new MouseEvent('click', {bubbles: true}));
        expect(input.value).toBe('t');
        typeahead.listOf(input).children[1].dispatchEvent(new MouseEvent('click', {bubbles: true}));
        expect(input.value).toBe('Three');
    });

    it('reuses the option elements', () => {
        const input = field();
        attachTypeahead(input, {source: FRUIT});
        type(input, 'a');
        const first = typeahead.listOf(input).children[0];
        type(input, 'ap');
        expect(typeahead.listOf(input).children[0]).toBe(first);
    });

    it('remove() gives the field its attributes back', () => {
        const input = field();
        input.setAttribute('aria-expanded', 'maybe');
        const remove = attachTypeahead(input, {source: FRUIT});
        expect(typeof remove).toBe('function');
        remove();
        expect(typeahead.isAttached(input)).toBe(false);
        expect(input.hasAttribute('role')).toBe(false);
        expect(input.getAttribute('aria-expanded')).toBe('maybe');
        expect(document.querySelector('type-ahead-list')).toBe(null);
        type(input, 'a');
    });

    it('a text area stays a text box: it gets no combobox role and no aria-expanded', () => {
        const area = field('textarea');
        attachTypeahead(area, {source: FRUIT});
        type(area, 'a');
        expect(typeahead.isOpen(area)).toBe(true);
        expect(area.hasAttribute('role')).toBe(false);
        expect(area.hasAttribute('aria-expanded')).toBe(false);
        expect(area.getAttribute('aria-autocomplete')).toBe('list');
    });

    it('puts the list in the shadow root of the field', () => {
        const host = document.createElement('div');
        document.body.append(host);
        const shadow = host.attachShadow({mode: 'open'});
        const input = document.createElement('input');
        shadow.append(input);
        attachTypeahead(input, {source: FRUIT});
        expect(shadow.querySelector('type-ahead-list')).not.toBe(null);
    });
});

describe('TextField suggestions', () => {
    it('shows the suggestions, and Enter on a suggestion does not submit the form', async () => {
        const form = document.createElement('form');
        document.body.append(form);
        const submit = vi.fn((e) => e.preventDefault());
        form.addEventListener('submit', submit);
        const element = make('text-field', {label: 'City', '.suggestions': ['Berlin', 'Bern', 'Boston']});
        form.append(element);
        await settle();
        expect(typeahead.isAttached(element.field)).toBe(true);
        type(element.field, 'ber');
        expect(typeahead.items(element.field).map((item) => item.label)).toEqual(['Berlin', 'Bern']);
        press(element.field, 'ArrowDown');
        press(element.field, 'Enter');
        expect(element.value).toBe('Berlin');
        expect(submit).not.toHaveBeenCalled();
        expect(typeahead.listOf(element.field).getAttribute('aria-label')).toBe('City suggestions');
    });

    it('takes a function, and goes away when the suggestions are removed or the field leaves the page', async () => {
        const element = make('text-field', {label: 'Tag', '.suggestions': (text) => [`${text}-1`]});
        await settle();
        type(element.field, 'x');
        expect(typeahead.items(element.field)[0].label).toBe('x-1');
        element.suggestions = null;
        expect(typeahead.isAttached(element.field)).toBe(false);
        element.suggestions = ['a'];
        expect(typeahead.isAttached(element.field)).toBe(true);
        element.remove();
        expect(document.querySelector('type-ahead-list')).toBe(null);
    });
});

describe('type-ahead commands and events', () => {
    it('sends events, and takes commands through the field', () => {
        const input = field();
        attachTypeahead(input, {source: FRUIT});
        const events = [];
        for (const name of ['open', 'close', 'active', 'accept']) {
            input.addEventListener(`typeahead-${name}`, (e) => events.push([name, e.detail.item?.label ?? e.detail.items?.length ?? null]));
        }
        typeahead.open(input);
        expect(typeahead.isOpen(input)).toBe(true);
        press(input, 'ArrowDown');
        expect(typeahead.accept(input)).toBe(true);
        expect(input.value).toBe('Apple');
        expect(events).toEqual([['open', 6], ['active', 'Apple'], ['close', null], ['accept', 'Apple']]);
        typeahead.setSource(input, ['Kiwi']);
        input.value = '';
        typeahead.open(input);
        expect(labels(input)).toEqual(['Kiwi']);
        typeahead.close(input);
        expect(typeahead.isOpen(input)).toBe(false);
    });

    it('a field with no list ignores the commands', () => {
        const input = field();
        expect(typeahead.isOpen(input)).toBe(false);
        expect(typeahead.items(input)).toEqual([]);
        expect(typeahead.accept(input)).toBe(false);
        typeahead.open(input);
        typeahead.remove(input);
    });

    it('a second attach replaces the first list', () => {
        const input = field();
        const first = attachTypeahead(input, {source: ['One']});
        attachTypeahead(input, {source: ['Two']});
        expect(document.querySelectorAll('type-ahead-list').length).toBe(1);
        first();
        expect(typeahead.isAttached(input)).toBe(true);
        type(input, 't');
        expect(labels(input)).toEqual(['Two']);
    });
});

describe('inline completion', () => {
    const typeIn = (element, text) => {
        element.value = text;
        element.setSelectionRange(text.length, text.length);
        element.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', data: text.slice(-1)}));
    };

    it('types the rest of the first match and selects it, and Enter accepts it', () => {
        const input = field();
        attachTypeahead(input, {source: FRUIT, inline: true});
        typeIn(input, 'ba');
        expect(input.value).toBe('banana');
        expect([input.selectionStart, input.selectionEnd]).toEqual([2, 6]);
        expect(typeahead.activeItem(input).label).toBe('Banana');
        press(input, 'Enter');
        expect(input.value).toBe('Banana');
    });

    it('Backspace does not complete again, and Escape removes the completion', () => {
        const input = field();
        attachTypeahead(input, {source: FRUIT, inline: true});
        typeIn(input, 'ch');
        expect(input.value).toBe('cherry');
        input.value = 'ch';
        input.setSelectionRange(2, 2);
        input.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'deleteContentBackward'}));
        expect(input.value).toBe('ch');
        typeIn(input, 'gr');
        expect(input.value).toBe('grape');
        press(input, 'Escape');
        expect(input.value).toBe('gr');
        expect(typeahead.isOpen(input)).toBe(false);
    });

    it('does not complete when the caret is not at the end of the text', () => {
        const input = field();
        attachTypeahead(input, {source: FRUIT, inline: true});
        input.value = 'ap';
        input.setSelectionRange(1, 1);
        input.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText'}));
        expect(input.value).toBe('ap');
    });
});

describe('TextField commands', () => {
    it('opens, closes, and refreshes the list with methods', async () => {
        const element = make('text-field', {label: 'City', '.suggestions': ['Berlin', 'Bern']});
        await settle();
        element.openSuggestions();
        expect(element.suggestionsOpen).toBe(true);
        element.closeSuggestions();
        expect(element.suggestionsOpen).toBe(false);
        element.refreshSuggestions();
    });
});
