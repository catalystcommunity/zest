import { DataComponent } from "@catalystcommunity/base-components";
import * as model from "@catalystcommunity/date-model";
import * as layout from "./layout.js";

// The design and each option are in the README. In short: the application gives the items, and
// the calendar shows them. Each thing that the user does goes out as a bubbling, composed event.
// The calendar does not change its items. After a move, the application saves and sends new items.

const defaultStyles = `
calendar-view, :host {
    display: block;
    min-width: 0;
}
.zest-calendar {
    --_window: var(--zest-calendar-view-window, var(--zest-color-window, Canvas));
    --_window-text: var(--zest-calendar-view-window-text, var(--zest-color-window-text, CanvasText));
    --_face: var(--zest-calendar-view-face, var(--zest-control-face, var(--zest-color-face, ButtonFace)));
    --_face-text: var(--zest-calendar-view-face-text, var(--zest-control-face-text, var(--zest-color-face-text, ButtonText)));
    --_fill: var(--zest-calendar-view-fill, var(--zest-control-fill, linear-gradient(color-mix(in srgb, var(--_face) 88%, white), var(--_face))));
    --_highlight: var(--zest-calendar-view-highlight, var(--zest-color-highlight, Highlight));
    --_highlight-text: var(--zest-calendar-view-highlight-text, var(--zest-color-highlight-text, HighlightText));
    --_secondary-text: var(--zest-calendar-view-secondary-text, var(--zest-color-secondary-text, CanvasText));
    --_border: var(--zest-calendar-view-border, var(--zest-control-border, var(--zest-color-border, ButtonBorder)));
    --_line: var(--zest-calendar-view-line, color-mix(in srgb, var(--_border) 45%, transparent));
    --_item-face: var(--zest-calendar-view-item-face, color-mix(in srgb, var(--_highlight) 14%, var(--_window)));
    --_item-text: var(--zest-calendar-view-item-text, var(--_window-text));
    --_stripe-default: var(--zest-calendar-view-stripe, var(--_highlight));
    --_selection-face: var(--zest-calendar-view-face-selected, color-mix(in srgb, var(--_highlight) 25%, transparent));
    --_hover-face: var(--zest-calendar-view-face-hover, color-mix(in srgb, var(--_highlight) 10%, transparent));
    --_now: var(--zest-calendar-view-now, var(--_highlight));
    --_border-width: var(--zest-border-width, 1px);
    --_focus: var(--zest-calendar-view-focus, var(--zest-color-focus, Highlight));
    --_focus-width: var(--zest-focus-width, 2px);
    --_focus-offset: var(--zest-focus-offset, 2px);
    --_radius: var(--zest-calendar-view-radius, var(--zest-control-radius, 0.375em));
    --_height: var(--zest-calendar-view-height, var(--zest-control-height, 2.5em));
    --_padding-block: var(--zest-control-padding-block, 0.375em);
    --_padding-inline: var(--zest-control-padding-inline, 1em);
    --_gap: var(--zest-gap-related, 0.5em);
    --_item-height: var(--zest-calendar-view-item-height, 1.75em);
    --_slot-height: var(--zest-calendar-view-slot-height, 2.5em);
    --_time-width: var(--zest-calendar-view-time-width, 4.5em);
    --_grid-height: var(--zest-calendar-view-grid-height, 36em);
    --_number-height: 1.75em;
    --_motion: var(--zest-motion-duration, 0ms);
    display: flex;
    flex-direction: column;
    gap: var(--_gap);
    min-width: 0;
    container-type: inline-size;
    overflow-wrap: normal;
    /* Each render makes new elements. Scroll anchoring would move the page under the pointer. */
    overflow-anchor: none;
    background: var(--_window);
    color: var(--_window-text);
    font-family: var(--zest-font-family, inherit);
    line-height: var(--zest-line-height, inherit);
}
.zest-calendar button {
    box-sizing: border-box;
    font: inherit;
    cursor: pointer;
    transition: background-color var(--_motion), border-color var(--_motion);
}
.zest-calendar :focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
    z-index: 3;
}
.zest-calendar .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--_gap);
}
.zest-calendar .toolbar .group {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
}
.zest-calendar .toolbar button, .zest-calendar .status button {
    min-height: var(--_height);
    min-width: var(--_height);
    padding: var(--_padding-block) calc(var(--_padding-inline) / 2);
    background-color: var(--_face);
    background-image: var(--_fill);
    color: var(--_face-text);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
}
.zest-calendar .toolbar button:hover, .zest-calendar .status button:hover {
    background-image: none;
    border-color: var(--_highlight);
}
.zest-calendar .toolbar button[aria-pressed="true"] {
    background: var(--_highlight);
    color: var(--_highlight-text);
    font-weight: bold;
    text-decoration: underline;
}
.zest-calendar .title {
    flex: 1;
    min-width: 8em;
    font-weight: bold;
    font-size: 1.125em;
}
.zest-calendar .status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--_gap);
    padding: var(--_gap);
    border: var(--_border-width) dashed var(--_focus);
    border-radius: var(--_radius);
}
.zest-calendar .status[hidden] {
    display: none;
}
.zest-calendar .status span {
    flex: 1;
    min-width: 0;
}
.zest-calendar .sr, .zest-calendar .live {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}
.zest-calendar [role="grid"] {
    min-width: 0;
    border: var(--_border-width) solid var(--_line);
    border-radius: var(--_radius);
}
.zest-calendar .weekdays, .zest-calendar .week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
}
.zest-calendar .weekday {
    padding: 0.25em;
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875em;
    color: var(--_secondary-text);
}
.zest-calendar .day, .zest-calendar .all-day-cell {
    position: relative;
    box-sizing: border-box;
    min-width: 0;
    min-height: calc(var(--_number-height) + var(--_lanes, 0) * (var(--_item-height) + 2px) + var(--_more-height, 0px) + 0.25em);
    padding-block-start: calc(var(--_number-height) + var(--_lanes, 0) * (var(--_item-height) + 2px));
    border-block-start: var(--_border-width) solid var(--_line);
    border-inline-end: var(--_border-width) solid var(--_line);
}
.zest-calendar .all-day-cell {
    min-height: calc(var(--_lanes, 0) * (var(--_item-height) + 2px) + 0.5em);
    padding-block-start: calc(var(--_lanes, 0) * (var(--_item-height) + 2px));
}
.zest-calendar .week > :last-child, .zest-calendar .row > :last-child {
    border-inline-end: none;
}
.zest-calendar .day-number {
    position: absolute;
    inset-block-start: 0.125em;
    inset-inline-start: 0.25em;
    min-width: 1.5em;
    line-height: 1.5em;
    text-align: center;
    border-radius: 0.75em;
}
.zest-calendar .other-month .day-number {
    color: var(--_secondary-text);
}
.zest-calendar .today .day-number, .zest-calendar .column-head.today .head-day {
    background: var(--_highlight);
    color: var(--_highlight-text);
    font-weight: bold;
    text-decoration: underline;
}
.zest-calendar .day:hover, .zest-calendar .slot:hover, .zest-calendar .all-day-cell:hover {
    background: var(--_hover-face);
}
.zest-calendar [aria-selected="true"], .zest-calendar [aria-selected="true"]:hover {
    background: var(--_selection-face);
    box-shadow: inset 0 0 0 1px var(--_highlight);
}
.zest-calendar .more {
    display: block;
    min-height: 24px;
    min-width: 24px;
    margin: 0 2px 2px;
    padding: 0 0.25em;
    background: none;
    border: var(--_border-width) solid transparent;
    border-radius: var(--_radius);
    color: inherit;
    font-size: 0.875em;
    text-align: start;
    text-decoration: underline;
}
.zest-calendar .more:hover {
    border-color: var(--_highlight);
}
.zest-calendar .item {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    display: flex;
    min-width: 0;
    min-height: 24px;
    overflow: hidden;
    background: var(--_item-face);
    color: var(--_item-text);
    border: var(--_border-width) solid var(--_line);
    border-inline-start: 4px solid var(--_stripe, var(--_stripe-default));
    border-radius: var(--_radius);
}
.zest-calendar .lane-item {
    inset-block-start: calc(var(--_number-height) + var(--_lane) * (var(--_item-height) + 2px));
    inset-inline-start: 2px;
    width: calc(var(--_span) * (100% + var(--_border-width)) - 4px);
    height: var(--_item-height);
}
.zest-calendar .all-day-cell .lane-item {
    inset-block-start: calc(var(--_lane) * (var(--_item-height) + 2px));
}
.zest-calendar .continues-before {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
}
.zest-calendar .continues-after {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
}
.zest-calendar .item-main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    padding: 0 0.25em;
    overflow: hidden;
    background: none;
    border: none;
    color: inherit;
    text-align: start;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.zest-calendar .grid-item .item-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    white-space: normal;
}
.zest-calendar .item-time {
    font-size: 0.875em;
    white-space: nowrap;
}
.zest-calendar .lane-item .item-time {
    margin-inline-end: 0.25em;
}
.zest-calendar .busy {
    background: repeating-linear-gradient(135deg, var(--_item-face) 0 6px, var(--_window) 6px 12px);
}
.zest-calendar .grip {
    flex: none;
    min-width: 24px;
    min-height: 22px;
    padding: 0;
    background: none;
    border: none;
    color: inherit;
    touch-action: none;
}
.zest-calendar .grip[aria-pressed="true"] {
    background: var(--_highlight);
    color: var(--_highlight-text);
}
.zest-calendar .resize {
    position: absolute;
    touch-action: none;
}
.zest-calendar .grid-item .resize {
    inset-inline: 0;
    inset-block-end: 0;
    height: 0.5em;
    cursor: ns-resize;
}
.zest-calendar .lane-item .resize {
    inset-block: 0;
    inset-inline-end: 0;
    width: 0.5em;
    cursor: ew-resize;
}
.zest-calendar .editing, .zest-calendar .pending {
    outline: 2px dashed var(--_focus);
    outline-offset: -2px;
    z-index: 2;
}
.zest-calendar.dragging .item {
    pointer-events: none;
}
.zest-calendar.dragging, .zest-calendar.dragging * {
    cursor: grabbing;
    user-select: none;
}
.zest-calendar .head, .zest-calendar .all-day, .zest-calendar .row {
    display: grid;
    grid-template-columns: var(--_time-width) repeat(var(--_days), minmax(0, 1fr));
}
.zest-calendar .head, .zest-calendar .all-day {
    overflow-y: hidden;
    scrollbar-gutter: stable;
}
.zest-calendar .column-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: 0 0.25em;
    min-width: 0;
    padding: 0.25em 0;
    overflow: hidden;
    font-size: 0.875em;
}
.zest-calendar .head-day {
    min-width: 1.5em;
    text-align: center;
    border-radius: 0.75em;
}
.zest-calendar .time-label {
    box-sizing: border-box;
    padding-inline: 0.25em;
    font-size: 0.75em;
    color: var(--_secondary-text);
    text-align: end;
}
.zest-calendar .scroller {
    max-height: var(--_grid-height);
    overflow-y: auto;
    scrollbar-gutter: stable;
}
.zest-calendar .rows {
    position: relative;
}
.zest-calendar .row {
    height: var(--_slot-height);
}
.zest-calendar .slot {
    box-sizing: border-box;
    min-width: 0;
    border-block-start: var(--_border-width) solid var(--_line);
    border-inline-end: var(--_border-width) solid var(--_line);
}
.zest-calendar .slot.half {
    border-block-start-style: dashed;
}
.zest-calendar .grid-item {
    inset-block-start: calc(var(--_top) * 100%);
    height: calc(var(--_height) * 100%);
    inset-inline-start: calc(var(--_time-width) + (100% - var(--_time-width)) * (var(--_day) + var(--_column) / var(--_columns)) / var(--_days) + 1px);
    width: calc((100% - var(--_time-width)) / var(--_days) / var(--_columns) - 3px);
}
.zest-calendar .now {
    position: absolute;
    z-index: 2;
    inset-block-start: calc(var(--_top) * 100%);
    inset-inline-start: calc(var(--_time-width) + (100% - var(--_time-width)) * var(--_day) / var(--_days));
    width: calc((100% - var(--_time-width)) / var(--_days));
    border-block-start: 2px solid var(--_now);
    pointer-events: none;
}
.zest-calendar .agenda {
    margin: 0;
    padding: 0;
    list-style: none;
}
.zest-calendar .agenda-day {
    display: grid;
    grid-template-columns: minmax(6em, 1fr) minmax(0, 3fr);
    gap: var(--_gap);
    padding-block: var(--_gap);
    border-block-start: var(--_border-width) solid var(--_line);
}
.zest-calendar .agenda-date {
    font-weight: bold;
}
.zest-calendar .agenda-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.zest-calendar .agenda .item {
    position: static;
    min-height: var(--_height);
}
.zest-calendar .agenda .item-main {
    white-space: normal;
}
.zest-calendar .empty {
    margin: 0;
    padding: var(--_gap);
    color: var(--_secondary-text);
}
/* The width of the calendar, not of the page, decides */
@container (max-width: 34em) {
    .zest-calendar {
        --_time-width: var(--zest-calendar-view-time-width, 3.5em);
    }
    .zest-calendar .head-name, .zest-calendar .lane-item .item-time {
        display: none;
    }
    .zest-calendar .agenda-day {
        grid-template-columns: minmax(0, 1fr);
    }
}
@media (forced-colors: active) {
    .zest-calendar .item {
        border-color: CanvasText;
    }
    .zest-calendar [aria-selected="true"], .zest-calendar .toolbar button[aria-pressed="true"], .zest-calendar .grip[aria-pressed="true"],
    .zest-calendar .today .day-number, .zest-calendar .column-head.today .head-day {
        forced-color-adjust: none;
        background: Highlight;
        color: HighlightText;
    }
    .zest-calendar .now {
        border-color: Highlight;
    }
}
`;

const OPTION_ATTRIBUTES = [
    'view', 'date', 'locale', 'time-zone', 'first-day-of-week', 'day-start', 'day-end', 'slot-minutes', 'days',
    'readonly', 'views', 'max-items', 'scroll-time', 'twenty-four-hour-format',
];

const DEFAULT_LABELS = {
    previousMonth: 'Previous month', nextMonth: 'Next month', previousWeek: 'Previous week', nextWeek: 'Next week',
    previousDays: 'Previous days', nextDays: 'Next days', today: 'Today', views: 'View',
    month: 'Month', week: 'Week', day: 'Day', agenda: 'Agenda',
    time: 'Time', allDay: 'All day', busy: 'Busy', untitled: 'No title', noEvents: 'No events',
    more: '+{count} more', moreOn: 'on {date}', events: {one: '{count} event', other: '{count} events'},
    continues: 'continues', grip: 'Move or resize {title}', cancel: 'Cancel',
    moving: 'Moving {title}. Select a new place, or use the arrow keys and press Enter. Select the handle again to change the end.',
    resizing: 'Changing the end of {title}. Select the new end, or use the arrow keys and press Enter. Select the handle again to stop.',
    cancelled: 'The change is cancelled.',
};

const kebab = (name) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
const fill = (text, values) => String(text).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
const DAY = 1440;
const TIME_GRID = new Set(['week', 'day']);

export default class CalendarView extends DataComponent {
    static styles = defaultStyles;
    static changeAttributes = OPTION_ATTRIBUTES;

    #wrapper;
    #content;
    #live;
    #config = {};
    #events = [];
    #items = [];
    #pending = new Map();
    #view = null;
    #anchor = null;
    #focus = null;
    #selection = null;
    #edit = null;
    #press = null;
    #nextFocus = null;
    #scrolledFor = null;
    #emittedFor = null;
    #suppressClick = false;
    #listening = false;

    constructor() {
        super();
        this.template = "";
        this.#wrapper = document.createElement('div');
        this.#content = document.createElement('div');
        this.#content.className = 'content';
        this.#content.style.display = 'contents';
        this.#live = document.createElement('div');
        this.#live.className = 'live';
        this.#live.setAttribute('aria-live', 'polite');
        this.#wrapper.className = 'zest-calendar';
        this.#wrapper.setAttribute('part', 'calendar');
        this.#wrapper.append(this.#content, this.#live);
    }

    // Options: an attribute comes first, and then the data from updateConfig or a registry

    #option(name) {
        const attribute = kebab(name);
        return this.hasAttribute(attribute) ? this.getAttribute(attribute) : this.#config[name];
    }
    #flag(name) {
        const value = this.#option(name);
        if (value === undefined || value === null) { return false; }
        return typeof value === 'boolean' ? value : value !== 'false';
    }
    #number(name, fallback) {
        const value = Number(this.#option(name));
        return Number.isFinite(value) && value > 0 ? value : fallback;
    }
    #label(name) { return this.#config.labels?.[name] ?? DEFAULT_LABELS[name]; }
    get locale() {
        return this.#option('locale') || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    }
    get timeZone() { return this.#option('timeZone') || undefined; }
    get view() {
        const view = this.#view ?? this.#option('view');
        return layout.VIEWS.includes(view) ? view : 'month';
    }
    set view(view) {
        this.#view = layout.VIEWS.includes(view) ? view : null;
        this.#selection = null;
        this.invalidate();
    }
    // The anchor date, YYYY-MM-DD
    get date() { return model.formatDate(this.#anchorDate()); }
    set date(text) {
        const parsed = model.parseValue(String(text ?? ''), 'date', {timeZone: this.timeZone});
        if (parsed) {
            this.#anchor = parsed;
            this.#focus = null;
            this.invalidate();
        }
    }
    get events() { return this.#events; }
    set events(events) {
        this.#events = Array.isArray(events) ? events : [];
        // New data from the application replaces each move that waited for it
        this.#pending.clear();
        this.invalidate();
    }
    get readOnly() { return this.#flag('readonly'); }
    get #firstDay() {
        const value = this.#option('firstDayOfWeek');
        return value === undefined || value === null || value === '' ? model.firstDayOfWeek(this.locale) : Number(value) % 7;
    }
    get #days() {
        return this.#number('days', 0) || undefined;
    }
    get #slot() {
        const slot = Math.round(this.#number('slotMinutes', 30));
        return Math.min(240, Math.max(5, slot));
    }
    get #hours() {
        const start = layout.readClock(this.#option('dayStart'), 0);
        const end = layout.readClock(this.#option('dayEnd'), DAY);
        return end > start ? {start, end} : {start: 0, end: DAY};
    }
    get #twentyFourHours() {
        const value = this.#option('twentyFourHourFormat');
        return value === undefined || value === null ? model.usesTwentyFourHours(this.locale) : this.#flag('twentyFourHourFormat');
    }
    #now() {
        return model.fromInstant(this.#config.now?.() ?? new Date(), this.timeZone);
    }
    #anchorDate() {
        if (this.#anchor) { return this.#anchor; }
        const attribute = model.parseValue(String(this.#option('date') ?? ''), 'date');
        return attribute ?? model.truncate(this.#now(), 'date');
    }
    get range() {
        const range = this.#range();
        const detail = layout.toDetail(model.dayNumber(range.start) * DAY, model.dayNumber(range.end) * DAY, false, this.timeZone);
        return {
            view: this.view, start: detail.start, end: detail.end,
            startDate: model.formatDate(range.start), endDate: model.formatDate(range.end),
            timeZone: this.timeZone ?? null,
        };
    }
    #range() {
        return layout.viewRange(this.view, this.#anchorDate(), {firstDay: this.#firstDay, days: this.#days});
    }

    // The data interface

    updateConfig(partial = {}) {
        const {events, ...config} = partial;
        this.#config = {...this.#config, ...config};
        if (events !== undefined) { this.events = events; }
        this.invalidate();
    }
    postDataRegistration() {
        if (this.registerResult?.calendarConfig) {
            this.updateConfig(this.registerResult.calendarConfig);
        }
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) { return; }
        // An attribute from the application wins over a change that the user made in the calendar
        if (name === 'view') { this.#view = null; }
        if (name === 'date') { this.#anchor = null; this.#focus = null; }
        this.#selection = null;
        this.invalidate();
    }
    connectedCallback() {
        super.connectedCallback();
        if (this.registryName && this.dataRegisterFuncName) {
            this.doDataRegistration();
        }
        this.#listen();
        // The line that shows the time now moves each minute
        const timer = setInterval(() => this.#moveNowLine(), 60000);
        this.own(() => clearInterval(timer));
        this.own(() => this.#endPress());
        this.render();
    }

    // Navigation

    previous() { this.#step(-1); }
    next() { this.#step(1); }
    today() { this.#goTo(model.truncate(this.#now(), 'date')); }
    goTo(text) { this.date = text; }
    #step(direction) {
        this.#goTo(layout.stepAnchor(this.view, this.#anchorDate(), direction, {days: this.#days}));
    }
    #goTo(date, focus) {
        this.#anchor = date;
        this.#focus = focus ?? null;
        this.#selection = null;
        this.render();
    }
    #setView(view, date) {
        this.#view = view;
        if (date) { this.#anchor = date; }
        this.#focus = null;
        this.#selection = null;
        this.render();
    }

    // Drawing

    render() {
        if (!this.isConnected) { return; }
        const focusKey = this.#nextFocus ?? this.#activeKey();
        this.#nextFocus = null;
        const oldScroll = this.#wrapper.querySelector('.scroller')?.scrollTop;
        const view = this.view;
        const range = this.#range();
        const rangeKey = `${view}|${model.formatDate(range.start)}|${model.formatDate(range.end)}|${this.timeZone ?? ''}`;
        this.#items = this.#shownItems();
        if (this.#focus && !this.#inRange(this.#focus.date, range)) { this.#focus = null; }
        if (!this.#focus) { this.#focus = this.#defaultFocus(range); }

        const body = view === 'month' ? this.#drawMonth(range)
            : view === 'agenda' ? this.#drawAgenda(range)
            : this.#drawTimeGrid(range);
        this.#content.replaceChildren(this.#drawToolbar(range), this.#drawStatus(), body);
        this.#wrapper.classList.toggle('dragging', Boolean(this.#press?.dragging));
        this.#wrapper.dataset.view = view;
        this.root.replaceChildren(this.#wrapper);
        // The content is new on each render, so a fallback style element does not add up
        this.applyStyles(this.#content);
        // Each grid keeps one cell in the tab order
        const cells = this.#wrapper.querySelectorAll('[data-unit]');
        if (cells.length && ![...cells].some(cell => cell.tabIndex === 0)) { cells[0].tabIndex = 0; }

        const scroller = this.#wrapper.querySelector('.scroller');
        if (scroller) {
            if (this.#scrolledFor !== rangeKey) {
                const {start} = this.#hours;
                const target = layout.readClock(this.#option('scrollTime'), 8 * 60);
                scroller.scrollTop = Math.max(0, (target - start) / this.#slot) * this.#slotPixels(scroller);
            } else if (oldScroll !== undefined) {
                scroller.scrollTop = oldScroll;
            }
        }
        this.#scrolledFor = rangeKey;
        if (focusKey) { this.#focusKey(focusKey); }
        if (this.#emittedFor !== rangeKey) {
            if (this.#emittedFor !== null) { this.#announce(this.#title(range)); }
            this.#emittedFor = rangeKey;
            this.#send('calendar-range-changed', this.range);
        }
    }
    // Moves only the line, because a render puts the focus on a new element, and a screen reader
    // would read the cell again each minute. A new day, or a line that comes or goes, renders.
    #moveNowLine() {
        if (!TIME_GRID.has(this.view)) { return; }
        const line = this.#wrapper.querySelector('.now');
        const days = layout.rangeDays(this.#range());
        const now = this.#now();
        const day = days.findIndex(found => model.compare(found, now, 'date') === 0);
        const minute = now.hour * 60 + now.minute;
        const {start, end} = this.#hours;
        const shown = day !== -1 && minute >= start && minute < end;
        if (line && shown && Number(line.style.getPropertyValue('--_day')) === day) {
            line.style.setProperty('--_top', (minute - start) / (end - start));
        } else if (Boolean(line) !== shown || line) {
            this.invalidate();
        }
    }
    #slotPixels(scroller) {
        return scroller.querySelector('.row')?.getBoundingClientRect().height || 0;
    }
    #activeKey() {
        const active = this.root === this ? document.activeElement : this.root.activeElement;
        return active && this.#wrapper.contains(active) ? active.dataset.key ?? null : null;
    }
    #focusKey(key) {
        const found = this.#wrapper.querySelector(`[data-key="${CSS.escape(key)}"]`);
        // Each render makes new elements, so a scroll here would move the grid under the pointer
        if (found) { found.focus({preventScroll: true}); }
    }
    #inRange(date, range) {
        return model.compare(date, range.start, 'date') >= 0 && model.compare(date, range.end, 'date') < 0;
    }
    #defaultFocus(range) {
        const today = model.truncate(this.#now(), 'date');
        const anchor = this.#anchorDate();
        const date = this.#inRange(today, range) ? today : (this.#inRange(anchor, range) ? anchor : range.start);
        const {start, end} = this.#hours;
        const scroll = layout.readClock(this.#option('scrollTime'), 8 * 60);
        const minute = Math.min(Math.max(scroll, start), end - this.#slot);
        return {date, minute: TIME_GRID.has(this.view) ? minute - ((minute - start) % this.#slot) : null};
    }
    // The items of the application, with each move that the user made and that waits for new data
    #shownItems() {
        const items = layout.normalizeEvents(this.#events, this.timeZone);
        return items.map(item => {
            const change = this.#edit?.id === item.id ? this.#edit : this.#pending.get(item.id);
            return change ? {...item, start: change.start, end: change.end, changed: true} : item;
        });
    }
    #title(range) {
        const zone = {calendar: 'gregory', timeZone: 'UTC'};
        const date = (parts) => model.toInstant(parts, 'UTC');
        const last = model.addDays(range.end, -1);
        if (this.view === 'month') {
            return model.dateFormat(this.locale, {...zone, year: 'numeric', month: 'long'}).format(date(this.#anchorDate()));
        }
        if (model.compare(range.start, last, 'date') === 0) {
            return model.dateFormat(this.locale, {...zone, dateStyle: 'full'}).format(date(range.start));
        }
        return model.dateFormat(this.locale, {...zone, year: 'numeric', month: 'short', day: 'numeric'}).formatRange(date(range.start), date(last));
    }
    #fullDate(parts) {
        return model.formatDisplay(parts, 'date', {locale: this.locale, format: 'full'});
    }
    #clock(minuteOfDay) {
        const hour = Math.floor(minuteOfDay / 60) % 24;
        return model.formatDisplay({hour, minute: minuteOfDay % 60, second: 0}, 'time', {locale: this.locale, twentyFourHours: this.#twentyFourHours});
    }
    #announce(text) {
        // A change to the text of a live region is what a screen reader reads
        this.#live.textContent = '';
        this.#live.textContent = text;
    }
    #el(tag, className, attributes = {}, ...children) {
        const element = document.createElement(tag);
        if (className) { element.className = className; }
        for (const [name, value] of Object.entries(attributes)) {
            if (value !== null && value !== undefined && value !== false) { element.setAttribute(name, value === true ? '' : value); }
        }
        element.append(...children);
        return element;
    }
    #button(className, text, key, onClick, attributes = {}) {
        const button = this.#el('button', className, {type: 'button', 'data-key': key, ...attributes}, text);
        if (onClick) { button.addEventListener('click', onClick); }
        return button;
    }

    #drawToolbar(range) {
        const view = this.view;
        const unit = view === 'month' ? 'Month' : view === 'week' ? 'Week' : 'Days';
        const toolbar = this.#el('div', 'toolbar', {part: 'toolbar'});
        toolbar.append(
            this.#el('div', 'group', {},
                this.#button('previous', '‹', 'previous', () => this.previous(), {'aria-label': this.#label(`previous${unit}`)}),
                this.#button('today-button', this.#label('today'), 'today', () => this.today()),
                this.#button('next', '›', 'next', () => this.next(), {'aria-label': this.#label(`next${unit}`)}),
            ),
            this.#el('div', 'title', {part: 'title'}, this.#title(range)),
        );
        const views = String(this.#option('views') ?? layout.VIEWS.join(','))
            .split(',').map(name => name.trim()).filter(name => layout.VIEWS.includes(name));
        if (views.length > 1) {
            const group = this.#el('div', 'group views', {role: 'group', 'aria-label': this.#label('views')});
            for (const name of views) {
                group.appendChild(this.#button(`view-${name}`, this.#label(name), `view-${name}`, () => this.#setView(name),
                    {'aria-pressed': String(name === view)}));
            }
            toolbar.appendChild(group);
        }
        return toolbar;
    }
    // The instructions for a move with clicks or keys. A drag shows none: the banner would push
    // the grid down under the pointer.
    #drawStatus() {
        const shown = Boolean(this.#edit) && !this.#edit.dragged;
        const status = this.#el('div', 'status', {part: 'status', hidden: !shown});
        if (shown) {
            const title = this.#edit.title;
            status.append(
                this.#el('span', '', {}, fill(this.#label(this.#edit.mode === 'move' ? 'moving' : 'resizing'), {title})),
                this.#button('cancel', this.#label('cancel'), 'cancel', () => this.#cancelEdit()),
            );
        }
        return status;
    }
    #itemTitle(item) {
        if (item.busyOnly) { return this.#label('busy'); }
        return item.title || this.#label('untitled');
    }
    // What a screen reader reads after the visible text: the date and the time
    #itemDetails(item) {
        const start = layout.partsOf(item.start);
        if (item.allDay) {
            const last = layout.dayOf(item.end - 1);
            const days = model.compare(start, last, 'date') === 0 ? this.#fullDate(start) : `${this.#fullDate(start)} – ${this.#fullDate(last)}`;
            return `, ${this.#label('allDay')}, ${days}`;
        }
        const end = layout.partsOf(item.end);
        const sameDay = model.compare(start, end, 'date') === 0 || item.end === item.start;
        const endText = sameDay ? this.#clock(end.hour * 60 + end.minute) : `${this.#fullDate(end)} ${this.#clock(end.hour * 60 + end.minute)}`;
        const range = item.end > item.start ? `${this.#clock(start.hour * 60 + start.minute)} – ${endText}` : this.#clock(start.hour * 60 + start.minute);
        return `, ${this.#fullDate(start)}, ${range}`;
    }
    // One item. place is 'lane' for the month and the all-day row, 'grid' for the time grid, and
    // 'list' for the agenda. key tells the copies of an item on more than one row apart.
    #drawItem(item, place, key, segment = {}) {
        const classes = ['item', `${place}-item`];
        if (item.busyOnly) { classes.push('busy'); }
        if (segment.continuesBefore) { classes.push('continues-before'); }
        if (segment.continuesAfter) { classes.push('continues-after'); }
        if (this.#edit?.id === item.id) { classes.push('editing'); }
        else if (this.#pending.has(item.id)) { classes.push('pending'); }
        const element = this.#el('div', classes.join(' '), {part: 'item', 'data-id': item.id});
        if (item.color) { element.style.setProperty('--_stripe', item.color); }
        const title = this.#itemTitle(item);
        const main = this.#button('item-main', '', `item-${item.id}-${key}`, () => this.#selectItem(item), {'data-id': item.id});
        const showTime = !item.allDay && !(place === 'lane' && layout.spansDays(item) && segment.continuesBefore);
        if (showTime) {
            const start = layout.partsOf(item.start);
            main.append(this.#el('span', 'item-time', {}, this.#clock(start.hour * 60 + start.minute)), ' ');
        }
        main.append(this.#el('span', 'item-title', {}, title), this.#el('span', 'sr', {}, this.#itemDetails(item)));
        if (segment.continuesBefore || segment.continuesAfter) {
            main.appendChild(this.#el('span', 'sr', {}, `, ${this.#label('continues')}`));
        }
        element.appendChild(main);
        if (item.editable && !this.readOnly && place !== 'list') {
            const editing = this.#edit?.id === item.id;
            element.appendChild(this.#button('grip', '⠿', `grip-${item.id}-${key}`, () => this.#toggleEdit(item), {
                'aria-label': fill(this.#label('grip'), {title}),
                'aria-pressed': String(editing),
                'data-id': item.id,
                'data-grip': item.id,
            }));
            if (!item.busyOnly) {
                element.appendChild(this.#el('div', 'resize', {'aria-hidden': 'true', 'data-id': item.id}));
            }
        }
        return element;
    }
    #tabIndex(isFocus) { return isFocus ? '0' : '-1'; }
    // The name of a cell is its text, so that it holds the visible text of its items. This hidden
    // text comes first, and says the date and the time.
    #cellLabel(text) {
        return this.#el('span', 'sr cell-label', {}, text);
    }
    #countLabel(count) {
        const forms = this.#label('events');
        const form = model.pluralRules(this.locale).select(count);
        return fill(typeof forms === 'string' ? forms : (forms[form] ?? forms.other), {count: model.formatNumber(count, this.locale)});
    }
    #weekdayHeads(days, className) {
        const shortNames = model.weekdayNames(this.locale, 'short');
        const longNames = model.weekdayNames(this.locale, 'long');
        return days.map(day => {
            const position = model.weekday(day);
            return this.#el('div', className, {role: 'columnheader', 'aria-label': longNames[position]}, shortNames[position]);
        });
    }
    #isSelected(day, minute = null) {
        const selection = this.#selection;
        if (!selection) { return false; }
        const value = model.dayNumber(day) * DAY + (minute ?? 0);
        const low = Math.min(selection.anchor, selection.focus);
        const high = Math.max(selection.anchor, selection.focus);
        if (selection.kind === 'day') { return minute === null && value >= low && value <= high; }
        return minute !== null && value >= low && value <= high;
    }

    #drawMonth(range) {
        const maxLanes = Math.round(this.#number('maxItems', 3));
        const weeks = layout.monthLayout(this.#items, range, maxLanes);
        const anchor = this.#anchorDate();
        const today = model.truncate(this.#now(), 'date');
        const grid = this.#el('div', 'month', {role: 'grid', part: 'grid', 'aria-label': this.#title(range), 'aria-readonly': this.readOnly ? 'true' : null});
        grid.appendChild(this.#el('div', 'weekdays', {role: 'row'}, ...this.#weekdayHeads(weeks[0].days, 'weekday')));
        for (const week of weeks) {
            const row = this.#el('div', 'week', {role: 'row'});
            const hasMore = week.hidden.some(count => count > 0);
            row.style.setProperty('--_lanes', week.lanes);
            if (hasMore) { row.style.setProperty('--_more-height', '26px'); }
            week.days.forEach((day, col) => {
                const iso = model.formatDate(day);
                const isFocus = model.compare(day, this.#focus.date, 'date') === 0;
                const onDay = this.#items.filter(item => {
                    const [first, last] = layout.coveredDays(item);
                    return first <= model.dayNumber(day) && last >= model.dayNumber(day);
                }).length;
                const classes = ['day'];
                if (day.month !== anchor.month) { classes.push('other-month'); }
                if (model.compare(day, today, 'date') === 0) { classes.push('today'); }
                const cell = this.#el('div', classes.join(' '), {
                    role: 'gridcell', part: 'day', tabindex: this.#tabIndex(isFocus),
                    'data-key': `day-${iso}`, 'data-date': iso, 'data-unit': 'day',
                    'aria-selected': this.#isSelected(day) ? 'true' : null,
                    'aria-current': classes.includes('today') ? 'date' : null,
                });
                cell.append(
                    this.#cellLabel(onDay ? `${this.#fullDate(day)}, ${this.#countLabel(onDay)}` : this.#fullDate(day)),
                    this.#el('span', 'day-number', {'aria-hidden': 'true'}, model.formatNumber(day.day, this.locale)),
                );
                for (const segment of week.segments.filter(found => found.startCol === col)) {
                    const element = this.#drawItem(segment.item, 'lane', iso, segment);
                    element.style.setProperty('--_lane', segment.lane);
                    element.style.setProperty('--_span', segment.span);
                    this.#setItemTabs(element, isFocus);
                    cell.appendChild(element);
                }
                if (week.hidden[col]) {
                    const more = this.#button('more', fill(this.#label('more'), {count: model.formatNumber(week.hidden[col], this.locale)}),
                        `more-${iso}`, () => this.#setView('day', day), {part: 'more', tabindex: this.#tabIndex(isFocus)});
                    more.appendChild(this.#el('span', 'sr', {}, ` ${fill(this.#label('moreOn'), {date: this.#fullDate(day)})}`));
                    cell.appendChild(more);
                }
                row.appendChild(cell);
            });
            grid.appendChild(row);
        }
        return grid;
    }
    #setItemTabs(element, isFocus) {
        for (const button of element.querySelectorAll('button')) { button.tabIndex = isFocus ? 0 : -1; }
    }

    #drawTimeGrid(range) {
        const days = layout.rangeDays(range);
        const {start, end} = this.#hours;
        const slot = this.#slot;
        const grid = layout.timeGridLayout(this.#items, days, {dayStart: start, dayEnd: end, minMinutes: Math.min(slot, 15)});
        const today = model.truncate(this.#now(), 'date');
        const container = this.#el('div', 'time-grid', {role: 'grid', part: 'grid', 'aria-label': this.#title(range), 'aria-readonly': this.readOnly ? 'true' : null});
        container.style.setProperty('--_days', days.length);

        const head = this.#el('div', 'head', {role: 'row'}, this.#el('div', 'corner', {role: 'columnheader'}, this.#el('span', 'sr', {}, this.#label('time'))));
        const shortNames = model.weekdayNames(this.locale, 'short');
        for (const day of days) {
            const isToday = model.compare(day, today, 'date') === 0;
            head.appendChild(this.#el('div', `column-head${isToday ? ' today' : ''}`, {role: 'columnheader', 'aria-label': this.#fullDate(day)},
                this.#el('span', 'head-name', {}, shortNames[model.weekday(day)]),
                this.#el('span', 'head-day', {}, model.formatNumber(day.day, this.locale))));
        }
        container.appendChild(head);

        const allDay = this.#el('div', 'all-day', {role: 'row'}, this.#el('div', 'time-label', {role: 'rowheader'}, this.#label('allDay')));
        allDay.style.setProperty('--_lanes', grid.lanes);
        days.forEach((day, col) => {
            const iso = model.formatDate(day);
            const isFocus = this.#focus.minute === null && model.compare(day, this.#focus.date, 'date') === 0;
            const cell = this.#el('div', 'all-day-cell', {
                role: 'gridcell', tabindex: this.#tabIndex(isFocus), 'data-key': `all-day-${iso}`, 'data-date': iso, 'data-unit': 'day',
                'aria-selected': this.#isSelected(day) ? 'true' : null,
            }, this.#cellLabel(`${this.#label('allDay')}, ${this.#fullDate(day)}`));
            for (const segment of grid.allDay.filter(found => found.startCol === col)) {
                const element = this.#drawItem(segment.item, 'lane', `all-day-${iso}`, segment);
                element.style.setProperty('--_lane', segment.lane);
                element.style.setProperty('--_span', segment.span);
                this.#setItemTabs(element, isFocus);
                cell.appendChild(element);
            }
            allDay.appendChild(cell);
        });
        container.appendChild(allDay);

        const rows = this.#el('div', 'rows', {role: 'rowgroup'});
        const slots = Math.ceil((end - start) / slot);
        for (let index = 0; index < slots; index++) {
            const minute = start + index * slot;
            const shown = minute % 60 === 0 || slot >= 60 || index === 0;
            const row = this.#el('div', 'row', {role: 'row'},
                this.#el('div', 'time-label', {role: 'rowheader'}, shown ? this.#clock(minute) : this.#el('span', 'sr', {}, this.#clock(minute))));
            days.forEach((day, col) => {
                const absolute = model.dayNumber(day) * DAY + minute;
                const isFocus = this.#focus.minute === minute && model.compare(day, this.#focus.date, 'date') === 0;
                const cell = this.#el('div', `slot${minute % 60 === 0 ? '' : ' half'}`, {
                    role: 'gridcell', part: 'slot', tabindex: this.#tabIndex(isFocus),
                    'data-key': `slot-${absolute}`, 'data-minute': absolute, 'data-unit': 'slot',
                    'aria-selected': this.#isSelected(day, minute) ? 'true' : null,
                }, this.#cellLabel(`${this.#fullDate(day)}, ${this.#clock(minute)}`));
                for (const segment of grid.columns[col].segments) {
                    const startSlot = Math.min(slots - 1, Math.floor((segment.from - (model.dayNumber(day) * DAY + start)) / slot));
                    if (startSlot !== index) { continue; }
                    const element = this.#drawItem(segment.item, 'grid', `${model.formatDate(day)}`, segment);
                    element.style.setProperty('--_top', segment.top);
                    element.style.setProperty('--_height', segment.height);
                    element.style.setProperty('--_day', col);
                    element.style.setProperty('--_column', segment.column);
                    element.style.setProperty('--_columns', segment.columns);
                    this.#setItemTabs(element, isFocus);
                    cell.appendChild(element);
                }
                row.appendChild(cell);
            });
            rows.appendChild(row);
        }
        const now = this.#now();
        const nowDay = days.findIndex(day => model.compare(day, now, 'date') === 0);
        const nowMinute = now.hour * 60 + now.minute;
        if (nowDay !== -1 && nowMinute >= start && nowMinute < end) {
            const line = this.#el('div', 'now', {'aria-hidden': 'true', part: 'now'});
            line.style.setProperty('--_top', (nowMinute - start) / (end - start));
            line.style.setProperty('--_day', nowDay);
            rows.appendChild(line);
        }
        const scroller = this.#el('div', 'scroller', {}, rows);
        container.appendChild(scroller);
        return container;
    }

    #drawAgenda(range) {
        const days = layout.agendaLayout(this.#items, range);
        if (!days.length) {
            return this.#el('p', 'empty', {part: 'empty'}, this.#label('noEvents'));
        }
        const list = this.#el('ul', 'agenda', {part: 'agenda', 'aria-label': this.#title(range)});
        for (const {day, items} of days) {
            const iso = model.formatDate(day);
            const entries = this.#el('ul', 'agenda-items', {});
            for (const item of items) {
                entries.appendChild(this.#el('li', '', {}, this.#drawItem(item, 'list', iso)));
            }
            list.appendChild(this.#el('li', 'agenda-day', {}, this.#el('div', 'agenda-date', {}, this.#fullDate(day)), entries));
        }
        return list;
    }

    // What the user does

    #send(name, detail) {
        this.emit(name, {...detail, instanceId: this.instanceId});
    }
    #selectItem(item) {
        if (this.#suppressClick) { return; }
        if (this.#edit) { return; }
        this.#send('calendar-event-select', {
            id: item.id, seriesId: item.event.seriesId ?? null, calendarId: item.event.calendarId ?? null, view: this.view,
        });
    }
    #selectSlots(selection) {
        const low = Math.min(selection.anchor, selection.focus);
        const high = Math.max(selection.anchor, selection.focus);
        const allDay = selection.kind === 'day';
        const detail = layout.toDetail(low, allDay ? high + DAY : high + this.#slot, allDay, this.timeZone);
        this.#selection = null;
        this.render();
        this.#send('calendar-slot-select', {...detail, view: this.view});
    }
    // The unit of a cell: a day as its first minute, or a slot as its minute
    #unitOf(cell) {
        if (!cell) { return null; }
        if (cell.dataset.unit === 'slot') { return {kind: 'slot', value: Number(cell.dataset.minute)}; }
        const date = model.parseValue(cell.dataset.date, 'date');
        return date ? {kind: 'day', value: model.dayNumber(date) * DAY} : null;
    }

    // Moving and resizing. The same preview serves a drag, a click on a cell, and the keyboard.

    #toggleEdit(item) {
        if (this.#suppressClick) { return; }
        if (this.#edit?.id !== item.id) {
            this.#startEdit(item, 'move');
        } else if (this.#edit.mode === 'move') {
            this.#edit = {...this.#edit, mode: 'resize'};
            this.#nextFocus = this.#gripKey(item.id);
            this.render();
            this.#announce(fill(this.#label('resizing'), {title: this.#edit.title}));
        } else {
            this.#cancelEdit();
        }
    }
    #startEdit(item, mode) {
        const original = this.#items.find(found => found.id === item.id) ?? item;
        this.#edit = {id: item.id, mode, start: original.start, end: original.end, allDay: original.allDay,
            origin: {start: original.start, end: original.end}, title: this.#itemTitle(original)};
        this.#selection = null;
        this.#nextFocus = this.#gripKey(item.id);
        this.render();
        this.#announce(fill(this.#label(mode === 'move' ? 'moving' : 'resizing'), {title: this.#edit.title}));
    }
    #gripKey(id) {
        return this.#wrapper.querySelector(`.grip[data-grip="${CSS.escape(id)}"]`)?.dataset.key ?? null;
    }
    #cancelEdit() {
        if (!this.#edit) { return; }
        const id = this.#edit.id;
        this.#edit = null;
        this.#nextFocus = this.#wrapper.querySelector(`.item-main[data-id="${CSS.escape(id)}"]`)?.dataset.key ?? null;
        this.render();
        this.#announce(this.#label('cancelled'));
    }
    // Changes the preview by an amount of minutes: the start and the end for a move, or the end
    #nudge(minutes) {
        const edit = this.#edit;
        const next = edit.mode === 'move'
            ? {start: edit.start + minutes, end: edit.end + minutes}
            : layout.resized({start: edit.start}, edit.end + minutes, edit.allDay ? DAY : this.#slot);
        this.#preview(next);
    }
    #preview(next) {
        this.#edit = {...this.#edit, ...next};
        const id = this.#edit.id;
        this.render();
        const key = this.#gripKey(id);
        if (key) { this.#focusKey(key); }
        const item = this.#items.find(found => found.id === id);
        if (item) { this.#announce(`${this.#edit.title}${this.#itemDetails(item)}`); }
    }
    // A click on a cell in edit mode: the item moves there, or its end moves there
    #placeAt(unit) {
        const edit = this.#edit;
        if (!unit || (edit.allDay && unit.kind === 'slot')) { return; }
        let next;
        if (edit.mode === 'move') {
            const start = unit.kind === 'slot' ? unit.value : unit.value + (edit.start - Math.floor(edit.start / DAY) * DAY);
            next = layout.moved(edit, start);
        } else if (unit.kind === 'slot') {
            next = layout.resized(edit, unit.value + this.#slot, this.#slot);
        } else {
            const [, last] = layout.coveredDays(edit);
            next = layout.resized(edit, edit.end + (unit.value / DAY - last) * DAY, edit.allDay ? DAY : this.#slot);
        }
        this.#edit = {...edit, ...next};
        this.#commitEdit();
    }
    #commitEdit() {
        const edit = this.#edit;
        this.#edit = null;
        const changed = edit.start !== edit.origin.start || edit.end !== edit.origin.end;
        if (changed) { this.#pending.set(edit.id, {start: edit.start, end: edit.end}); }
        this.#nextFocus = this.#wrapper.querySelector(`.item-main[data-id="${CSS.escape(edit.id)}"]`)?.dataset.key ?? null;
        this.render();
        if (!changed) { return; }
        const item = this.#items.find(found => found.id === edit.id);
        this.#announce(`${edit.title}${item ? this.#itemDetails(item) : ''}`);
        this.#send('calendar-event-move', {
            id: edit.id, ...layout.toDetail(edit.start, edit.end, edit.allDay, this.timeZone),
            seriesId: item?.event.seriesId ?? null, calendarId: item?.event.calendarId ?? null, view: this.view,
        });
    }

    // Input. The wrapper lives as long as the element, so its listeners need no removal.

    #listen() {
        if (this.#listening) { return; }
        this.#listening = true;
        this.#wrapper.addEventListener('keydown', (e) => this.#onKey(e));
        this.#wrapper.addEventListener('click', (e) => this.#onClick(e), true);
        this.#wrapper.addEventListener('pointerdown', (e) => this.#onPointerDown(e));
        this.#wrapper.addEventListener('pointermove', (e) => this.#onPointerMove(e));
        this.#wrapper.addEventListener('pointerup', (e) => this.#onPointerUp(e));
        this.#wrapper.addEventListener('pointercancel', () => this.#endPress());
        this.#wrapper.addEventListener('focusin', (e) => {
            const cell = e.target.closest?.('[data-unit]');
            if (cell && cell === e.target) { this.#focus = this.#focusOf(cell); }
        });
    }
    #focusOf(cell) {
        if (cell.dataset.unit === 'slot') {
            const minute = Number(cell.dataset.minute);
            return {date: layout.dayOf(minute), minute: minute - Math.floor(minute / DAY) * DAY};
        }
        return {date: model.parseValue(cell.dataset.date, 'date'), minute: null};
    }
    // The cell under the pointer. An item lies on the cells of its later slots and days, so the
    // cell is the first in the list at that point, and not the parent of the item.
    #cellAt(event) {
        const hitRoot = this.root === this ? document : this.root;
        const found = hitRoot.elementsFromPoint?.(event.clientX, event.clientY) ?? [];
        return found.find(element => element.matches('[data-unit]') && this.#wrapper.contains(element)) ?? null;
    }
    #onClick(e) {
        if (this.#suppressClick) {
            this.#suppressClick = false;
            e.stopPropagation();
            e.preventDefault();
            return;
        }
        const cell = e.target.closest?.('[data-unit]');
        if (!cell || e.target.closest('.item, .more')) { return; }
        if (this.#edit) {
            this.#placeAt(this.#unitOf(cell));
            return;
        }
        if (this.readOnly) { return; }
        const unit = this.#unitOf(cell);
        this.#selectSlots({kind: unit.kind, anchor: unit.value, focus: unit.value});
    }
    #onPointerDown(e) {
        if (e.button !== 0 || this.readOnly) { return; }
        const itemElement = e.target.closest?.('.item');
        // A drag of an item counts from the cell under the pointer, so the item stays under it
        const cell = (itemElement && this.#cellAt(e)) || e.target.closest?.('[data-unit]');
        const unit = this.#unitOf(cell);
        if (!unit) { return; }
        const item = itemElement ? this.#items.find(found => found.id === itemElement.dataset.id) : null;
        if (itemElement) {
            // A touch on an item scrolls the page. A person who uses touch moves it with the handle.
            const onHandle = e.target.closest('.grip, .resize');
            if (!item?.editable || (e.pointerType === 'touch' && !onHandle)) { return; }
            this.#press = {kind: e.target.closest('.resize') ? 'resize' : 'move', item, unit, x: e.clientX, y: e.clientY, dragging: false};
        } else {
            if (e.pointerType === 'touch' || this.#edit) { return; }
            this.#press = {kind: 'select', unit, x: e.clientX, y: e.clientY, dragging: false};
        }
    }
    #onPointerMove(e) {
        const press = this.#press;
        if (!press) { return; }
        if (!press.dragging) {
            if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) { return; }
            press.dragging = true;
            // Only for a drag: with capture, the click of a plain press goes to the wrapper
            this.#wrapper.setPointerCapture?.(e.pointerId);
            if (press.kind !== 'select') {
                this.#edit = {id: press.item.id, mode: press.kind, start: press.item.start, end: press.item.end, allDay: press.item.allDay,
                    origin: {start: press.item.start, end: press.item.end}, title: this.#itemTitle(press.item), dragged: true};
            }
            this.#wrapper.classList.add('dragging');
        }
        const unit = this.#unitOf(this.#cellAt(e));
        if (!unit || unit.kind !== press.unit.kind || unit.value === press.last) { return; }
        press.last = unit.value;
        if (press.kind === 'select') {
            // A selection of time stays on one day
            if (unit.kind === 'slot' && Math.floor(unit.value / DAY) !== Math.floor(press.unit.value / DAY)) { return; }
            this.#selection = {kind: unit.kind, anchor: press.unit.value, focus: unit.value};
            this.render();
            return;
        }
        const delta = unit.value - press.unit.value;
        const origin = this.#edit.origin;
        const next = press.kind === 'move'
            ? {start: origin.start + delta, end: origin.end + delta}
            : layout.resized(origin, origin.end + delta, press.item.allDay ? DAY : this.#slot);
        this.#edit = {...this.#edit, ...next};
        this.render();
    }
    #onPointerUp(e) {
        const press = this.#press;
        if (!press) { return; }
        this.#press = null;
        this.#wrapper.releasePointerCapture?.(e.pointerId);
        this.#wrapper.classList.remove('dragging');
        if (!press.dragging) { return; }
        // The browser sends a click after the pointer goes up. It is part of the drag.
        this.#suppressClick = true;
        setTimeout(() => { this.#suppressClick = false; }, 0);
        if (press.kind === 'select') {
            if (this.#selection) { this.#selectSlots(this.#selection); }
            return;
        }
        this.#commitEdit();
    }
    #endPress() {
        if (!this.#press) { return; }
        const dragged = this.#press.dragging && this.#press.kind !== 'select';
        this.#press = null;
        this.#wrapper.classList.remove('dragging');
        if (dragged) { this.#edit = null; }
        this.#selection = null;
        if (this.isConnected) { this.render(); }
    }

    #onKey(e) {
        const target = e.target;
        if (e.key === 'Escape' && (this.#edit || this.#selection)) {
            e.preventDefault();
            if (this.#edit) { this.#cancelEdit(); } else { this.#selection = null; this.render(); }
            return;
        }
        if (this.#edit && target.matches?.('.grip')) {
            this.#onEditKey(e);
            return;
        }
        if (target.matches?.('.item-main, .grip, .more') && e.key === 'Escape') {
            e.preventDefault();
            this.#focusKey(target.closest('[data-unit]')?.dataset.key);
            return;
        }
        const cell = target.closest?.('[data-unit]');
        if (!cell) { return; }
        const onCell = cell === target;
        if (!onCell && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) { return; }
        this.#onGridKey(e, cell, onCell);
    }
    #onEditKey(e) {
        const rtl = getComputedStyle(this).direction === 'rtl' ? -1 : 1;
        const edit = this.#edit;
        const inTimeGrid = TIME_GRID.has(this.view) && !edit.allDay;
        const step = inTimeGrid ? this.#slot : DAY * 7;
        const moves = {ArrowLeft: -DAY * rtl, ArrowRight: DAY * rtl, ArrowUp: -step, ArrowDown: step};
        if (e.key in moves) {
            if (!inTimeGrid && TIME_GRID.has(this.view) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { return; }
            e.preventDefault();
            this.#nudge(moves[e.key]);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.#commitEdit();
        }
    }
    #onGridKey(e, cell, onCell) {
        const rtl = getComputedStyle(this).direction === 'rtl' ? -1 : 1;
        const view = this.view;
        const focus = this.#focusOf(cell);
        const range = this.#range();
        const {start, end} = this.#hours;
        const slot = this.#slot;
        let date = focus.date;
        let minute = focus.minute;
        const timeGrid = TIME_GRID.has(view);
        switch (e.key) {
            case 'ArrowLeft': date = model.addDays(date, -rtl); break;
            case 'ArrowRight': date = model.addDays(date, rtl); break;
            case 'ArrowUp':
                if (!timeGrid) { date = model.addDays(date, -7); }
                else if (minute === null) { return; }
                else if (minute - slot < start) { minute = null; }
                else { minute -= slot; }
                break;
            case 'ArrowDown':
                if (!timeGrid) { date = model.addDays(date, 7); }
                else if (minute === null) { minute = start; }
                else if (minute + slot < end) { minute += slot; }
                break;
            case 'Home': date = timeGrid ? range.start : model.startOfWeek(date, this.#firstDay); break;
            case 'End': date = timeGrid ? model.addDays(range.end, -1) : model.addDays(model.startOfWeek(date, this.#firstDay), 6); break;
            case 'PageUp': case 'PageDown': {
                const direction = e.key === 'PageUp' ? -1 : 1;
                date = view === 'month'
                    ? model.addMonths(date, direction * (e.shiftKey ? 12 : 1))
                    : model.addDays(date, direction * model.daysBetween(range.start, range.end));
                break;
            }
            case 'Enter': case ' ': {
                if (!onCell) { return; }
                e.preventDefault();
                if (this.readOnly) { return; }
                const unit = this.#unitOf(cell);
                this.#selectSlots(this.#selection ?? {kind: unit.kind, anchor: unit.value, focus: unit.value});
                return;
            }
            default: return;
        }
        e.preventDefault();
        const kind = minute === null ? 'day' : 'slot';
        const value = model.dayNumber(date) * DAY + (minute ?? 0);
        const oldUnit = this.#unitOf(cell);
        if (e.shiftKey && !this.readOnly && !e.key.startsWith('Page') && oldUnit.kind === kind
            && (kind === 'day' || model.compare(date, focus.date, 'date') === 0)) {
            this.#selection = {kind, anchor: this.#selection?.kind === kind ? this.#selection.anchor : oldUnit.value, focus: value};
        } else {
            this.#selection = null;
        }
        this.#focus = {date, minute};
        this.#nextFocus = kind === 'slot' ? `slot-${value}` : (timeGrid ? `all-day-${model.formatDate(date)}` : `day-${model.formatDate(date)}`);
        if (!this.#inRange(date, range)) {
            // A view of days goes in whole steps, so that the days on screen stay together
            const length = model.daysBetween(range.start, range.end);
            this.#anchor = TIME_GRID.has(view) && view !== 'week'
                ? model.addDays(range.start, Math.floor(model.daysBetween(range.start, date) / length) * length)
                : date;
        }
        this.render();
    }
}

class ShadowCalendarView extends CalendarView {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}

export { CalendarView, ShadowCalendarView }
