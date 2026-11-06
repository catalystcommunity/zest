import { describe, it, expect, vi, afterEach } from 'vitest';
import { make, settle, record, key } from './helpers.js';

afterEach(() => document.body.replaceChildren());

function type(field, text) {
    field.value = text;
    field.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
}

describe('TextField', () => {
    it('labels its input, and sends one input event for each change of the text', async () => {
        const element = make('text-field', {label: 'Name', helper: 'Your full name'});
        const events = record(element);
        const outer = vi.fn();
        document.body.addEventListener('input', outer);
        await settle();
        const label = element.wrapper.querySelector('label');
        expect(label.textContent).toBe('Name');
        expect(label.htmlFor).toBe(element.field.id);
        expect(element.field.getAttribute('aria-describedby')).toBe(element.help.id);
        type(element.field, 'Ada');
        expect(element.value).toBe('Ada');
        element.field.dispatchEvent(new Event('change', {bubbles: true}));
        expect(events).toEqual(['input', 'change']);
        expect(outer).toHaveBeenCalledTimes(1);
        document.body.removeEventListener('input', outer);
    });

    it('shows a value from code, and gives it to the form', async () => {
        const element = make('text-field', {value: 'first'});
        await settle();
        expect(element.field.value).toBe('first');
        element.value = 'second';
        await settle();
        expect(element.field.value).toBe('second');
        expect(element.internals.value).toBe('second');
    });

    it('copies the validity of the input, and shows the problem only after the user leaves the field', async () => {
        const element = make('text-field', {required: '', label: 'Email', type: 'email'});
        await settle();
        expect(element.internals.flags.valueMissing).toBe(true);
        expect(element.field.hasAttribute('aria-invalid')).toBe(false);
        type(element.field, 'not an email');
        element.field.dispatchEvent(new Event('change', {bubbles: true}));
        expect(element.internals.flags.typeMismatch).toBe(true);
        expect(element.field.getAttribute('aria-invalid')).toBe('true');
        expect(element.help.classList.contains('error')).toBe(true);
        type(element.field, 'ada@example.com');
        expect(element.internals.flags).toEqual({});
        expect(element.field.hasAttribute('aria-invalid')).toBe(false);
    });

    it('checks the pattern, minlength from code, and a custom error', async () => {
        const element = make('text-field', {pattern: '\\d+', minlength: '3', value: 'ab'});
        await settle();
        expect(element.internals.flags.patternMismatch).toBe(true);
        expect(element.internals.flags.tooShort).toBe(true);
        element.value = '1234';
        await settle();
        expect(element.internals.flags).toEqual({});
        element.setCustomValidity('That code is used');
        await settle();
        expect(element.internals.flags.customError).toBe(true);
        expect(element.help.textContent).toBe('That code is used');
    });

    it('clears a search with the button and with Escape', async () => {
        const element = make('text-field', {type: 'search', value: 'zest'});
        const events = record(element);
        await settle();
        const clear = element.wrapper.querySelector('.clear');
        expect(clear.hidden).toBe(false);
        expect(clear.getAttribute('aria-label')).toBe('Clear');
        clear.click();
        expect(element.value).toBe('');
        expect(events).toEqual(['input', 'change']);
        expect(clear.hidden).toBe(true);
        type(element.field, 'again');
        key(element.field, 'Escape');
        expect(element.value).toBe('');
    });

    it('shows and hides a password', async () => {
        const element = make('text-field', {type: 'password'});
        await settle();
        const reveal = element.wrapper.querySelector('.reveal');
        expect(element.field.type).toBe('password');
        reveal.click();
        expect(element.field.type).toBe('text');
        expect(reveal.getAttribute('aria-pressed')).toBe('true');
        expect(reveal.textContent).toBe('Hide');
    });

    it('describes its prefix and suffix, and refuses an unknown type', async () => {
        const element = make('text-field', {'prefix-text': '$', 'suffix-text': 'USD', type: 'color'});
        await settle();
        const ids = element.field.getAttribute('aria-describedby').split(' ');
        expect(ids.map(id => document.getElementById(id).textContent)).toEqual(['$', 'USD']);
        expect(element.field.type).toBe('text');
    });

    it('resets to its value attribute, and forgets that it was touched', async () => {
        const element = make('text-field', {value: 'start', required: ''});
        await settle();
        type(element.field, '');
        element.field.dispatchEvent(new Event('change', {bubbles: true}));
        expect(element.field.getAttribute('aria-invalid')).toBe('true');
        element.formResetCallback();
        await settle();
        expect(element.value).toBe('start');
        expect(element.field.hasAttribute('aria-invalid')).toBe(false);
    });
});

describe('TextArea', () => {
    it('counts the characters and speaks only near the limit', async () => {
        const element = make('text-area', {maxlength: '50', rows: '4'});
        await settle();
        const count = element.wrapper.querySelector('.count');
        const live = element.wrapper.querySelector('[aria-live]');
        expect(element.field.rows).toBe(4);
        expect(count.textContent).toBe('0 of 50');
        type(element.field, 'x'.repeat(20));
        expect(live.textContent).toBe('');
        type(element.field, 'x'.repeat(42));
        expect(count.textContent).toBe('42 of 50');
        expect(live.textContent).toBe('8 characters left');
        type(element.field, 'x'.repeat(50));
        expect(count.classList.contains('full')).toBe(true);
        expect(live.textContent).toBe('0 characters left');
        expect(element.field.getAttribute('aria-describedby')).toContain(count.id);
    });

    it('can grow with its text', async () => {
        const element = make('text-area', {autogrow: ''});
        await settle();
        expect(element.wrapper.classList.contains('grow')).toBe(true);
    });
});

describe('SpinBox', () => {
    it('has the role spinbutton, with its limits and a formatted value', async () => {
        const element = make('spin-box', {min: '0', max: '10', value: '1234.5', step: '0.5', locale: 'de-DE'});
        await settle();
        const input = element.input;
        expect(input.getAttribute('role')).toBe('spinbutton');
        expect(element.value).toBe(1234.5);
        expect(input.value).toBe('1.234,5');
        expect(input.getAttribute('aria-valuemax')).toBe('10');
    });

    it('steps with the arrows, the page keys, Home, and End, and sends input and change', async () => {
        const element = make('spin-box', {min: '0', max: '100', value: '50', step: '5'});
        const events = record(element);
        await settle();
        key(element.input, 'ArrowUp');
        expect(element.value).toBe(55);
        expect(events).toEqual(['input', 'change']);
        key(element.input, 'PageDown');
        expect(element.value).toBe(45);
        key(element.input, 'End');
        expect(element.value).toBe(100);
        key(element.input, 'ArrowUp');
        expect(element.value).toBe(100);
        key(element.input, 'Home');
        expect(element.value).toBe(0);
        expect(element.input.getAttribute('aria-valuetext')).toBe('0');
    });

    it('goes to the next step from a value between steps', async () => {
        const element = make('spin-box', {step: '10', value: '13'});
        await settle();
        element.stepUp();
        expect(element.value).toBe(20);
        element.value = 13;
        element.stepDown();
        expect(element.value).toBe(10);
    });

    it('reads typed text in the locale, and clamps and formats it when the user commits', async () => {
        const element = make('spin-box', {min: '0', max: '5000', locale: 'de-DE', precision: '2'});
        const events = record(element);
        await settle();
        type(element.input, '1.234,56');
        expect(element.value).toBe(1234.56);
        expect(events).toEqual(['input']);
        type(element.input, '9999');
        element.input.dispatchEvent(new Event('blur'));
        expect(element.value).toBe(5000);
        expect(element.input.value).toBe('5.000,00');
        expect(events).toEqual(['input', 'input', 'change']);
        type(element.input, 'abc');
        element.commit();
        expect(element.value).toBe(5000);
    });

    it('parses digits of other scripts and an empty text', async () => {
        const element = make('spin-box', {locale: 'ar-EG'});
        await settle();
        expect(element.parse('١٢')).toBe(12);
        expect(element.parse('')).toBeNull();
        expect(element.parse('1-2')).toBeUndefined();
    });

    it('is missing a value when required and empty, and disables a button at a limit', async () => {
        const element = make('spin-box', {required: '', min: '0', max: '1'});
        await settle();
        expect(element.internals.flags).toEqual({valueMissing: true});
        element.value = 1;
        await settle();
        const [up, down] = element.wrapper.querySelectorAll('.steps button');
        expect(up.disabled).toBe(true);
        expect(down.disabled).toBe(false);
        expect(element.internals.value).toBe('1');
    });

    it('steps with a press of a button, and repeats while it is held', async () => {
        vi.useFakeTimers();
        const element = make('spin-box', {value: '0'});
        await settle();
        const up = element.wrapper.querySelector('.steps button');
        up.dispatchEvent(new PointerEvent('pointerdown', {button: 0, bubbles: true}));
        expect(element.value).toBe(1);
        vi.advanceTimersByTime(400 + 60 * 3);
        expect(element.value).toBe(4);
        up.dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
        vi.advanceTimersByTime(1000);
        expect(element.value).toBe(4);
        vi.useRealTimers();
    });
});

describe('SliderControl', () => {
    it('has the role slider with its values, on a step', async () => {
        const element = make('slider-control', {label: 'Volume', min: '0', max: '10', step: '2', value: '5', unit: 'dB'});
        await settle();
        const thumb = element.thumb;
        expect(thumb.getAttribute('role')).toBe('slider');
        expect(thumb.getAttribute('aria-valuenow')).toBe('6');
        expect(thumb.getAttribute('aria-valuetext')).toBe('6 dB');
        expect(document.getElementById(thumb.getAttribute('aria-labelledby')).textContent).toBe('Volume');
    });

    it('moves with the keys, and the arrows change direction from right to left', async () => {
        const element = make('slider-control', {value: '50'});
        const events = record(element);
        await settle();
        key(element.thumb, 'ArrowRight');
        expect(element.value).toBe(51);
        expect(events).toEqual(['input', 'change']);
        key(element.thumb, 'PageDown');
        expect(element.value).toBe(41);
        key(element.thumb, 'End');
        expect(element.value).toBe(100);
        key(element.thumb, 'ArrowUp');
        expect(events.length).toBe(6);
        element.dir = 'rtl';
        key(element.thumb, 'ArrowLeft');
        expect(element.value).toBe(100);
        key(element.thumb, 'ArrowRight');
        expect(element.value).toBe(99);
    });

    it('takes the value from the pointer, and sends change one time at the end of a drag', async () => {
        const element = make('slider-control', {value: '0'});
        const events = record(element);
        await settle();
        const area = element.wrapper.querySelector('.area');
        area.getBoundingClientRect = () => ({left: 100, top: 0, width: 200, height: 20});
        area.dispatchEvent(new PointerEvent('pointerdown', {button: 0, clientX: 150, pointerId: 1}));
        expect(element.value).toBe(25);
        area.dispatchEvent(new PointerEvent('pointermove', {clientX: 300, pointerId: 1}));
        area.dispatchEvent(new PointerEvent('pointermove', {clientX: 500, pointerId: 1}));
        expect(element.value).toBe(100);
        area.dispatchEvent(new PointerEvent('pointerup', {pointerId: 1}));
        expect(events).toEqual(['input', 'input', 'change']);
    });

    it('puts the bottom at the minimum when vertical', async () => {
        const element = make('slider-control', {orientation: 'vertical'});
        await settle();
        const area = element.wrapper.querySelector('.area');
        area.getBoundingClientRect = () => ({left: 0, top: 0, width: 20, height: 100});
        area.dispatchEvent(new PointerEvent('pointerdown', {button: 0, clientY: 20, pointerId: 1}));
        expect(element.value).toBe(80);
        expect(element.thumb.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('draws ticks and marks, and uses a format function', async () => {
        const element = make('slider-control', {min: '1', max: '5', ticks: '', '.marks': [{value: 1, label: 'Bad'}, {value: 5, label: 'Good'}]});
        element.format = (value) => `${value} stars`;
        await settle();
        expect(element.wrapper.querySelectorAll('.tick').length).toBe(5);
        expect([...element.wrapper.querySelectorAll('.mark')].map(mark => mark.textContent)).toEqual(['Bad', 'Good']);
        expect(element.thumb.getAttribute('aria-valuetext')).toBe('1 stars');
    });

    it('is not focusable and does not move when it is disabled', async () => {
        const element = make('slider-control', {disabled: '', value: '10'});
        await settle();
        expect(element.thumb.tabIndex).toBe(-1);
        key(element.thumb, 'ArrowRight');
        expect(element.value).toBe(10);
    });
});

describe('ProgressBar', () => {
    it('gives its value as a percent, and has no value when it is indeterminate', async () => {
        const element = make('progress-bar', {label: 'Upload', value: '25', 'show-value': ''});
        await settle();
        const bar = element.bar;
        expect(bar.getAttribute('role')).toBe('progressbar');
        expect(bar.getAttribute('aria-valuenow')).toBe('25');
        expect(bar.getAttribute('aria-valuetext')).toBe('25%');
        element.removeAttribute('value');
        await settle();
        expect(bar.hasAttribute('aria-valuenow')).toBe(false);
        expect(bar.getAttribute('aria-valuetext')).toBe('Working');
        expect(element.wrapper.classList.contains('indeterminate')).toBe(true);
    });

    it('uses its own value text and maximum', async () => {
        const element = make('progress-bar', {value: '3', max: '12', 'value-text': '3 of 12 files'});
        await settle();
        expect(element.bar.getAttribute('aria-valuetext')).toBe('3 of 12 files');
        expect(element.wrapper.style.getPropertyValue('--_pos')).toBe('0.25');
    });
});
