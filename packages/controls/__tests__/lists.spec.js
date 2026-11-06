import { describe, it, expect, vi, afterEach } from 'vitest';
import { make, settle, record, key, option } from './helpers.js';

afterEach(() => document.body.replaceChildren());

const FRUITS = ['Apple', 'Apricot', 'Banana', {value: 'c', label: 'Cherry', disabled: true}, 'Grape'];
const optionsOf = (element, root = element.list) => [...root.querySelectorAll('[role="option"]')];
const selected = (element) => optionsOf(element).filter(item => item.getAttribute('aria-selected') === 'true').map(item => item.textContent);

describe('ListBox', () => {
    it('makes its options from data, and from option children that it hides', async () => {
        const fromData = make('list-box', {'.options': FRUITS, label: 'Fruit'});
        const fromChildren = make('list-box', {}, option('One', {value: '1'}), option('Two', {value: '2', selected: ''}));
        await settle();
        expect(optionsOf(fromData).map(item => item.textContent)).toEqual(['Apple', 'Apricot', 'Banana', 'Cherry', 'Grape']);
        expect(optionsOf(fromData)[3].getAttribute('aria-disabled')).toBe('true');
        expect(fromData.list.getAttribute('role')).toBe('listbox');
        expect(document.getElementById(fromData.list.getAttribute('aria-labelledby')).textContent).toBe('Fruit');
        expect(fromChildren.value).toBe('2');
        expect(fromChildren.querySelector('option').hidden).toBe(true);
    });

    it('moves and selects with the arrows in a single selection, and skips a disabled option', async () => {
        const element = make('list-box', {'.options': FRUITS});
        const events = record(element);
        await settle();
        element.list.dispatchEvent(new FocusEvent('focus'));
        key(element.list, 'ArrowDown');
        expect(element.value).toBe('Apricot');
        key(element.list, 'ArrowDown');
        key(element.list, 'ArrowDown');
        expect(element.value).toBe('Grape');
        expect(element.list.getAttribute('aria-activedescendant')).toBe(optionsOf(element)[4].id);
        expect(events).toEqual(['input', 'change', 'input', 'change', 'input', 'change']);
        key(element.list, 'Home');
        expect(element.value).toBe('Apple');
    });

    it('goes to an option by its first letters, and starts again after a second', async () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(10000);
        const element = make('list-box', {'.options': FRUITS});
        await settle();
        key(element.list, 'a');
        key(element.list, 'p');
        key(element.list, 'r');
        expect(element.value).toBe('Apricot');
        now.mockReturnValue(12000);
        key(element.list, 'g');
        expect(element.value).toBe('Grape');
        now.mockReturnValue(14000);
        key(element.list, 'a');
        key(element.list, 'a');
        expect(element.value).toBe('Apricot');
        now.mockRestore();
    });

    it('selects many with Space, Shift and the arrows, Shift with a click, and Ctrl A', async () => {
        const element = make('list-box', {'.options': FRUITS, multiple: ''});
        await settle();
        expect(element.list.getAttribute('aria-multiselectable')).toBe('true');
        element.list.dispatchEvent(new FocusEvent('focus'));
        key(element.list, 'ArrowDown');
        expect(element.values).toEqual([]);
        key(element.list, ' ');
        expect(element.values).toEqual(['Apricot']);
        key(element.list, 'ArrowDown', {shiftKey: true});
        expect(element.values).toEqual(['Apricot', 'Banana']);
        key(element.list, 'a', {ctrlKey: true});
        expect(element.values).toEqual(['Apple', 'Apricot', 'Banana', 'Grape']);
        key(element.list, 'a', {ctrlKey: true});
        expect(element.values).toEqual([]);
        optionsOf(element)[0].click();
        optionsOf(element)[4].dispatchEvent(new MouseEvent('click', {bubbles: true, shiftKey: true}));
        expect(element.values).toEqual(['Apple', 'Apricot', 'Banana', 'Grape']);
        optionsOf(element)[1].click();
        expect(selected(element)).toEqual(['Apple', 'Banana', 'Grape']);
    });

    it('gives each value to the form with its name, and is missing a value when required', async () => {
        const element = make('list-box', {'.options': FRUITS, multiple: '', name: 'fruit', required: ''});
        await settle();
        expect(element.internals.flags).toEqual({valueMissing: true});
        element.values = ['Apple', 'Grape'];
        await settle();
        expect([...element.internals.value.getAll('fruit')]).toEqual(['Apple', 'Grape']);
        expect(element.value).toBe('Apple');
        element.formStateRestoreCallback('["Banana"]');
        expect(element.values).toEqual(['Banana']);
    });

    it('does nothing when it is disabled', async () => {
        const element = make('list-box', {'.options': FRUITS, disabled: ''});
        await settle();
        key(element.list, 'ArrowDown');
        optionsOf(element)[1].click();
        expect(element.value).toBe('');
        expect(element.list.getAttribute('aria-disabled')).toBe('true');
    });
});

describe('ComboBox, select only', () => {
    it('shows the label of its value, and opens with Down on the selected option', async () => {
        const element = make('combo-box', {'.options': FRUITS, value: 'Banana', label: 'Fruit'});
        await settle();
        const control = element.control;
        expect(control.getAttribute('role')).toBe('combobox');
        expect(control.textContent).toBe('Banana');
        expect(control.getAttribute('aria-expanded')).toBe('false');
        key(control, 'ArrowDown');
        expect(element.open).toBe(true);
        expect(control.getAttribute('aria-expanded')).toBe('true');
        expect(document.getElementById(control.getAttribute('aria-activedescendant')).textContent).toBe('Banana');
    });

    it('moves with the arrows, skips a disabled option, and selects with Enter', async () => {
        const element = make('combo-box', {'.options': FRUITS, value: 'Banana'});
        const events = record(element);
        await settle();
        key(element.control, 'ArrowDown');
        key(element.control, 'ArrowDown');
        expect(document.getElementById(element.control.getAttribute('aria-activedescendant')).textContent).toBe('Grape');
        key(element.control, 'Enter');
        expect(element.value).toBe('Grape');
        expect(element.open).toBe(false);
        expect(events).toEqual(['input', 'change']);
    });

    it('closes with Escape and keeps the value, and goes to the ends with Home and End', async () => {
        const element = make('combo-box', {'.options': FRUITS});
        await settle();
        key(element.control, 'End');
        expect(element.open).toBe(true);
        expect(document.getElementById(element.control.getAttribute('aria-activedescendant')).textContent).toBe('Grape');
        const escape = key(element.control, 'Escape');
        expect(escape.defaultPrevented).toBe(true);
        expect(element.open).toBe(false);
        expect(element.value).toBe('');
    });

    it('selects with a click on an option, and with Tab', async () => {
        const element = make('combo-box', {'.options': FRUITS});
        await settle();
        element.control.click();
        expect(element.open).toBe(true);
        element.popup.querySelectorAll('[role="option"]')[1].click();
        expect(element.value).toBe('Apricot');
        expect(element.open).toBe(false);
        key(element.control, 'ArrowDown');
        key(element.control, 'ArrowDown');
        key(element.control, 'Tab');
        expect(element.value).toBe('Banana');
    });

    it('opens and goes to an option by its first letter', async () => {
        const element = make('combo-box', {'.options': FRUITS});
        await settle();
        key(element.control, 'b');
        expect(element.open).toBe(true);
        expect(document.getElementById(element.control.getAttribute('aria-activedescendant')).textContent).toBe('Banana');
    });

    it('closes when the user presses outside it', async () => {
        const element = make('combo-box', {'.options': FRUITS});
        await settle();
        key(element.control, 'ArrowDown');
        document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, composed: true}));
        expect(element.open).toBe(false);
    });

    it('reads option children, gives its value to the form, and resets', async () => {
        const element = make('combo-box', {name: 'size', required: ''}, option('Small', {value: 's'}), option('Large', {value: 'l', selected: ''}));
        await settle();
        expect(element.value).toBe('l');
        expect(element.internals.value).toBe('l');
        element.value = '';
        await settle();
        expect(element.internals.flags).toEqual({valueMissing: true});
        element.formResetCallback();
        expect(element.value).toBe('l');
    });
});

describe('ComboBox, editable', () => {
    function type(element, text) {
        element.control.value = text;
        element.control.dispatchEvent(new Event('input', {bubbles: true}));
    }

    it('filters the options as the user types, and the value is the text', async () => {
        const element = make('combo-box', {'.options': FRUITS, editable: ''});
        const events = record(element);
        await settle();
        expect(element.control.localName).toBe('input');
        expect(element.control.getAttribute('aria-autocomplete')).toBe('list');
        type(element, 'ap');
        expect(element.open).toBe(true);
        expect([...element.popup.querySelectorAll('[role="option"]')].map(item => item.textContent)).toEqual(['Apple', 'Apricot', 'Grape']);
        expect(element.value).toBe('ap');
        expect(events).toEqual(['input']);
        type(element, 'zzz');
        expect(element.popup.textContent).toBe('No options');
    });

    it('selects the option of the arrows with Enter, and sends change one time', async () => {
        const element = make('combo-box', {'.options': FRUITS, editable: ''});
        const events = record(element);
        await settle();
        type(element, 'apr');
        key(element.control, 'ArrowDown');
        key(element.control, 'Enter');
        expect(element.value).toBe('Apricot');
        expect(element.control.value).toBe('Apricot');
        expect(events.filter(event => event === 'change')).toEqual(['change']);
    });

    it('takes the value of an option whose label the user typed, and commits the text on blur', async () => {
        const element = make('combo-box', {'.options': [{value: 'b', label: 'Banana'}], editable: ''});
        const events = record(element);
        await settle();
        type(element, 'banana');
        expect(element.value).toBe('b');
        element.control.dispatchEvent(new FocusEvent('blur'));
        expect(element.control.value).toBe('Banana');
        expect(events.at(-1)).toBe('change');
    });

    it('clears the text with Escape when it is closed', async () => {
        const element = make('combo-box', {'.options': FRUITS, editable: ''});
        await settle();
        type(element, 'x');
        key(element.control, 'Escape');
        expect(element.open).toBe(false);
        key(element.control, 'Escape');
        expect(element.control.value).toBe('');
        expect(element.value).toBe('');
    });
});
