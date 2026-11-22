// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { defineControls, defaultButton, submitImplicitly, TextField, type FormControl } from '@catalystcommunity/controls';

defineControls({shadow: true});

const form = document.createElement('form');
const name = document.createElement('text-field');
name.label = 'User name';
name.required = true;
name.setAttribute('autocapitalize', 'none');
name.setAttribute('aria-describedby', 'name-rule');
name.labels = {clear: 'Löschen', charactersLeft: (count) => `${count} left`};
name.addEventListener('change', () => { const text: string = name.value; void text; });

const seats = document.createElement('spin-box');
seats.min = 1;
seats.max = 50;
seats.stepUp(2);
const count: number | null = seats.value;

const plan = document.createElement('radio-group');
plan.options = [{value: 's', label: 'Small'}, 'Medium', {value: 'l', label: 'Large', disabled: true}];

const send = document.createElement('shadow-push-button');
send.type = 'submit';
send.variant = 'primary';
const root: ShadowRoot = send.shadow;

form.append(name, seats, plan, send);
const fields: FormControl[] = [name, seats, plan, send];
const valid = fields.every(field => field.checkValidity());
const button: Element | null = defaultButton(form);
const submitted: boolean = submitImplicitly(name.form);

const custom = new TextField();
custom.setCustomValidity('That name is used');
void [count, root, valid, button, submitted, custom.text.clear];

// Type-ahead
import { attachTypeahead, matchSuggestions, typeahead } from '@catalystcommunity/controls';
const cityField = document.createElement('text-field');
cityField.suggestions = ['Berlin', 'Bern'];
cityField.suggestions = async (text) => matchSuggestions(['Boston'], text);
const plain = document.createElement('input');
const removeTypeahead: () => void = attachTypeahead(plain, {
    source: [{label: 'SUM', insertText: 'SUM(', description: 'SUM(number, ...)'}],
    autoSelect: true,
    enter: 'none',
    tab: 'accept',
    query: (field) => ({text: field.value, start: 0, end: field.value.length}),
    inline: true,
    onAccept: (item) => console.log(item.label),
});
if (typeahead.isOpen(plain)) { typeahead.close(plain); }
plain.addEventListener('typeahead-accept', (e) => console.log((e as CustomEvent).detail.item));
cityField.openSuggestions();
const isOpen: boolean = cityField.suggestionsOpen;
removeTypeahead();
