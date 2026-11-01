import { DataComponent } from "@catalystcommunity/base-components";
import * as model from "./model.js";

// The design and each option are in the README. In short: data comes in through attributes, the
// `value` property, updateConfig, or a data registry. Everything goes out as a bubbling, composed
// event on the element, so an EventBroker subscriber hears it on the document.

const defaultStyles = `<style>
date-time-picker, :host {
    display: inline-block;
}
.dtp {
    --dtp-accent: var(--zest-dtp-accent, Highlight);
    --dtp-accent-text: var(--zest-dtp-accent-text, HighlightText);
    --dtp-background: var(--zest-dtp-background, Canvas);
    --dtp-text: var(--zest-dtp-text, CanvasText);
    --dtp-muted: var(--zest-dtp-muted, GrayText);
    --dtp-range: var(--zest-dtp-range, color-mix(in srgb, var(--dtp-accent) 25%, transparent));
    --dtp-radius: var(--zest-dtp-radius, 4px);
    --dtp-day-size: var(--zest-dtp-day-size, 2.25em);
    display: inline-block;
    max-width: 100%;
}
.dtp .input-row {
    display: flex;
    align-items: stretch;
    gap: 2px;
}
.dtp .input-row input {
    flex: 1;
    min-width: 0;
    font: inherit;
}
.dtp .toggle {
    font: inherit;
    cursor: pointer;
}
.dtp .picker {
    position: fixed;
    inset: auto;
    margin: 0;
    z-index: 1000;
    flex-direction: column;
    gap: 0.5em;
    box-sizing: border-box;
    max-width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
    overflow: auto;
    padding: 0.5em;
    background: var(--dtp-background);
    color: var(--dtp-text);
    border: 1px solid var(--dtp-muted);
    border-radius: var(--dtp-radius);
}
.dtp.inline .picker {
    position: static;
    max-height: none;
}
.dtp .calendars {
    display: flex;
    flex-wrap: wrap;
    gap: 1em;
}
.dtp .month-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
    margin-bottom: 0.25em;
}
.dtp .month-name {
    flex: 1;
    white-space: nowrap;
    font: inherit;
    font-weight: bold;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
}
.dtp .nav {
    font: inherit;
    width: 2em;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--dtp-radius);
    color: inherit;
    cursor: pointer;
}
.dtp .nav[disabled] {
    visibility: hidden;
}
.dtp .week, .dtp .weekdays {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: var(--dtp-day-size);
}
.dtp .weekday, .dtp .week-number {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8em;
    color: var(--dtp-muted);
}
.dtp .day, .dtp .cell, .dtp .outside {
    position: relative;
    box-sizing: border-box;
    height: var(--dtp-day-size);
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--dtp-radius);
    background: none;
    color: inherit;
    font: inherit;
}
.dtp .day, .dtp .cell {
    cursor: pointer;
}
.dtp .day:hover, .dtp .cell:hover, .dtp .nav:hover, .dtp .slot:hover {
    border-color: var(--dtp-accent);
}
.dtp .cells {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    min-width: 15em;
}
.dtp .cell {
    height: 2.75em;
}
.dtp .other-month {
    opacity: 0.5;
}
.dtp .today {
    text-decoration: underline;
    font-weight: bold;
}
.dtp .in-range, .dtp .in-range-preview {
    background: var(--dtp-range);
}
.dtp .selected, .dtp .selected:hover {
    background: var(--dtp-accent);
    color: var(--dtp-accent-text);
}
.dtp .unavailable, .dtp .unavailable:hover {
    color: var(--dtp-muted);
    text-decoration: line-through;
    cursor: not-allowed;
    border-color: transparent;
}
.dtp .badge {
    position: absolute;
    inset-block-end: 1px;
    inset-inline-end: 2px;
    font-size: 0.6em;
    line-height: 1;
}
.dtp .time-rows {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
}
.dtp .time-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
}
.dtp select {
    font: inherit;
}
.dtp .slots {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(5.5em, 1fr));
    gap: 2px;
    max-height: 14em;
    overflow-y: auto;
}
.dtp .slot {
    font: inherit;
    padding: 0.25em;
    background: none;
    color: inherit;
    border: 1px solid var(--dtp-muted);
    border-radius: var(--dtp-radius);
    cursor: pointer;
}
.dtp .presets, .dtp .footer {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.dtp .footer {
    justify-content: space-between;
}
.dtp .footer > div {
    display: flex;
    gap: 4px;
}
.dtp .footer button, .dtp .presets button {
    font: inherit;
    cursor: pointer;
}
.dtp .live {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}
@media (pointer: coarse) {
    .dtp {
        --dtp-day-size: var(--zest-dtp-day-size, 2.75em);
    }
}
</style>`;

const MODES = ['date', 'datetime', 'time', 'month', 'week', 'year'];
const SELECTIONS = ['single', 'range', 'multiple'];

const OPTION_ATTRIBUTES = [
    'mode', 'selection', 'min', 'max', 'min-time', 'max-time', 'hour-step', 'minute-step', 'second-step',
    'disabled-dates', 'disabled-weekdays', 'first-day-of-week', 'locale', 'twenty-four-hour-format',
    'include-seconds', 'format', 'time-zone', 'time-zone-selectable', 'time-view', 'time-slots',
    'default-time', 'months', 'show-week-numbers', 'fixed-weeks', 'inline', 'clearable', 'min-range-days',
    'max-range-days', 'allow-disabled-in-range', 'placeholder', 'label', 'initial-date', 'no-typing',
    'required', 'disabled', 'readonly',
];

const DEFAULT_LABELS = {
    previousMonth: 'Previous month', nextMonth: 'Next month',
    previousYear: 'Previous year', nextYear: 'Next year',
    previousYears: 'Previous years', nextYears: 'Next years',
    chooseMonth: 'Select a month', chooseYear: 'Select a year',
    open: 'Open the picker', dialog: 'Select a date or a time',
    hour: 'Hour', minute: 'Minute', second: 'Second', period: 'AM or PM',
    start: 'Start', end: 'End', week: 'Wk', clear: 'Clear', done: 'Done',
    timeZone: 'Time zone', localTimeZone: 'Local time',
};

const DEFAULT_MESSAGES = {
    'value-missing': 'Select a value.',
    'before-min': 'This value is before the minimum.',
    'after-max': 'This value is after the maximum.',
    'disabled-date': 'This date is not available.',
    'disabled-time': 'This time is not available.',
    step: 'This time is not one of the allowed steps.',
    'range-too-short': 'This range is too short.',
    'range-too-long': 'This range is too long.',
    'disabled-in-range': 'This range holds a date that is not available.',
};

const VALIDITY_FLAGS = {
    'value-missing': 'valueMissing', 'before-min': 'rangeUnderflow', 'after-max': 'rangeOverflow',
    step: 'stepMismatch', 'range-too-short': 'rangeUnderflow', 'range-too-long': 'rangeOverflow',
};

const kebab = (name) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
const RANGE_DISPLAY_SEPARATOR = ' – ';
const MULTIPLE_DISPLAY_SEPARATOR = '; ';

export default class DateTimePicker extends DataComponent {
    static formAssociated = true;
    static changeAttributes = ['value', ...OPTION_ATTRIBUTES];

    input;
    picker;
    toggle;
    #wrapper;
    #inputRow;
    #live;
    #internals = null;

    #config = {};
    #selected = [];
    #rawValue = null;
    #resolved = false;
    #anchor = null;
    #referenceParts = null;
    #timeZoneOverride;
    #formDisabled = false;
    #customValidity = '';
    #problem = null;

    #open = false;
    #view = {year: 2000, month: 1};
    #viewIsSet = false;
    #calendarView = 'days';
    #focusDay = null;
    #moveFocusToGrid = false;
    #listening = false;
    #onDocumentClick;
    #onViewportChange;

    constructor(){
        super();
        this.template = "";
        this.styleTemplate = defaultStyles;
        this.#internals = this.attachInternals?.() ?? null;
        this.input = document.createElement("input");
        this.picker = document.createElement("div");
        this.toggle = document.createElement("button");
        this.#inputRow = document.createElement("div");
        this.#wrapper = document.createElement("div");
        this.#live = document.createElement("div");
        // A click in a shadow root shows the host as its target at the document, so we read the path
        this.#onDocumentClick = (e) => {
            if (this.#open && !e.composedPath().includes(this)) {
                this.closePicker();
            }
        };
        this.#onViewportChange = () => this.#position();
    }

    // Options: an attribute comes first, and then the data from updateConfig or a registry

    #option(name) {
        const attribute = kebab(name);
        return this.hasAttribute(attribute) ? this.getAttribute(attribute) : this.#config[name];
    }
    #flag(name, fallback = false) {
        const value = this.#option(name);
        if (value === undefined || value === null) { return fallback; }
        return typeof value === 'boolean' ? value : value !== 'false';
    }
    get mode() {
        const mode = this.#option('mode');
        return MODES.includes(mode) ? mode : 'date';
    }
    get selection() {
        const selection = this.#option('selection');
        return SELECTIONS.includes(selection) ? selection : 'single';
    }
    get locale() {
        return this.#option('locale') || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    }
    get timeZone() {
        return this.#timeZoneOverride ?? (this.#option('timeZone') || undefined);
    }
    get #includeSeconds() { return this.#flag('includeSeconds'); }
    get #twentyFourHours() {
        const value = this.#option('twentyFourHourFormat');
        return value === undefined || value === null ? model.usesTwentyFourHours(this.locale) : this.#flag('twentyFourHourFormat');
    }
    get #displayOptions() {
        return {
            locale: this.locale, format: this.#option('format') || 'medium',
            twentyFourHours: this.#twentyFourHours, includeSeconds: this.#includeSeconds,
        };
    }
    get #rules() {
        const options = {};
        for (const name of ['min', 'max', 'minTime', 'maxTime', 'hourStep', 'minuteStep', 'secondStep', 'disabledDates',
            'disabledWeekdays', 'minRangeDays', 'maxRangeDays']) {
            options[name] = this.#option(name);
        }
        return model.buildRules({
            ...options,
            timeZone: this.timeZone,
            allowDisabledInRange: this.#flag('allowDisabledInRange'),
            isDateDisabled: this.#config.isDateDisabled,
            isTimeDisabled: this.#config.isTimeDisabled,
            getDayInfo: this.#config.getDayInfo,
        }, this.mode);
    }
    get #isDisabled() { return this.#flag('disabled') || this.#formDisabled; }
    get #isReadOnly() { return this.#flag('readonly'); }
    get #isInline() { return this.#flag('inline'); }
    get #hasTime() { return this.mode === 'time' || this.mode === 'datetime'; }
    get #hasCalendar() { return this.mode !== 'time'; }
    #label(name) { return this.#config.labels?.[name] ?? DEFAULT_LABELS[name]; }
    #now() { return model.fromInstant(new Date(), this.timeZone); }

    // The data interface

    updateConfig(partial = {}) {
        const {value, ...config} = partial;
        this.#config = {...this.#config, ...config};
        if (value !== undefined) { this.value = value; }
        this.#refresh();
    }
    postDataRegistration() {
        if (this.registerResult?.pickerConfig) {
            this.updateConfig(this.registerResult.pickerConfig);
        }
    }

    get value() {
        if (!this.#resolved && this.#rawValue !== null) { return this.#rawValue; }
        return model.formatSelection(this.#selected, this.mode, this.selection, this.#includeSeconds);
    }
    // Like an input: setting the value sends no event. A value that it cannot read clears it.
    set value(text) {
        this.#rawValue = text === null || text === undefined ? '' : String(text);
        this.#resolved = false;
        if (this.isConnected) {
            this.#resolveValue();
            this.#refresh();
        }
    }
    #resolveValue() {
        const raw = this.#rawValue ?? '';
        this.#resolved = true;
        const parsed = model.parseSelection(raw, this.mode, this.selection, {timeZone: this.timeZone});
        if (parsed === null) {
            console.warn(`Can't read the value of a DateTimePicker in ${this.mode} mode: ${raw}`);
        }
        this.#selected = parsed ?? [];
        this.#anchor = null;
        if (this.#selected.length && this.#hasCalendar) {
            this.#showViewOf(this.#selected[0]);
        }
        this.#syncForm();
    }
    get valueAsDate() {
        return this.#selected.length ? this.#instantOf(this.#selected[0]) : null;
    }
    set valueAsDate(date) {
        this.value = date ? model.formatValue(model.truncate(model.fromInstant(date, this.timeZone), this.mode), this.mode, this.#includeSeconds) : '';
    }
    get dates() {
        return this.#selected.map(value => this.#instantOf(value));
    }
    get userSelected() { return this.#selected.length > 0; }
    // The selected value, or else the date that the picker starts at
    get selectedDate() {
        return this.#selected.length ? this.#instantOf(this.#selected[0]) : model.toInstant(this.#reference(), this.timeZone);
    }
    set selectedDate(date) {
        this.#referenceParts = model.fromInstant(date, this.timeZone);
    }
    get viewMonth() { return {...this.#view}; }
    #reference() {
        if (this.#referenceParts) { return this.#referenceParts; }
        const initial = this.#option('initialDate');
        const parsed = initial ? model.parseValue(initial, 'datetime', {timeZone: this.timeZone}) : null;
        return parsed ?? this.#now();
    }
    #instantOf(value) {
        // A time alone is on today, so that a consumer always gets a Date
        return model.toInstant(this.mode === 'time' ? {...this.#now(), ...value} : value, this.timeZone);
    }

    // The form interface

    get name() { return this.getAttribute('name'); }
    set name(value) { this.setAttribute('name', value); }
    get disabled() { return this.#isDisabled; }
    set disabled(value) { this.toggleAttribute('disabled', Boolean(value)); }
    get required() { return this.#flag('required'); }
    set required(value) { this.toggleAttribute('required', Boolean(value)); }
    get readOnly() { return this.#isReadOnly; }
    set readOnly(value) { this.toggleAttribute('readonly', Boolean(value)); }
    get form() { return this.#internals?.form ?? null; }
    get validity() { return this.#internals?.validity; }
    get validationMessage() { return this.#internals?.validationMessage ?? ''; }
    get willValidate() { return this.#internals?.willValidate ?? false; }
    get validationProblem() { return this.#problem; }
    checkValidity() { return this.#internals?.checkValidity?.() ?? this.#problem === null; }
    reportValidity() { return this.#internals?.reportValidity?.() ?? this.#problem === null; }
    setCustomValidity(message) {
        this.#customValidity = message || '';
        this.#syncForm();
    }
    formResetCallback() {
        this.#customValidity = '';
        this.value = this.getAttribute('value') ?? '';
    }
    formDisabledCallback(disabled) {
        this.#formDisabled = disabled;
        this.#refresh();
    }
    formStateRestoreCallback(state) {
        if (typeof state === 'string') { this.value = state; }
    }
    focus(options) {
        const target = this.#isInline ? this.picker.querySelector('.calendars [tabindex="0"], select, .slot') : this.input;
        target?.focus(options);
    }
    #findProblem() {
        if (!this.#selected.length) { return this.required ? 'value-missing' : null; }
        const rules = this.#rules;
        for (const value of this.#selected) {
            const problem = model.valueProblem(value, rules);
            if (problem) { return problem; }
        }
        return this.selection === 'range' ? model.rangeProblem(this.#selected[0], this.#selected[1], rules) : null;
    }
    #syncForm() {
        this.#problem = this.#findProblem();
        const internals = this.#internals;
        const invalid = this.#problem !== null || this.#customValidity !== '';
        // An empty aria-invalid means false to a screen reader
        if (invalid) { this.input.setAttribute('aria-invalid', 'true'); } else { this.input.removeAttribute('aria-invalid'); }
        if (!internals?.setFormValue) { return; }
        const value = this.value;
        internals.setFormValue(value === '' ? null : value, value);
        if (this.#customValidity) {
            internals.setValidity({customError: true}, this.#customValidity, this.input);
        } else if (this.#problem) {
            const flag = VALIDITY_FLAGS[this.#problem] ?? 'badInput';
            const message = this.#config.validationMessages?.[this.#problem] ?? DEFAULT_MESSAGES[this.#problem];
            internals.setValidity({[flag]: true}, message, this.input);
        } else {
            internals.setValidity({});
        }
    }

    // The life of the element

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) { return; }
        if (name === 'value') {
            this.value = newValue ?? '';
            return;
        }
        if ((name === 'mode' || name === 'selection') && this.#resolved) {
            // Another mode reads the same text another way, or clears it
            this.#rawValue = model.formatSelection(this.#selected, oldKind(name, oldValue, this.mode), oldKind(name, oldValue, this.selection, true), this.#includeSeconds);
            this.#resolved = false;
        }
        if (this.isConnected) {
            if (!this.#resolved) { this.#resolveValue(); }
            this.#refresh();
        }
    }
    connectedCallback(){
        super.connectedCallback();
        if (this.#rawValue === null && this.hasAttribute('value')) {
            this.#rawValue = this.getAttribute('value');
        }
        const initial = this.#option('initialDate');
        if (initial && !model.parseValue(initial, 'datetime')) {
            console.warn("Can't parse date for initialDate in DateTimePicker: " + initial);
        }
        if (this.registryName && this.dataRegisterFuncName) {
            this.doDataRegistration();
        }
        if (!this.#resolved) { this.#resolveValue(); }
        // Focusable from code, with no tab stop. A shadow root does this with delegatesFocus.
        if (this.root === this && !this.hasAttribute('tabindex')) { this.tabIndex = -1; }
        this.initInput();
        this.initPicker();
        document.addEventListener("click", this.#onDocumentClick);
        this.render();
    }
    disconnectedCallback(){
        super.disconnectedCallback();
        document.removeEventListener("click", this.#onDocumentClick);
        if (this.#open) { this.closePicker(); }
    }
    render(){
        this.root.innerHTML = "";
        this.#inputRow.className = "input-row";
        this.#inputRow.replaceChildren(this.input, this.toggle);
        this.#wrapper.replaceChildren(this.#inputRow, this.picker);
        this.root.appendChild(this.#wrapper);
        if (this.styleTemplate) {
            this.#wrapper.appendChild(this.stringToElement(`${this.styleTemplate}`));
        }
        this.#refresh();
    }
    #refresh() {
        if (!this.isConnected) { return; }
        this.#syncForm();
        this.#syncInput();
        this.#applyInline();
        this.#draw();
        if (this.#open) { this.#position(); }
    }
    #applyInline() {
        const inline = this.#isInline;
        this.#wrapper.className = inline ? 'dtp inline' : 'dtp';
        this.#inputRow.hidden = inline;
        this.#inputRow.style.display = inline ? 'none' : '';
        if (inline) {
            if (this.#popoverIsOpen()) { this.picker.hidePopover(); }
            this.picker.removeAttribute('popover');
            this.picker.style.display = 'flex';
            this.picker.style.top = '';
            this.picker.style.left = '';
        } else if (!this.#open) {
            this.picker.style.display = 'none';
        }
    }
    #popoverIsOpen() {
        try {
            return this.picker.matches(':popover-open');
        } catch {
            return false;
        }
    }

    // The input

    #displayText() {
        const show = (value) => this.#config.formatDisplay?.(model.formatValue(value, this.mode, this.#includeSeconds), value)
            ?? model.formatDisplay(value, this.mode, this.#displayOptions);
        if (this.#anchor) { return show(this.#anchor) + RANGE_DISPLAY_SEPARATOR; }
        if (this.selection === 'range') { return this.#selected.map(show).join(RANGE_DISPLAY_SEPARATOR); }
        return this.#selected.map(show).join(MULTIPLE_DISPLAY_SEPARATOR);
    }
    #syncInput() {
        this.input.value = this.#displayText();
        this.input.placeholder = this.#option('placeholder') ?? this.#defaultPlaceholder();
        const disabled = this.#isDisabled;
        this.input.disabled = disabled;
        this.input.readOnly = this.#isReadOnly || this.#flag('noTyping');
        this.toggle.disabled = disabled || this.#isReadOnly;
        // A <label for> names the host, and a screen reader is on the input inside it
        const label = this.#option('label') ?? this.getAttribute('aria-label') ?? this.#internals?.labels?.[0]?.textContent?.trim();
        if (label) { this.input.setAttribute('aria-label', label); }
        if (this.required) { this.input.setAttribute('aria-required', 'true'); } else { this.input.removeAttribute('aria-required'); }
    }
    #defaultPlaceholder() {
        const reference = this.#hasTime && !this.#hasCalendar ? this.#defaultTime() : this.#reference();
        return model.formatDisplay(model.truncate({...this.#reference(), ...(this.mode === 'time' ? reference : {})}, this.mode), this.mode, this.#displayOptions);
    }
    initInput() {
        this.input.type = "text";
        this.input.setAttribute("role", "combobox");
        this.input.setAttribute("autocomplete", "off");
        this.input.setAttribute("aria-haspopup", "dialog");
        this.input.setAttribute("aria-expanded", String(this.#open));
        this.input.setAttribute("part", "input");
        this.input.placeholder = this.#option('placeholder') ?? this.#defaultPlaceholder();
        this.toggle.type = "button";
        this.toggle.className = "toggle";
        this.toggle.setAttribute("part", "toggle");
        this.toggle.setAttribute("aria-label", this.#label('open'));
        this.toggle.textContent = this.mode === 'time' ? '\u{1F551}︎' : '\u{1F4C5}︎';
        // The elements live as long as the component, and connectedCallback can run more than one time
        if (this.#listening) { return; }
        this.#listening = true;
        this.input.addEventListener("click", () => this.openPicker());
        this.toggle.addEventListener("click", () => {
            if (this.#open) {
                this.closePicker();
                this.input.focus();
            } else {
                this.openPicker();
                this.#focusIntoPicker();
            }
        });
        this.input.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                this.openPicker();
                this.#focusIntoPicker();
            } else if (e.key === "Enter") {
                const changed = this.input.value !== this.#displayText();
                if (changed) {
                    e.preventDefault();
                    this.#commitTyped();
                } else if (this.form && !this.#isReadOnly) {
                    e.preventDefault();
                    this.form.requestSubmit();
                }
            }
        });
        this.input.addEventListener("change", () => this.#commitTyped());
        this.#wrapper.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.#open) {
                // preventDefault too, or the browser also closes a modal dialog around the picker
                e.preventDefault();
                e.stopPropagation();
                this.closePicker();
                this.input.focus();
            }
        });
        // These are ours. The element sends its own input and change events.
        for (const name of ['input', 'change']) {
            this.#wrapper.addEventListener(name, (e) => e.stopPropagation());
        }
        this.#wrapper.addEventListener("focusout", (e) => {
            const next = e.relatedTarget;
            if (this.#open && next && !this.contains(next) && !this.root.contains(next)) {
                this.closePicker();
            }
        });
        // A label click arrives at the host
        this.addEventListener("click", (e) => {
            if (e.target === this) { this.focus(); }
        });
        // When validation fails the browser focuses the host, so the host sends the focus on
        this.addEventListener("focus", (e) => {
            if (e.target === this) { this.focus(); }
        });
    }
    #readTyped(text) {
        const custom = this.#config.parseText;
        const read = (piece) => {
            const fromCustom = custom?.(piece);
            if (fromCustom) { return model.parseValue(fromCustom, this.mode, {timeZone: this.timeZone}); }
            return model.parseText(piece, this.mode, {locale: this.locale, reference: this.#now(), timeZone: this.timeZone});
        };
        if (this.selection === 'range') {
            const strict = model.parseSelection(text, this.mode, 'range', {timeZone: this.timeZone});
            if (strict) { return strict; }
            const pieces = text.split(/\s+(?:[–—-]|to)\s+/i).map(piece => piece.trim()).filter(Boolean);
            if (pieces.length !== 2) { return null; }
            const values = pieces.map(read);
            if (values.includes(null)) { return null; }
            return model.compare(values[0], values[1], this.mode) > 0 ? values.reverse() : values;
        }
        if (this.selection === 'multiple') {
            const values = text.split(';').map(piece => piece.trim()).filter(Boolean).map(read);
            return values.includes(null) ? null : values;
        }
        const value = read(text);
        return value ? [value] : null;
    }
    #commitTyped() {
        const text = this.input.value.trim();
        if (this.input.value === this.#displayText()) { return; }
        if (text === '') {
            this.clearDate();
            return;
        }
        const values = this.#readTyped(text);
        const rules = this.#rules;
        let reason = values === null ? 'unreadable' : null;
        for (const value of values ?? []) {
            reason = reason ?? model.valueProblem(value, rules);
        }
        if (!reason && this.selection === 'range') {
            reason = model.rangeProblem(values[0], values[1], rules);
        }
        if (reason) {
            // Put back what it was, because the selection has not changed
            this.#syncInput();
            this.#sendEvent('date-invalid', {text, reason});
            return;
        }
        this.#commit(values);
        if (this.#selected.length && this.#hasCalendar) { this.#showViewOf(this.#selected[0]); }
        this.#refresh();
    }

    // Open and close

    openPicker() {
        if (this.#isDisabled || this.#isReadOnly || this.#isInline || this.#open) { return; }
        this.#open = true;
        this.#calendarView = this.#startingCalendarView();
        this.#showViewOf(this.#selected[0] ?? this.#reference());
        this.#focusDay = null;
        this.#draw();
        this.picker.style.display = "flex";
        this.input.setAttribute("aria-expanded", "true");
        if (this.picker.showPopover) {
            this.picker.setAttribute('popover', 'manual');
            if (!this.#popoverIsOpen()) { this.picker.showPopover(); }
        }
        this.#position();
        window.addEventListener('resize', this.#onViewportChange);
        window.addEventListener('scroll', this.#onViewportChange, true);
        this.#sendEvent('date-picker-open', {});
    }
    closePicker() {
        const wasOpen = this.#open;
        this.#open = false;
        this.#anchor = null;
        if (!this.#isInline) {
            if (this.#popoverIsOpen()) { this.picker.hidePopover(); }
            this.picker.style.display = "none";
        }
        this.input.setAttribute("aria-expanded", "false");
        window.removeEventListener('resize', this.#onViewportChange);
        window.removeEventListener('scroll', this.#onViewportChange, true);
        this.#syncInput();
        if (wasOpen) { this.#sendEvent('date-picker-close', {}); }
    }
    // Below the input, or above it if it fits only there, and always in the viewport
    #position() {
        if (!this.#open || this.#isInline) { return; }
        const anchor = this.#inputRow.getBoundingClientRect();
        const size = this.picker.getBoundingClientRect();
        const gap = 4;
        const margin = 8;
        const fitsBelow = anchor.bottom + gap + size.height <= window.innerHeight - margin;
        const fitsAbove = anchor.top - gap - size.height >= margin;
        let top = fitsBelow || !fitsAbove ? anchor.bottom + gap : anchor.top - gap - size.height;
        top = Math.max(margin, Math.min(top, window.innerHeight - size.height - margin));
        const rightToLeft = getComputedStyle(this).direction === 'rtl';
        let left = rightToLeft ? anchor.right - size.width : anchor.left;
        left = Math.max(margin, Math.min(left, window.innerWidth - size.width - margin));
        this.picker.style.top = `${top}px`;
        this.picker.style.left = `${left}px`;
    }
    #focusIntoPicker() {
        if (this.#hasCalendar) {
            this.picker.querySelector('.calendars [tabindex="0"]')?.focus();
        } else {
            this.picker.querySelector('select, .slot')?.focus();
        }
    }

    // Selection

    #startingCalendarView() {
        if (this.mode === 'month') { return 'months'; }
        if (this.mode === 'year') { return 'years'; }
        return 'days';
    }
    // What a day, a month, a year, or a time slot means in this mode
    #completeValue(parts, index) {
        if (this.mode !== 'datetime') { return model.truncate(parts, this.mode); }
        if (parts.hour !== undefined) { return model.truncate(parts, 'datetime'); }
        const existing = this.#selected[index] ?? (index === 1 ? this.#anchor : null);
        return this.#clampTime({...parts, ...(existing ? model.truncate(existing, 'time') : this.#defaultTime())});
    }
    #defaultTime() {
        const text = this.#option('defaultTime');
        return (text && model.parseValue(text, 'time')) || {hour: 0, minute: 0, second: 0};
    }
    // The nearest allowed time at or after this time, or else the time as it is
    #clampTime(value) {
        const rules = this.#rules;
        const day = this.mode === 'datetime' ? value : null;
        if (!model.timeIsDisabled(model.truncate(value, 'time'), day, rules)) { return value; }
        for (const candidate of this.#timeOptions(rules)) {
            if (model.compare(candidate, model.truncate(value, 'time'), 'time') >= 0 && !model.timeIsDisabled(candidate, day, rules)) {
                return {...value, ...candidate};
            }
        }
        return value;
    }
    #timeOptions(rules) {
        const options = [];
        for (let hour = 0; hour < 24; hour += rules.hourStep) {
            for (let minute = 0; minute < 60; minute += rules.minuteStep) {
                if (this.#includeSeconds) {
                    for (let second = 0; second < 60; second += rules.secondStep) {
                        options.push({hour, minute, second});
                    }
                } else {
                    options.push({hour, minute, second: 0});
                }
            }
        }
        return options;
    }
    #pick(parts) {
        if (this.#isDisabled || this.#isReadOnly) { return; }
        const rules = this.#rules;
        if (this.selection === 'range') {
            this.#pickRange(parts, rules);
            return;
        }
        if (this.selection === 'multiple') {
            const value = this.#completeValue(parts, this.#selected.length);
            const others = this.#selected.filter(item => model.compare(item, value, this.mode === 'datetime' ? 'date' : this.mode) !== 0);
            const toggledOff = others.length !== this.#selected.length;
            if (!toggledOff && this.#reject(value, rules)) { return; }
            const next = toggledOff ? others : [...others, value];
            next.sort((a, b) => model.compare(a, b, this.mode));
            this.#commit(next);
            this.#draw();
            return;
        }
        const value = this.#completeValue(parts, 0);
        if (this.#reject(value, rules)) { return; }
        this.#commit([value]);
        if (this.#closesAfterPick()) {
            this.closePicker();
            if (!this.#isInline) { this.input.focus(); }
        }
        this.#draw();
    }
    #pickRange(parts, rules) {
        if (!this.#anchor) {
            const start = this.#completeValue(parts, 0);
            if (this.#reject(start, rules)) { return; }
            // The old range stays the value until this one is complete
            this.#anchor = start;
            this.#syncInput();
            this.#draw();
            this.#sendEvent('date-range-start', {value: model.formatValue(start, this.mode, this.#includeSeconds), date: this.#instantOf(start)});
            return;
        }
        const end = this.#completeValue(parts, 1);
        if (this.#reject(end, rules)) { return; }
        const ordered = model.compare(this.#anchor, end, this.mode) <= 0 ? [this.#anchor, end] : [end, this.#anchor];
        const problem = model.rangeProblem(ordered[0], ordered[1], rules);
        if (problem) {
            this.#sendEvent('date-invalid', {text: this.#displayText(), reason: problem});
            return;
        }
        this.#anchor = null;
        this.#commit(ordered);
        if (this.#closesAfterPick()) {
            this.closePicker();
            if (!this.#isInline) { this.input.focus(); }
        }
        this.#draw();
    }
    #closesAfterPick() {
        if (!this.#open) { return false; }
        if (this.mode === 'datetime') { return false; }
        return this.mode !== 'time' || this.#usesTimeList();
    }
    #reject(value, rules) {
        const reason = model.valueProblem(value, rules);
        if (!reason) { return false; }
        this.#sendEvent('date-invalid', {text: model.formatValue(value, this.mode, this.#includeSeconds), reason});
        return true;
    }
    #commit(values) {
        const before = this.value;
        this.#selected = values;
        this.#anchor = null;
        this.#resolved = true;
        this.#rawValue = null;
        this.#syncForm();
        this.#syncInput();
        if (this.value === before) { return; }
        this.#sendValueEvents();
    }
    #sendValueEvents() {
        this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
        this.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
        this.#sendEvent('date-changed', this.#valueDetail());
    }
    #valueDetail() {
        const dates = this.dates;
        const isRange = this.selection === 'range';
        return {
            value: this.value,
            date: dates[0] ?? null,
            dates,
            start: isRange ? dates[0] ?? null : null,
            end: isRange ? dates[1] ?? null : null,
            parts: this.#selected.map(item => ({...item})),
            timeZone: this.timeZone ?? null,
        };
    }
    #sendEvent(name, detail) {
        // composed, so that it leaves a shadow root. It bubbles to the document, for an EventBroker.
        this.dispatchEvent(new CustomEvent(name, {
            bubbles: true, composed: true,
            detail: {...detail, instanceId: this.instanceId, name: this.name, mode: this.mode, selection: this.selection},
        }));
    }
    // Takes a Date, like the value that it gives
    selectDate(picked) {
        const parts = model.fromInstant(picked, this.timeZone);
        this.#pick(this.mode === 'datetime' ? parts : model.truncate(parts, this.mode));
    }
    clearDate() {
        const hadValue = this.#selected.length > 0;
        this.#selected = [];
        this.#anchor = null;
        this.#resolved = true;
        this.#rawValue = null;
        this.#syncForm();
        this.#syncInput();
        this.#draw();
        if (hadValue) { this.#sendValueEvents(); }
    }

    // The view

    #showViewOf(parts) {
        if (parts.year === undefined) { return; }
        const shown = Number(this.#option('months')) || 1;
        const index = (year, month) => year * 12 + month;
        const first = index(this.#view.year, this.#view.month);
        const wanted = index(parts.year, parts.month ?? 1);
        if (this.#viewIsSet && wanted >= first && wanted < first + shown) { return; }
        this.#setView(parts.year, parts.month ?? 1);
    }
    // The first view of an element sends no event, because the data owner chose where it starts
    #setView(year, month) {
        const first = !this.#viewIsSet;
        this.#viewIsSet = true;
        if (this.#view.year === year && this.#view.month === month) { return; }
        this.#view = {year, month};
        if (!first) {
            this.#sendEvent('date-view-changed', this.#viewDetail());
        }
    }
    #viewDetail() {
        const shown = Number(this.#option('months')) || 1;
        const start = {...this.#view, day: 1};
        const lastMonth = model.addMonths(start, shown - 1);
        const end = {...lastMonth, day: model.daysInMonth(lastMonth.year, lastMonth.month)};
        const first = this.#weekStart();
        const gridStart = model.addDays(start, -((model.weekday(start) - first + 7) % 7));
        const gridEnd = model.addDays(end, (6 - ((model.weekday(end) - first + 7) % 7)));
        return {
            year: this.#view.year, month: this.#view.month,
            firstDate: model.formatDate(start), lastDate: model.formatDate(end),
            firstVisibleDate: model.formatDate(gridStart), lastVisibleDate: model.formatDate(gridEnd),
        };
    }
    changeMonth(offset) {
        const next = model.addMonths({...this.#view, day: 1}, offset);
        this.#setView(next.year, next.month);
        this.#focusDay = null;
        this.#draw();
        this.#announce(model.formatDisplay(next, 'month', {locale: this.locale, format: 'long'}));
    }
    #announce(text) {
        this.#live.textContent = text;
    }
    #weekStart() {
        const option = this.#option('firstDayOfWeek');
        const value = option === undefined || option === null || option === '' ? NaN : Number(option);
        return Number.isInteger(value) && value >= 0 && value <= 6 ? value : model.firstDayOfWeek(this.locale);
    }

    // Drawing

    initPicker() {
        this.picker.className = "picker";
        this.picker.setAttribute("role", "dialog");
        this.picker.setAttribute("part", "picker");
        this.picker.setAttribute("aria-label", this.#label('dialog'));
        this.#live.className = "live";
        this.#live.setAttribute("aria-live", "polite");
        if (!this.#open && !this.#isInline) { this.picker.style.display = "none"; }
        this.#calendarView = this.#startingCalendarView();
        this.#showViewOf(this.#selected[0] ?? this.#reference());
        this.#draw();
    }
    #activeElement() {
        return (this.root.activeElement !== undefined ? this.root : this.getRootNode()).activeElement;
    }
    #draw() {
        const active = this.#activeElement();
        const focusKey = active && this.picker.contains(active) ? active.dataset.key : null;
        const rules = this.#rules;
        const sections = [];
        if (this.#hasCalendar) { sections.push(this.#drawCalendars(rules)); }
        if (this.#hasTime) { sections.push(this.#drawTime(rules)); }
        const zones = this.#drawTimeZone();
        if (zones) { sections.push(zones); }
        const presets = this.#drawPresets(rules);
        if (presets) { sections.push(presets); }
        sections.push(this.#drawFooter(rules), this.#live);
        this.picker.replaceChildren(...sections);
        if (this.#moveFocusToGrid) {
            this.#moveFocusToGrid = false;
            this.picker.querySelector('.calendars [tabindex="0"]')?.focus();
        } else if (focusKey) {
            (this.picker.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)
                ?? this.picker.querySelector('.calendars [tabindex="0"]'))?.focus();
        }
    }
    #button(className, text, key, onClick, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = text;
        button.dataset.key = key;
        if (label) { button.setAttribute('aria-label', label); }
        button.addEventListener('click', onClick);
        return button;
    }
    #drawCalendars(rules) {
        const container = document.createElement('div');
        container.className = 'calendars';
        container.addEventListener('keydown', (e) => this.#onGridKey(e, rules));
        if (this.#anchor) {
            container.addEventListener('mouseover', (e) => {
                const date = e.target.closest?.('[data-date]')?.dataset.date;
                if (date) { this.#previewRange(date); }
            });
        }
        if (this.#calendarView === 'months') {
            container.appendChild(this.#drawPeriods(rules, 'months'));
        } else if (this.#calendarView === 'years') {
            container.appendChild(this.#drawPeriods(rules, 'years'));
        } else {
            const shown = Math.max(1, Number(this.#option('months')) || 1);
            for (let offset = 0; offset < shown; offset++) {
                const month = model.addMonths({...this.#view, day: 1}, offset);
                container.appendChild(this.#drawMonth(month, offset === 0, offset === shown - 1, rules));
            }
        }
        return container;
    }
    #previewRange(iso) {
        const end = model.parseValue(iso, this.#hasCalendar && this.mode !== 'datetime' ? this.mode : 'date');
        if (!end || !this.#anchor) { return; }
        const kind = this.mode === 'datetime' ? 'date' : this.mode;
        const [low, high] = model.compare(this.#anchor, end, kind) <= 0 ? [this.#anchor, end] : [end, this.#anchor];
        for (const cell of this.picker.querySelectorAll('[data-date]')) {
            const parts = model.parseValue(cell.dataset.date, kind);
            cell.classList.toggle('in-range-preview', Boolean(parts) && model.compare(parts, low, kind) >= 0 && model.compare(parts, high, kind) <= 0);
        }
    }
    #navButton(className, text, label, offset, disabled) {
        const button = this.#button(`nav ${className}`, text, className, () => this.changeMonth(offset), label);
        button.disabled = disabled;
        return button;
    }
    #monthOutOfBounds(month, rules, direction) {
        // Whether the month next to this one has anything to select
        const edge = direction < 0 ? rules.min : rules.max;
        if (edge?.year === undefined) { return false; }
        const index = month.year * 12 + month.month;
        const edgeIndex = edge.year * 12 + (edge.month ?? 1);
        return direction < 0 ? index <= edgeIndex : index >= edgeIndex;
    }
    #drawMonth(month, isFirst, isLast, rules) {
        const block = document.createElement('div');
        block.className = 'calendar';
        block.setAttribute('part', 'calendar');
        const header = document.createElement('div');
        header.className = 'month-header';
        const shown = Number(this.#option('months')) || 1;
        const lastShown = model.addMonths({...this.#view, day: 1}, shown - 1);
        const noPrevious = this.#monthOutOfBounds(this.#view, rules, -1);
        const noNext = this.#monthOutOfBounds(lastShown, rules, 1);
        if (isFirst) {
            header.append(
                this.#navButton('prev-year', '«', this.#label('previousYear'), -12, noPrevious),
                this.#navButton('prev-month', '‹', this.#label('previousMonth'), -1, noPrevious),
            );
        }
        const name = this.#button('month-name',
            model.formatDisplay(month, 'month', {locale: this.locale, format: 'long'}), `month-name-${month.year}-${month.month}`,
            () => this.#switchCalendarView('months'), this.#label('chooseMonth'));
        name.setAttribute('aria-live', 'polite');
        header.appendChild(name);
        if (isLast) {
            header.append(
                this.#navButton('next-month', '›', this.#label('nextMonth'), 1, noNext),
                this.#navButton('next-year', '»', this.#label('nextYear'), 12, noNext),
            );
        }
        block.appendChild(header);
        block.appendChild(this.#drawGrid(month, rules, shown));
        return block;
    }
    #switchCalendarView(view) {
        const active = this.#calendarView;
        this.#calendarView = active === view && this.mode !== 'month' && this.mode !== 'year' ? 'days' : view;
        this.#focusDay = null;
        this.#moveFocusToGrid = true;
        this.#draw();
    }
    #defaultFocusDay(month) {
        const inMonth = (parts) => parts?.year === month.year && parts?.month === month.month;
        const candidate = this.#anchor ?? this.#selected[0];
        if (inMonth(candidate)) { return candidate; }
        const today = this.#now();
        return inMonth(today) ? today : month;
    }
    #drawGrid(month, rules, shown) {
        const grid = document.createElement('div');
        grid.setAttribute('role', 'grid');
        grid.setAttribute('aria-label', model.formatDisplay(month, 'month', {locale: this.locale, format: 'long'}));
        const firstWeekday = this.#weekStart();
        const showWeekNumbers = this.#flag('showWeekNumbers') || this.mode === 'week';

        const weekdays = document.createElement('div');
        weekdays.className = 'weekdays';
        weekdays.setAttribute('role', 'row');
        if (showWeekNumbers) {
            const corner = document.createElement('span');
            corner.className = 'week-number';
            corner.setAttribute('role', 'columnheader');
            corner.textContent = this.#label('week');
            weekdays.appendChild(corner);
        }
        const shortNames = model.weekdayNames(this.locale, 'short');
        const longNames = model.weekdayNames(this.locale, 'long');
        for (let index = 0; index < 7; index++) {
            const position = (firstWeekday + index) % 7;
            const cell = document.createElement('span');
            cell.className = 'weekday';
            cell.setAttribute('role', 'columnheader');
            cell.setAttribute('aria-label', longNames[position]);
            cell.textContent = shortNames[position];
            weekdays.appendChild(cell);
        }
        grid.appendChild(weekdays);

        const first = {year: month.year, month: month.month, day: 1};
        const leading = (model.weekday(first) - firstWeekday + 7) % 7;
        const days = model.daysInMonth(month.year, month.month);
        const weekCount = this.#flag('fixedWeeks') ? 6 : Math.ceil((leading + days) / 7);
        const focusTarget = this.#focusDay && this.#focusDay.year === month.year && this.#focusDay.month === month.month
            ? this.#focusDay : (month.month === this.#view.month && month.year === this.#view.year && !this.#focusDay ? this.#defaultFocusDay(first) : null);
        const today = this.#now();
        for (let week = 0; week < weekCount; week++) {
            const row = document.createElement('div');
            row.className = 'week';
            row.setAttribute('role', 'row');
            if (showWeekNumbers) {
                const number = document.createElement('span');
                number.className = 'week-number';
                number.setAttribute('role', 'rowheader');
                number.textContent = model.formatNumber(model.isoWeek(model.addDays(first, week * 7 - leading + 3)).week, this.locale);
                row.appendChild(number);
            }
            for (let index = 0; index < 7; index++) {
                const day = model.addDays(first, week * 7 + index - leading);
                row.appendChild(this.#drawDay(day, month, rules, shown, focusTarget, today));
            }
            grid.appendChild(row);
        }
        return grid;
    }
    #drawDay(day, month, rules, shown, focusTarget, today) {
        const outsideMonth = day.month !== month.month;
        // With two months on screen a day would otherwise show twice
        if (outsideMonth && shown > 1) {
            const blank = document.createElement('span');
            blank.className = 'outside';
            blank.setAttribute('role', 'gridcell');
            return blank;
        }
        const iso = model.formatDate(day);
        const info = this.#config.getDayInfo?.(iso, day) ?? null;
        const disabled = model.dayIsDisabled(day, rules);
        const button = this.#button('day', model.formatNumber(day.day, this.locale), `day-${iso}`, () => {
            if (!disabled) { this.#onDayClick(day); }
        });
        button.setAttribute('role', 'gridcell');
        button.setAttribute('part', 'day');
        button.dataset.day = day.day;
        button.dataset.date = iso;
        button.tabIndex = focusTarget && model.compare(day, focusTarget, 'date') === 0 ? 0 : -1;
        const label = day.year !== undefined ? model.formatDisplay(day, 'date', {locale: this.locale, format: 'full'}) : iso;
        button.setAttribute('aria-label', info?.label ? `${label}, ${info.label}` : label);
        if (outsideMonth) { button.classList.add('other-month'); }
        if (model.compare(day, today, 'date') === 0) {
            button.classList.add('today');
            button.setAttribute('aria-current', 'date');
        }
        if (disabled) {
            button.classList.add('unavailable');
            button.setAttribute('aria-disabled', 'true');
        }
        this.#markSelection(button, day);
        if (info?.className) { button.classList.add(...String(info.className).split(/\s+/).filter(Boolean)); }
        if (info?.title) { button.title = info.title; }
        if (info?.badge !== undefined) {
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = info.badge;
            button.appendChild(badge);
        }
        return button;
    }
    #onDayClick(day) {
        this.#focusDay = day;
        this.#moveFocusToGrid = this.#open || this.#isInline;
        this.#pick(this.mode === 'week' ? model.truncate(day, 'week') : day);
        if (this.selection !== 'single' && this.#hasCalendar && day.month !== undefined
            && (day.month !== this.#view.month || day.year !== this.#view.year)) {
            this.#draw();
        } else if (day.month !== this.#view.month || day.year !== this.#view.year) {
            this.#setView(day.year, day.month);
            this.#focusDay = day;
            this.#draw();
        }
        this.#moveFocusToGrid = false;
    }
    // The same classes for a day, a month, and a year
    #markSelection(cell, parts) {
        const kind = this.mode === 'datetime' ? 'date' : this.mode;
        const compared = kind === 'week' ? model.truncate(parts, 'week') : parts;
        if (this.#anchor) {
            if (model.compare(compared, this.#anchor, kind) === 0) {
                cell.classList.add('selected', 'range-start');
                cell.setAttribute('aria-selected', 'true');
            }
            return;
        }
        const values = this.#selected;
        if (this.selection === 'range' && values.length === 2) {
            const afterStart = model.compare(compared, values[0], kind);
            const beforeEnd = model.compare(compared, values[1], kind);
            if (afterStart === 0) { cell.classList.add('selected', 'range-start'); }
            if (beforeEnd === 0) { cell.classList.add('selected', 'range-end'); }
            if (afterStart > 0 && beforeEnd < 0) { cell.classList.add('in-range'); }
        } else if (values.some(value => model.compare(compared, value, kind) === 0)) {
            cell.classList.add('selected');
        }
        if (cell.classList.contains('selected')) { cell.setAttribute('aria-selected', 'true'); }
    }
    #drawPeriods(rules, view) {
        const block = document.createElement('div');
        block.className = 'calendar';
        const header = document.createElement('div');
        header.className = 'month-header';
        const isMonths = view === 'months';
        const windowStart = Math.floor(this.#view.year / 12) * 12;
        const step = isMonths ? 12 : 144;
        const title = isMonths ? model.formatDisplay({year: this.#view.year}, 'year', {locale: this.locale})
            : `${model.formatDisplay({year: windowStart}, 'year', {locale: this.locale})}${RANGE_DISPLAY_SEPARATOR}${model.formatDisplay({year: windowStart + 11}, 'year', {locale: this.locale})}`;
        const previousOut = rules.min?.year !== undefined && (isMonths ? this.#view.year : windowStart) <= rules.min.year;
        const nextOut = rules.max?.year !== undefined && (isMonths ? this.#view.year : windowStart + 11) >= rules.max.year;
        const name = this.#button('month-name', title, `period-name-${view}`,
            () => { if (isMonths) { this.#switchCalendarView('years'); } else if (this.mode !== 'year') { this.#switchCalendarView('months'); } },
            this.#label(isMonths ? 'chooseYear' : 'chooseMonth'));
        header.append(
            this.#navButton('prev-month', '‹', this.#label(isMonths ? 'previousYear' : 'previousYears'), -step, previousOut),
            name,
            this.#navButton('next-month', '›', this.#label(isMonths ? 'nextYear' : 'nextYears'), step, nextOut),
        );
        block.appendChild(header);
        const grid = document.createElement('div');
        grid.className = 'cells';
        grid.setAttribute('role', 'grid');
        const focusTarget = this.#focusDay ?? this.#anchor ?? this.#selected[0] ?? {...this.#view};
        const names = model.monthNames(this.locale, 'short');
        for (let index = 0; index < 12; index++) {
            const parts = isMonths ? {year: this.#view.year, month: index + 1} : {year: windowStart + index};
            const kind = isMonths ? 'month' : 'year';
            const text = isMonths ? names[index] : model.formatDisplay(parts, 'year', {locale: this.locale});
            const iso = model.formatValue(parts, kind);
            const disabled = model.periodIsDisabled(parts, kind, rules);
            const cell = this.#button('cell', text, `cell-${iso}`, () => {
                if (!disabled) { this.#onPeriodClick(parts, isMonths); }
            });
            cell.setAttribute('role', 'gridcell');
            cell.dataset.date = iso;
            if (disabled) {
                cell.classList.add('unavailable');
                cell.setAttribute('aria-disabled', 'true');
            }
            const onTarget = focusTarget.year === parts.year && (!isMonths || (focusTarget.month ?? 1) === parts.month);
            const inWindowOnTarget = !isMonths && focusTarget.year !== undefined && (focusTarget.year < windowStart || focusTarget.year > windowStart + 11) && index === 0;
            cell.tabIndex = onTarget || inWindowOnTarget ? 0 : -1;
            if (this.mode === kind) {
                this.#markSelection(cell, parts);
            }
            grid.appendChild(cell);
        }
        block.appendChild(grid);
        return block;
    }
    #onPeriodClick(parts, isMonths) {
        if (isMonths && this.mode === 'month') {
            this.#focusDay = {...parts, day: 1};
            this.#pick(parts);
            return;
        }
        if (!isMonths && this.mode === 'year') {
            this.#focusDay = {...parts, month: 1, day: 1};
            this.#pick(parts);
            return;
        }
        if (isMonths) {
            this.#setView(parts.year, parts.month);
            this.#calendarView = 'days';
        } else {
            this.#setView(parts.year, this.#view.month);
            this.#calendarView = 'months';
        }
        this.#focusDay = null;
        this.#moveFocusToGrid = true;
        this.#draw();
    }

    // The keyboard, from the WAI-ARIA date picker pattern

    #onGridKey(e, rules) {
        const months = this.#calendarView === 'months';
        const years = this.#calendarView === 'years';
        const days = !months && !years;
        const target = e.target;
        if (!target.matches?.('.day, .cell')) { return; }
        const rtl = getComputedStyle(this).direction === 'rtl' ? -1 : 1;
        const current = days
            ? model.parseValue(target.dataset.date, 'date')
            : (months ? {...model.parseValue(target.dataset.date, 'month'), day: 1} : {year: Number(target.dataset.date), month: 1, day: 1});
        let next = null;
        switch (e.key) {
            case 'ArrowLeft': next = days ? model.addDays(current, -rtl) : model.addMonths(current, -rtl * (years ? 12 : 1)); break;
            case 'ArrowRight': next = days ? model.addDays(current, rtl) : model.addMonths(current, rtl * (years ? 12 : 1)); break;
            case 'ArrowUp': next = days ? model.addDays(current, -7) : model.addMonths(current, years ? -36 : -3); break;
            case 'ArrowDown': next = days ? model.addDays(current, 7) : model.addMonths(current, years ? 36 : 3); break;
            case 'Home': if (days) { next = model.addDays(current, -((model.weekday(current) - this.#weekStart() + 7) % 7)); } break;
            case 'End': if (days) { next = model.addDays(current, 6 - ((model.weekday(current) - this.#weekStart() + 7) % 7)); } break;
            case 'PageUp': next = model.addMonths(current, (e.shiftKey ? -12 : -1) * (days ? 1 : 12)); break;
            case 'PageDown': next = model.addMonths(current, (e.shiftKey ? 12 : 1) * (days ? 1 : 12)); break;
            default: return;
        }
        if (!next) { return; }
        e.preventDefault();
        this.#focusDay = next;
        if (days) {
            const shown = Number(this.#option('months')) || 1;
            const index = next.year * 12 + next.month;
            const first = this.#view.year * 12 + this.#view.month;
            if (index < first) {
                this.#setView(next.year, next.month);
            } else if (index >= first + shown) {
                const start = model.addMonths({...next, day: 1}, -(shown - 1));
                this.#setView(start.year, start.month);
            }
        } else if (months && next.year !== this.#view.year) {
            this.#setView(next.year, this.#view.month);
        } else if (years) {
            this.#setView(next.year, this.#view.month);
        }
        this.#moveFocusToGrid = true;
        this.#draw();
        if (this.#anchor) {
            const iso = days ? model.formatDate(next) : model.formatValue(next, months ? 'month' : 'year');
            this.#previewRange(iso);
        }
    }

    // Time

    #usesTimeList() {
        return this.#option('timeView') === 'list' || this.#timeSlots() !== null;
    }
    #timeSlots() {
        const slots = this.#option('timeSlots');
        if (!slots) { return null; }
        const list = Array.isArray(slots) ? slots : String(slots).split(',');
        const parsed = list.map((slot) => {
            const value = typeof slot === 'string' ? slot.trim() : slot.value;
            const time = model.parseValue(value, 'time');
            return time ? {time, label: slot.label, disabled: Boolean(slot.disabled)} : null;
        }).filter(Boolean);
        return parsed.length ? parsed : null;
    }
    #drawTime(rules) {
        const section = document.createElement('div');
        section.className = 'time';
        section.setAttribute('part', 'time');
        const rowCount = this.selection === 'range' ? 2 : 1;
        if (this.#usesTimeList() && !(this.mode === 'datetime' && this.selection === 'range')) {
            section.appendChild(this.#drawSlots(rules));
            return section;
        }
        const rows = document.createElement('div');
        rows.className = 'time-rows';
        for (let index = 0; index < rowCount; index++) {
            rows.appendChild(this.#drawTimeRow(index, rowCount, rules));
        }
        section.appendChild(rows);
        return section;
    }
    #valueForRow(index) {
        if (this.#anchor) { return index === 0 ? this.#anchor : null; }
        if (this.selection === 'multiple') { return this.#selected.at(-1) ?? null; }
        return this.#selected[index] ?? null;
    }
    #drawTimeRow(index, rowCount, rules) {
        const row = document.createElement('div');
        row.className = 'time-row';
        row.dataset.row = index;
        const value = this.#valueForRow(index);
        const day = this.mode === 'datetime' ? (value ?? this.#reference()) : null;
        if (rowCount > 1) {
            const name = document.createElement('span');
            name.textContent = this.#label(index === 0 ? 'start' : 'end');
            row.appendChild(name);
        }
        // In a range, the end cannot change until there is a start
        const locked = this.selection === 'range' && index === 1 && this.#selected.length < 2 && this.mode === 'datetime';
        const twentyFour = this.#twentyFourHours;
        const hour = value?.hour;
        const isPm = (hour ?? 0) >= 12;
        // Stops at the first allowed time, because seconds make this list long
        const hourAllowed = (h) => {
            for (let m = 0; m < 60; m += rules.minuteStep) {
                for (let s = 0; s < (this.#includeSeconds ? 60 : 1); s += rules.secondStep) {
                    if (!model.timeIsDisabled({hour: h, minute: m, second: s}, day, rules)) { return true; }
                }
            }
            return false;
        };
        const hourOptions = [];
        for (let h = 0; h < 24; h += rules.hourStep) {
            if (!twentyFour && (h >= 12) !== isPm) { continue; }
            hourOptions.push({value: h, text: model.formatNumber(twentyFour ? h : (h % 12 || 12), this.locale, twentyFour ? 2 : 1), disabled: !hourAllowed(h)});
        }
        if (!twentyFour) {
            // A clock face starts at twelve
            hourOptions.sort((a, b) => (a.value % 12) - (b.value % 12));
        }
        row.appendChild(this.#drawSelect(`hour-${index}`, this.#label('hour'), hourOptions, value ? hour : null, locked,
            (selected) => this.#setTime(index, {hour: selected})));
        const minuteOptions = [];
        for (let m = 0; m < 60; m += rules.minuteStep) {
            const candidates = this.#includeSeconds
                ? Array.from({length: Math.ceil(60 / rules.secondStep)}, (_, i) => i * rules.secondStep) : [0];
            const allowed = candidates.some(s => !model.timeIsDisabled({hour: hour ?? 0, minute: m, second: s}, day, rules));
            minuteOptions.push({value: m, text: model.formatNumber(m, this.locale, 2), disabled: value ? !allowed : false});
        }
        row.appendChild(this.#drawSelect(`minute-${index}`, this.#label('minute'), minuteOptions, value ? value.minute : null, locked,
            (selected) => this.#setTime(index, {minute: selected})));
        if (this.#includeSeconds) {
            const secondOptions = [];
            for (let s = 0; s < 60; s += rules.secondStep) {
                const disabled = value ? model.timeIsDisabled({hour: value.hour, minute: value.minute, second: s}, day, rules) : false;
                secondOptions.push({value: s, text: model.formatNumber(s, this.locale, 2), disabled});
            }
            row.appendChild(this.#drawSelect(`second-${index}`, this.#label('second'), secondOptions, value ? value.second : null, locked,
                (selected) => this.#setTime(index, {second: selected})));
        }
        if (!twentyFour) {
            const names = model.meridiemNames(this.locale);
            const periodAllowed = (pm) => {
                for (let h = pm ? 12 : 0; h < (pm ? 24 : 12); h += rules.hourStep) {
                    if (hourAllowed(h)) { return true; }
                }
                return false;
            };
            const periods = [
                {value: 'am', text: names.am, disabled: !periodAllowed(false)},
                {value: 'pm', text: names.pm, disabled: !periodAllowed(true)},
            ];
            row.appendChild(this.#drawSelect(`period-${index}`, this.#label('period'), periods, value ? (isPm ? 'pm' : 'am') : null, locked,
                (selected) => {
                    const current = value?.hour ?? 0;
                    this.#setTime(index, {hour: selected === 'pm' ? (current % 12) + 12 : current % 12});
                }));
        }
        return row;
    }
    #drawSelect(key, label, options, selected, locked, onChange) {
        const select = document.createElement('select');
        select.dataset.key = key;
        select.className = key.split('-')[0];
        select.setAttribute('aria-label', label);
        select.disabled = locked || this.#isDisabled || this.#isReadOnly;
        const add = (value, text, disabled = false) => {
            const option = document.createElement('option');
            option.value = String(value);
            option.textContent = text;
            option.disabled = disabled;
            select.appendChild(option);
            return option;
        };
        if (selected === null) { add('', '--'); }
        for (const option of options) {
            add(option.value, option.text, option.disabled);
        }
        // A value from outside can be off the steps. It must still show.
        if (selected !== null && !options.some(option => String(option.value) === String(selected))) {
            add(selected, typeof selected === 'number' ? model.formatNumber(selected, this.locale, 2) : selected);
        }
        select.value = selected === null ? '' : String(selected);
        select.addEventListener('change', () => {
            const raw = select.value;
            onChange(/^\d+$/.test(raw) ? Number(raw) : raw);
        });
        return select;
    }
    #setTime(index, patch) {
        if (this.#isDisabled || this.#isReadOnly) { return; }
        const current = this.#valueForRow(index);
        const base = current ?? (this.mode === 'datetime' ? {...this.#reference(), ...this.#defaultTime()} : this.#defaultTime());
        const updated = this.#clampTime(model.truncate({...base, ...patch}, this.mode));
        if (this.#anchor) {
            this.#anchor = updated;
            this.#syncInput();
            this.#draw();
            return;
        }
        let next;
        if (this.selection === 'range') {
            if (this.#selected.length < 2) {
                // Times with no calendar: the first row starts a range, and the end follows it
                next = index === 0 ? [updated, updated] : [this.#selected[0] ?? updated, updated];
            } else {
                next = [...this.#selected];
                next[index] = updated;
            }
            next.sort((a, b) => model.compare(a, b, this.mode));
        } else if (this.selection === 'multiple' && this.#selected.length) {
            next = [...this.#selected.slice(0, -1), updated];
        } else {
            next = [updated];
        }
        if (next.some(value => model.valueProblem(value, this.#rules))) {
            this.#reject(next.find(value => model.valueProblem(value, this.#rules)), this.#rules);
            this.#draw();
            return;
        }
        this.#commit(next);
        this.#draw();
    }
    #drawSlots(rules) {
        const list = document.createElement('div');
        list.className = 'slots';
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', this.#label('dialog'));
        const slots = this.#timeSlots() ?? this.#generatedSlots(rules);
        const day = this.mode === 'datetime' ? (this.#anchor ?? this.#selected[0] ?? this.#reference()) : null;
        const current = this.#selected.map(item => model.truncate(item, 'time'));
        for (const slot of slots) {
            const iso = model.formatTime(slot.time, this.#includeSeconds);
            const text = slot.label ?? model.formatDisplay(slot.time, 'time', this.#displayOptions);
            const disabled = slot.disabled || model.timeIsDisabled(slot.time, day, rules);
            const button = this.#button('slot', text, `slot-${iso}`, () => {
                if (disabled) { return; }
                if (this.mode === 'datetime') {
                    this.#setSlotOnDay(slot.time, rules);
                } else {
                    this.#pick(slot.time);
                }
            });
            button.setAttribute('role', 'option');
            button.dataset.time = iso;
            const isSelected = current.some(value => model.compare(value, slot.time, 'time') === 0);
            button.setAttribute('aria-selected', String(isSelected));
            if (isSelected) { button.classList.add('selected'); }
            if (disabled) {
                button.classList.add('unavailable');
                button.setAttribute('aria-disabled', 'true');
            }
            list.appendChild(button);
        }
        return list;
    }
    // A list of each minute is not a list that a person can use, so a list with no step uses 15
    #generatedSlots(rules) {
        const minuteStep = rules.minuteStep > 1 ? rules.minuteStep : 15;
        const slots = [];
        for (let hour = 0; hour < 24; hour += rules.hourStep) {
            for (let minute = 0; minute < 60; minute += minuteStep) {
                slots.push({time: {hour, minute, second: 0}});
            }
        }
        return slots;
    }
    #setSlotOnDay(time, rules) {
        const day = this.#selected.at(-1) ?? this.#reference();
        const value = model.truncate({...day, ...time}, 'datetime');
        if (this.#reject(value, rules)) { return; }
        const next = this.selection === 'multiple' ? [...this.#selected.slice(0, -1), value] : [value];
        this.#commit(next);
        if (this.#open && this.selection === 'single') {
            this.closePicker();
            this.input.focus();
        }
        this.#draw();
    }

    // The rest of the panel

    #drawTimeZone() {
        if (!this.#flag('timeZoneSelectable')) { return null; }
        const select = document.createElement('select');
        select.className = 'time-zone-select';
        select.dataset.key = 'time-zone';
        select.setAttribute('aria-label', this.#label('timeZone'));
        const zones = Intl.supportedValuesOf?.('timeZone') ?? [];
        const local = document.createElement('option');
        local.value = '';
        local.textContent = this.#label('localTimeZone');
        select.appendChild(local);
        const current = this.timeZone;
        for (const zone of current && !zones.includes(current) ? [current, ...zones] : zones) {
            const option = document.createElement('option');
            option.value = zone;
            option.textContent = zone;
            select.appendChild(option);
        }
        select.value = current ?? '';
        select.addEventListener('change', () => {
            this.#timeZoneOverride = select.value || null;
            if (this.#timeZoneOverride === null) { this.#timeZoneOverride = undefined; }
            this.#sendEvent('date-time-zone-changed', {timeZone: this.timeZone ?? null});
            if (this.#selected.length) { this.#sendEvent('date-changed', this.#valueDetail()); }
            this.#draw();
        });
        return select;
    }
    #drawPresets(rules) {
        const presets = this.#config.presets;
        if (!Array.isArray(presets) || !presets.length) { return null; }
        const row = document.createElement('div');
        row.className = 'presets';
        presets.forEach((preset, index) => {
            const button = this.#button('preset', preset.label, `preset-${index}`, () => {
                const text = typeof preset.value === 'function' ? preset.value(this.#now()) : preset.value;
                const values = model.parseSelection(text, this.mode, this.selection, {timeZone: this.timeZone});
                if (!values || values.some(value => this.#reject(value, rules))) { return; }
                this.#commit(values);
                if (values[0]?.year !== undefined) { this.#setView(values[0].year, values[0].month ?? 1); }
                if (this.#open) {
                    this.closePicker();
                    this.input.focus();
                }
                this.#draw();
            });
            row.appendChild(button);
        });
        return row;
    }
    #nowLabel() {
        const relative = model.relativeFormat(this.locale, {numeric: 'auto'});
        const text = {
            date: relative.format(0, 'day'), datetime: relative.format(0, 'second'), time: relative.format(0, 'second'),
            month: relative.format(0, 'month'), week: relative.format(0, 'week'), year: relative.format(0, 'year'),
        }[this.mode];
        return text.charAt(0).toLocaleUpperCase(this.locale) + text.slice(1);
    }
    #drawFooter(rules) {
        const footer = document.createElement('div');
        footer.className = 'footer';
        const left = document.createElement('div');
        const right = document.createElement('div');
        const now = model.truncate(this.#now(), this.mode);
        if (this.mode === 'time' || this.mode === 'datetime') {
            now.second = this.#includeSeconds ? now.second : 0;
        }
        const nowButton = this.#button('now', this.#nowLabel(), 'now', () => {
            if (this.#hasCalendar) {
                this.#setView(now.year, now.month ?? this.#view.month);
                this.#focusDay = null;
            }
            if (this.mode === 'time') {
                this.#commit([this.#clampTime(now)]);
                this.#draw();
            } else if (this.mode === 'datetime' && this.selection === 'single') {
                if (!this.#reject(now, rules)) {
                    this.#commit([now]);
                    this.#draw();
                }
            } else {
                this.#pick(now);
            }
        });
        nowButton.disabled = this.#isDisabled || this.#isReadOnly
            || (this.selection === 'single' && model.valueProblem(this.mode === 'time' || this.mode === 'datetime' ? {...now, ...this.#stepFloor(now, rules)} : now, rules) !== null);
        left.appendChild(nowButton);
        if ((this.#selected.length || this.#anchor) && !this.required && this.#flag('clearable', true) && !this.#isDisabled && !this.#isReadOnly) {
            left.appendChild(this.#button('clear', this.#label('clear'), 'clear', () => this.clearDate()));
        }
        footer.appendChild(left);
        if (!this.#isInline && (this.#hasTime || this.selection === 'multiple')) {
            right.appendChild(this.#button('done', this.#label('done'), 'done', () => {
                this.closePicker();
                this.input.focus();
            }));
        }
        footer.appendChild(right);
        return footer;
    }
    #stepFloor(now, rules) {
        return {
            hour: now.hour - (now.hour % rules.hourStep),
            minute: now.minute - (now.minute % rules.minuteStep),
            second: now.second - (now.second % rules.secondStep),
        };
    }
}

// The attribute has already changed when the callback runs, so the old form comes from the old value
function oldKind(changed, oldValue, current, isSelection = false) {
    if (isSelection) {
        return changed === 'selection' ? (SELECTIONS.includes(oldValue) ? oldValue : 'single') : current;
    }
    return changed === 'mode' ? (MODES.includes(oldValue) ? oldValue : 'date') : current;
}

class ShadowDateTimePicker extends DateTimePicker {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
        this.root = this.shadow;
    }
}
export { DateTimePicker, ShadowDateTimePicker }
