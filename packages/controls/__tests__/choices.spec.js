import { describe, it, expect, vi, afterEach } from 'vitest';
import { PushButton, CheckBox, ToggleSwitch, RadioGroup, RadioButton, controlTags, shadowControlTags, defineControls } from '../src';
import { make, settle, record, key } from './helpers.js';

afterEach(() => document.body.replaceChildren());

describe('the package', () => {
    it('defines a tag only when the application asks', () => {
        defineControls({shadow: true});
        for (const [tag, componentClass] of Object.entries({...controlTags, ...shadowControlTags})) {
            expect(customElements.get(tag), tag).toBe(componentClass);
        }
    });
});

describe('PushButton', () => {
    it('puts its children in a native button, and keeps the click of the application', async () => {
        const clicked = vi.fn();
        const element = make('push-button', {}, 'Save');
        element.addEventListener('click', clicked);
        await settle();
        expect(element.button.textContent).toBe('Save');
        element.button.click();
        expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('uses the label when it has no children, and an icon with no name', async () => {
        const element = make('push-button', {label: 'Open', icon: '/open.svg'});
        await settle();
        expect(element.button.textContent).toBe('Open');
        expect(element.button.querySelector('img').getAttribute('alt')).toBe('');
        element.icon = '★';
        await settle();
        expect(element.button.querySelector('.zest-icon').textContent).toBe('★');
    });

    it('stays pressed in toggle mode, and sends input and change', async () => {
        const element = make('push-button', {toggle: ''}, 'Bold');
        const events = record(element);
        await settle();
        expect(element.button.getAttribute('aria-pressed')).toBe('false');
        element.click();
        expect(element.pressed).toBe(true);
        expect(element.getAttribute('pressed')).toBe('');
        expect(element.button.getAttribute('aria-pressed')).toBe('true');
        expect(events).toEqual(['input', 'change']);
    });

    it('has no aria-pressed when it is not a toggle, and a disabled button does nothing', async () => {
        const element = make('push-button', {disabled: ''}, 'Go');
        await settle();
        expect(element.button.hasAttribute('aria-pressed')).toBe(false);
        expect(element.button.disabled).toBe(true);
        element.toggle = true;
        element.click();
        expect(element.pressed).toBe(false);
    });

    it('submits and resets its form', async () => {
        const submit = make('push-button', {type: 'submit'}, 'Send');
        const reset = make('push-button', {type: 'reset'}, 'Reset');
        const form = {requestSubmit: vi.fn(), reset: vi.fn()};
        submit.internals.form = form;
        reset.internals.form = form;
        await settle();
        submit.click();
        reset.click();
        expect(form.requestSubmit).toHaveBeenCalledTimes(1);
        expect(form.reset).toHaveBeenCalledTimes(1);
    });

    it('accepts only a known variant', async () => {
        const element = make('push-button', {variant: 'primary'}, 'A');
        await settle();
        expect(element.button.classList.contains('zest-primary')).toBe(true);
        element.variant = 'shiny';
        await settle();
        expect(element.button.className).toBe('zest-push-button zest-default');
    });

    it('slots its children in a shadow root, and gives the focus to the inner button', async () => {
        const element = make('shadow-push-button', {}, 'Shadow');
        await settle();
        expect(element.shadowRoot.querySelector('button slot')).not.toBeNull();
        element.focus();
        expect(element.shadowRoot.activeElement).toBe(element.button);
    });
});

describe('CheckBox and ToggleSwitch', () => {
    it('checks with a click, clears indeterminate, and sends input then change one time', async () => {
        const element = make('check-box', {indeterminate: ''}, 'Agree');
        const events = record(element);
        const outer = vi.fn();
        document.body.addEventListener('change', outer);
        await settle();
        expect(element.input.indeterminate).toBe(true);
        element.input.click();
        expect(element.checked).toBe(true);
        expect(element.indeterminate).toBe(false);
        expect(events).toEqual(['input', 'change']);
        // The native change of the inner input does not leave the component
        expect(outer).toHaveBeenCalledTimes(1);
        document.body.removeEventListener('change', outer);
    });

    it('gives its value to the form only when checked, and is missing a value when required', async () => {
        const element = make('check-box', {value: 'yes', required: ''});
        await settle();
        expect(element.internals.value).toBeNull();
        expect(element.internals.flags).toEqual({valueMissing: true});
        element.checked = true;
        await settle();
        expect(element.internals.value).toBe('yes');
        expect(element.internals.flags).toEqual({});
    });

    it('goes back to its checked attribute on form reset, and restores its state', async () => {
        const element = make('check-box', {checked: ''});
        await settle();
        element.input.click();
        expect(element.checked).toBe(false);
        element.formResetCallback();
        expect(element.checked).toBe(true);
        element.formStateRestoreCallback('');
        expect(element.checked).toBe(false);
    });

    it('is disabled by its fieldset', async () => {
        const element = make('check-box');
        element.formDisabledCallback(true);
        await settle();
        expect(element.input.disabled).toBe(true);
        expect(element.wrapper.classList.contains('zest-disabled')).toBe(true);
    });

    it('a switch has the role switch, and shows its state as text when asked', async () => {
        const element = make('toggle-switch', {'show-state': ''}, 'Wi-Fi');
        await settle();
        expect(element).toBeInstanceOf(CheckBox);
        expect(element.input.getAttribute('role')).toBe('switch');
        expect(element.wrapper.querySelector('.zest-state').textContent).toBe('Off');
        element.toggle();
        await settle();
        expect(element.wrapper.classList.contains('zest-on')).toBe(true);
        expect(element.wrapper.querySelector('.zest-state').textContent).toBe('On');
        element.labels = {on: 'An', off: 'Aus'};
        await settle();
        expect(element.wrapper.querySelector('.zest-state').textContent).toBe('An');
    });
});

describe('RadioGroup', () => {
    function group(attributes = {}) {
        const element = make('radio-group', {label: 'Delivery', ...attributes});
        for (const [value, extra] of [['a', {}], ['b', {disabled: ''}], ['c', {}]]) {
            const radio = document.createElement('radio-button');
            radio.setAttribute('value', value);
            for (const [name, text] of Object.entries(extra)) { radio.setAttribute(name, text); }
            radio.textContent = value.toUpperCase();
            element.append(radio);
        }
        return element;
    }

    it('has one tab stop, the checked radio', async () => {
        const element = group({value: 'c'});
        await settle();
        expect(element.radios.map(radio => radio.tabIndex)).toEqual([-1, -1, 0]);
        expect(element.radios.map(radio => radio.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
        expect(element.wrapper.getAttribute('role')).toBe('radiogroup');
        expect(element.wrapper.querySelector('.zest-legend').textContent).toBe('Delivery');
    });

    it('moves and selects with the arrows, and skips a disabled radio', async () => {
        const element = group({value: 'a'});
        const events = record(element);
        await settle();
        const [a, , c] = element.radios;
        a.focus();
        key(a, 'ArrowDown');
        expect(document.activeElement).toBe(c);
        expect(element.value).toBe('c');
        expect(events).toEqual(['input', 'change']);
        key(c, 'ArrowDown');
        expect(element.value).toBe('a');
    });

    it('selects with a click and with Space, and sends nothing for the same value', async () => {
        const element = group();
        const events = record(element);
        await settle();
        const [a, b, c] = element.radios;
        c.click();
        expect(element.value).toBe('c');
        b.click();
        expect(element.value).toBe('c');
        c.click();
        expect(events).toEqual(['input', 'change']);
        a.focus();
        key(a, ' ');
        expect(element.value).toBe('a');
    });

    it('makes its radios from options, and makes them again when the options change', async () => {
        const element = make('radio-group', {'.options': [{value: 's', label: 'Small'}, 'Medium']});
        await settle();
        expect(element.radios.map(radio => radio.querySelector('.zest-text').textContent)).toEqual(['Small', 'Medium']);
        element.options = ['One'];
        await settle();
        expect(element.radios.map(radio => radio.value)).toEqual(['One']);
    });

    it('takes the first value from a checked radio, and resets to it', async () => {
        const element = make('radio-group');
        element.innerHTML = '<radio-button value="x"></radio-button><radio-button value="y" checked></radio-button>';
        await settle();
        expect(element.value).toBe('y');
        element.radios[0].click();
        expect(element.value).toBe('x');
        element.formResetCallback();
        await settle();
        expect(element.value).toBe('y');
    });

    it('is missing a value when required, and shows the error after the form checks it', async () => {
        const element = group({required: ''});
        await settle();
        expect(element.internals.flags).toEqual({valueMissing: true});
        expect(element.wrapper.querySelector('.zest-error').textContent).toBe('');
        element.dispatchEvent(new Event('invalid'));
        expect(element.wrapper.querySelector('.zest-error').textContent).toBe('Select one.');
        expect(element.wrapper.getAttribute('aria-describedby')).toBe(element.wrapper.querySelector('.zest-error').id);
        element.radios[0].click();
        expect(element.internals.value).toBe('a');
        expect(element.internals.flags).toEqual({});
    });

    it('works with its radios in a shadow root, and when the radios are defined later', async () => {
        const element = make('shadow-radio-group', {'.options': ['p', 'q']});
        await settle();
        expect(element.shadowRoot.querySelector('slot')).not.toBeNull();
        element.radios[1].click();
        expect(element.value).toBe('q');
        expect(element.radios[1]).toBeInstanceOf(RadioButton);
        expect(element).toBeInstanceOf(RadioGroup);
    });

    it('does nothing when it is disabled', async () => {
        const element = group({value: 'a', disabled: ''});
        await settle();
        await settle();
        element.radios[2].click();
        expect(element.value).toBe('a');
        expect(element.radios[2].getAttribute('aria-disabled')).toBe('true');
    });
});

describe('the classes', () => {
    it('extend each other as the API tells', () => {
        expect(new ToggleSwitch()).toBeInstanceOf(CheckBox);
        expect(PushButton.formAssociated).toBe(true);
    });
});
