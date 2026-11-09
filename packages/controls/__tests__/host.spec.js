import { describe, it, expect, vi, afterEach } from 'vitest';
import { make, settle, key } from './helpers.js';
import { defaultButton, submitImplicitly } from '../src/form-control.js';

afterEach(() => document.body.replaceChildren());

describe('host aria-label', () => {
    it('names a push button that has text, and follows a change', async () => {
        const button = make('push-button', {'aria-label': 'Remove row 3'}, 'Remove');
        await settle();
        expect(button.button.getAttribute('aria-label')).toBe('Remove row 3');
        button.setAttribute('aria-label', 'Remove row 4');
        await settle();
        expect(button.button.getAttribute('aria-label')).toBe('Remove row 4');
        button.removeAttribute('aria-label');
        await settle();
        expect(button.button.hasAttribute('aria-label')).toBe(false);
    });

    it('wins over the visible label of a field, and goes when it is removed', async () => {
        const field = make('text-field', {label: 'Name', 'aria-label': 'Name of the account'});
        await settle();
        expect(field.field.getAttribute('aria-label')).toBe('Name of the account');
        field.removeAttribute('aria-label');
        await settle();
        expect(field.field.hasAttribute('aria-label')).toBe(false);
    });

    it('replaces the labelledby name of a select-only combo box', async () => {
        const combo = make('combo-box', {label: 'Country', '.options': ['A', 'B']});
        await settle();
        expect(combo.control.getAttribute('aria-labelledby')).toBeTruthy();
        combo.setAttribute('aria-label', 'Country of residence');
        await settle();
        expect(combo.control.hasAttribute('aria-labelledby')).toBe(false);
        expect(combo.control.getAttribute('aria-label')).toBe('Country of residence');
    });
});

describe('host aria-describedby', () => {
    it('adds the host ids to the ids of the field, and follows a change', async () => {
        const rule = Object.assign(document.createElement('p'), {id: 'rule', textContent: 'At least 12 characters'});
        document.body.append(rule);
        const field = make('text-field', {type: 'password', helper: 'Your password', 'aria-describedby': 'rule'});
        await settle();
        expect(field.field.getAttribute('aria-describedby').split(' ')).toEqual([field.help.id, 'rule']);
        field.setAttribute('aria-describedby', 'other');
        await settle();
        expect(field.field.getAttribute('aria-describedby').split(' ')).toEqual([field.help.id, 'other']);
    });

    it('describes a check box, a spin box, a combo box, and a text area', async () => {
        for (const tag of ['check-box', 'spin-box', 'combo-box', 'text-area']) {
            const control = make(tag, {'aria-describedby': 'note'});
            await settle();
            expect(control.focusTarget.getAttribute('aria-describedby'), tag).toContain('note');
        }
    });
});

describe('forwarded field attributes', () => {
    it('gives autocapitalize, spellcheck, and enterkeyhint to the input', async () => {
        const field = make('text-field', {autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'go'});
        await settle();
        expect(field.field.getAttribute('autocapitalize')).toBe('none');
        expect(field.field.getAttribute('spellcheck')).toBe('false');
        expect(field.field.getAttribute('enterkeyhint')).toBe('go');
        field.setAttribute('spellcheck', 'true');
        field.removeAttribute('autocapitalize');
        await settle();
        expect(field.field.getAttribute('spellcheck')).toBe('true');
        expect(field.field.hasAttribute('autocapitalize')).toBe(false);
    });

    it('focuses an autofocus control that is added after the page loads', async () => {
        const field = make('text-field', {autofocus: ''});
        await settle();
        expect(document.activeElement).toBe(field.field);
    });

    it('does not take the focus from another element', async () => {
        const other = document.createElement('input');
        document.body.append(other);
        other.focus();
        make('text-field', {autofocus: ''});
        await settle();
        expect(document.activeElement).toBe(other);
    });
});

describe('content that changes after the build', () => {
    it('keeps the inner button when the host text changes', async () => {
        const button = make('push-button', {}, 'Save');
        await settle();
        const inner = button.button;
        button.textContent = 'Saved';
        await settle();
        expect(button.button).toBe(inner);
        expect(inner.isConnected).toBe(true);
        expect(inner.textContent).toBe('Saved');
        button.replaceChildren('Again', document.createElement('b'));
        await settle();
        expect(inner.parentNode).toBe(button);
        expect(inner.textContent).toBe('Again');
        expect(inner.querySelector('b')).not.toBeNull();
    });

    it('moves a child that is added later into the text of a check box', async () => {
        const check = make('check-box', {}, 'Send email');
        await settle();
        const extra = document.createElement('em');
        check.append(extra);
        await settle();
        expect(check.wrapper.contains(extra)).toBe(true);
        check.textContent = 'Other';
        await settle();
        expect(check.wrapper.isConnected).toBe(true);
        expect(check.wrapper.textContent).toBe('Other');
    });

    it('keeps the circle of a radio button when its text changes', async () => {
        const radio = make('radio-button', {value: 'a'}, 'First');
        await settle();
        radio.textContent = 'Changed';
        await settle();
        expect(radio.querySelector('.zest-radio-button')).not.toBeNull();
        expect(radio.textContent).toBe('Changed');
    });
});

describe('combo box label', () => {
    it('is a <label for> only for the editable box', async () => {
        const combo = make('combo-box', {label: 'Fruit', '.options': ['Apple']});
        await settle();
        const label = combo.wrapper.querySelector('.zest-label');
        expect(label.localName).toBe('span');
        combo.editable = true;
        await settle();
        const editableLabel = combo.wrapper.querySelector('.zest-label');
        expect(editableLabel.localName).toBe('label');
        expect(editableLabel.htmlFor).toBe(combo.control.id);
        expect(editableLabel.textContent).toBe('Fruit');
    });
});

describe('implicit submission', () => {
    // jsdom does not associate a custom element with a form, so the form is a fake
    function fakeForm(...elements) {
        return {elements, requestSubmit: vi.fn()};
    }

    it('clicks the first submit button', async () => {
        const cancel = make('push-button', {}, 'Cancel');
        const save = make('push-button', {type: 'submit'}, 'Save');
        const other = make('push-button', {type: 'submit'}, 'Other');
        await settle();
        const clicked = vi.fn();
        save.addEventListener('click', clicked);
        const form = fakeForm(cancel, save, other);
        expect(defaultButton(form)).toBe(save);
        expect(submitImplicitly(form)).toBe(true);
        expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the default button is disabled', async () => {
        const save = make('push-button', {type: 'submit', disabled: ''}, 'Save');
        const other = make('push-button', {type: 'submit'}, 'Other');
        await settle();
        const form = fakeForm(save, other);
        expect(submitImplicitly(form)).toBe(false);
        expect(form.requestSubmit).not.toHaveBeenCalled();
    });

    it('with no submit button, submits only a form with one field', async () => {
        const one = make('text-field');
        const two = make('text-field');
        await settle();
        const single = fakeForm(one);
        expect(submitImplicitly(single)).toBe(true);
        expect(single.requestSubmit).toHaveBeenCalledTimes(1);
        const double = fakeForm(one, two);
        expect(submitImplicitly(double)).toBe(false);
        expect(double.requestSubmit).not.toHaveBeenCalled();
    });

    it('Enter in a text field stops the native action, but not during a composition', async () => {
        const field = make('text-field');
        await settle();
        expect(key(field.field, 'Enter').defaultPrevented).toBe(true);
        expect(key(field.field, 'Enter', {shiftKey: true}).defaultPrevented).toBe(true);
        expect(key(field.field, 'Enter', {isComposing: true}).defaultPrevented).toBe(false);
    });

    it('a light DOM submit button has a native submit button inside', async () => {
        const light = make('push-button', {type: 'submit'}, 'Save');
        const shadow = make('shadow-push-button', {type: 'submit'}, 'Save');
        await settle();
        expect(light.button.type).toBe('submit');
        expect(shadow.button.type).toBe('button');
    });
});
