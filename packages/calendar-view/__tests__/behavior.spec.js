import { describe, it, expect, vi, afterEach } from 'vitest';
import { CalendarView, ShadowCalendarView } from '../src';

customElements.define('calendar-view', CalendarView);
customElements.define('shadow-calendar-view', ShadowCalendarView);

// Friday, March 13, 2026, at 15:00 UTC
const NOW = new Date('2026-03-13T15:00:00Z');
const flush = () => Promise.resolve();

function makeCalendar(attributes = {}, events = [], tag = 'calendar-view') {
    const calendar = document.createElement(tag);
    const all = {locale: 'en-US', 'time-zone': 'UTC', 'first-day-of-week': '0', date: '2026-03-13', ...attributes};
    for (const [name, value] of Object.entries(all)) { calendar.setAttribute(name, value); }
    calendar.updateConfig({now: () => NOW, events});
    document.body.appendChild(calendar);
    return calendar;
}

function heard(calendar, name) {
    const seen = [];
    calendar.addEventListener(name, (e) => seen.push(e.detail));
    return seen;
}

const $ = (calendar, selector) => calendar.root.querySelector(selector);
const $$ = (calendar, selector) => [...calendar.root.querySelectorAll(selector)];
const key = (target, name, options = {}) => target.dispatchEvent(new KeyboardEvent('keydown', {key: name, bubbles: true, cancelable: true, ...options}));
const active = (calendar) => (calendar.shadowRoot ?? document).activeElement;
// The hidden text at the start of a cell, which starts its accessible name
const label = (cell) => cell.querySelector(':scope > .zest-cell-label').textContent;
const slotAt = (calendar, text) => $$(calendar, '[data-unit="slot"]').find(found => label(found) === text);

const standup = {id: 'standup', title: 'Standup', start: '2026-03-13T09:00:00Z', end: '2026-03-13T09:30:00Z', editable: true, seriesId: 'daily', calendarId: 'work'};
const trip = {id: 'trip', title: 'Trip', start: '2026-03-12', end: '2026-03-15', allDay: true, editable: true, color: '#7a2e8e'};

afterEach(() => { document.body.innerHTML = ''; });

describe('the visible range', () => {
    it('sends the range when it connects, in UTC instants and in dates', () => {
        const seen = [];
        document.addEventListener('calendar-range-changed', (e) => seen.push(e.detail), {once: true});
        const calendar = makeCalendar();
        expect(seen[0]).toMatchObject({
            view: 'month', start: '2026-03-01T00:00:00.000Z', end: '2026-04-05T00:00:00.000Z',
            startDate: '2026-03-01', endDate: '2026-04-05', timeZone: 'UTC', instanceId: calendar.instanceId,
        });
        expect($(calendar, '.zest-title').textContent).toBe('March 2026');
    });

    it('goes back, forward, and to today with the toolbar, and says the new range', () => {
        const calendar = makeCalendar({date: '2026-01-20'});
        const seen = heard(calendar, 'calendar-range-changed');
        expect($(calendar, '.zest-previous').getAttribute('aria-label')).toBe('Previous month');
        $(calendar, '.zest-next').click();
        expect(seen.at(-1).startDate).toBe('2026-02-01');
        expect($(calendar, '.zest-live').textContent).toBe('February 2026');
        $(calendar, '.zest-previous').click();
        $(calendar, '.zest-previous').click();
        expect(seen.at(-1).startDate).toBe('2025-11-30');
        $(calendar, '.zest-today-button').click();
        expect(calendar.date).toBe('2026-03-13');
        expect(seen).toHaveLength(4);
    });

    it('changes the view with its buttons, and the view attribute wins after that', async () => {
        const calendar = makeCalendar();
        const seen = heard(calendar, 'calendar-range-changed');
        $(calendar, '.zest-view-week').click();
        expect(seen.at(-1)).toMatchObject({view: 'week', startDate: '2026-03-08', endDate: '2026-03-15'});
        expect($(calendar, '.zest-view-week').getAttribute('aria-pressed')).toBe('true');
        expect($(calendar, '.zest-view-month').getAttribute('aria-pressed')).toBe('false');
        // Intl writes a thin space on each side of the dash
        expect($(calendar, '.zest-title').textContent).toMatch(/^Mar 8\s–\s14, 2026$/u);
        calendar.setAttribute('view', 'day');
        calendar.setAttribute('days', '3');
        await flush();
        expect(seen.at(-1)).toMatchObject({view: 'day', startDate: '2026-03-13', endDate: '2026-03-16'});
    });

    it('shows only the views in the views attribute, and no buttons for one view', () => {
        const calendar = makeCalendar({views: 'week,agenda'});
        expect($$(calendar, '.zest-views button').map(button => button.textContent)).toEqual(['Week', 'Agenda']);
        const single = makeCalendar({views: 'month'});
        expect($(single, '.zest-views')).toBeNull();
    });
});

describe('items in the month', () => {
    it('shows each item with its time, and a stripe of its color', () => {
        const calendar = makeCalendar({}, [standup, trip]);
        const item = $(calendar, '[data-key="day-2026-03-13"] .zest-item[data-id="standup"]');
        expect(item.querySelector('.zest-item-main').textContent).toBe('9:00 AM Standup, Friday, March 13, 2026, 9:00 AM – 9:30 AM');
        const span = $(calendar, '.zest-item[data-id="trip"]');
        expect(span.style.getPropertyValue('--_stripe')).toBe('#7a2e8e');
        expect(span.style.getPropertyValue('--_span')).toBe('3');
        expect(span.closest('[data-date]').dataset.date).toBe('2026-03-12');
    });

    it('shows a busy item with no details', () => {
        const calendar = makeCalendar({}, [{id: 'b', title: 'Secret', busyOnly: true, start: '2026-03-13T10:00:00Z', end: '2026-03-13T11:00:00Z', editable: true}]);
        const item = $(calendar, '.zest-item[data-id="b"]');
        expect(item.textContent).toContain('Busy');
        expect(calendar.root.textContent).not.toContain('Secret');
        expect(item.querySelector('.zest-grip')).toBeNull();
    });

    it('sends the id when the user opens an item', () => {
        const calendar = makeCalendar({}, [standup]);
        const seen = heard(calendar, 'calendar-event-select');
        $(calendar, '.zest-item[data-id="standup"] .zest-item-main').click();
        expect(seen).toEqual([{id: 'standup', seriesId: 'daily', calendarId: 'work', view: 'month', instanceId: calendar.instanceId}]);
    });

    it('counts the items of a full day, and opens the day from "+N more"', () => {
        const events = Array.from({length: 5}, (_, i) => ({id: `e${i}`, title: `E${i}`, start: `2026-03-10T0${i}:00:00Z`, end: `2026-03-10T0${i}:30:00Z`}));
        const calendar = makeCalendar({}, events);
        const day = $(calendar, '[data-key="day-2026-03-10"]');
        expect(label(day)).toBe('Tuesday, March 10, 2026, 5 events');
        const more = day.querySelector('.zest-more');
        expect(more.textContent).toBe('+2 more on Tuesday, March 10, 2026');
        const seen = heard(calendar, 'calendar-range-changed');
        more.click();
        expect(seen.at(-1)).toMatchObject({view: 'day', startDate: '2026-03-10'});
    });

    it('sends an empty day when the user selects it', () => {
        const calendar = makeCalendar();
        const seen = heard(calendar, 'calendar-slot-select');
        $(calendar, '[data-key="day-2026-03-20"]').click();
        expect(seen[0]).toMatchObject({start: '2026-03-20', end: '2026-03-21', allDay: true, view: 'month'});
    });

    it('marks today, and the days of other months', () => {
        const calendar = makeCalendar();
        expect($(calendar, '[data-key="day-2026-03-13"]').getAttribute('aria-current')).toBe('date');
        expect($(calendar, '[data-key="day-2026-04-01"]').classList).toContain('zest-other-month');
    });
});

describe('the keyboard in the month', () => {
    it('has one cell in the tab order, and moves by day, by week, and by month', () => {
        const calendar = makeCalendar();
        const cell = $(calendar, '[data-unit][tabindex="0"]');
        expect(cell.dataset.date).toBe('2026-03-13');
        expect($$(calendar, '[data-unit][tabindex="0"]')).toHaveLength(1);
        cell.focus();
        key(cell, 'ArrowRight');
        expect(active(calendar).dataset.date).toBe('2026-03-14');
        key(active(calendar), 'ArrowDown');
        expect(active(calendar).dataset.date).toBe('2026-03-21');
        key(active(calendar), 'Home');
        expect(active(calendar).dataset.date).toBe('2026-03-15');
        const seen = heard(calendar, 'calendar-range-changed');
        key(active(calendar), 'PageDown');
        expect(active(calendar).dataset.date).toBe('2026-04-15');
        expect(seen.at(-1).startDate).toBe('2026-03-29');
    });

    it('selects days with Shift and the arrow keys, and sends them with Enter', () => {
        const calendar = makeCalendar();
        const seen = heard(calendar, 'calendar-slot-select');
        const cell = $(calendar, '[data-key="day-2026-03-13"]');
        cell.focus();
        key(cell, 'ArrowRight', {shiftKey: true});
        key(active(calendar), 'ArrowRight', {shiftKey: true});
        expect($$(calendar, '[aria-selected="true"]').map(found => found.dataset.date)).toEqual(['2026-03-13', '2026-03-14', '2026-03-15']);
        key(active(calendar), 'Enter');
        expect(seen[0]).toMatchObject({start: '2026-03-13', end: '2026-03-16', allDay: true});
        expect($$(calendar, '[aria-selected="true"]')).toEqual([]);
    });

    it('gives the items of the focused day to Tab, and Escape goes back to the day', () => {
        const calendar = makeCalendar({}, [standup]);
        const item = $(calendar, '.zest-item[data-id="standup"] .zest-item-main');
        expect(item.tabIndex).toBe(0);
        key($(calendar, '[data-key="day-2026-03-13"]'), 'ArrowRight');
        expect($(calendar, '.zest-item[data-id="standup"] .zest-item-main').tabIndex).toBe(-1);
        key(active(calendar), 'ArrowLeft');
        $(calendar, '.zest-item[data-id="standup"] .zest-item-main').focus();
        key(active(calendar), 'Escape');
        expect(active(calendar).dataset.key).toBe('day-2026-03-13');
    });

    it('goes the other way with the arrow keys from right to left', () => {
        const calendar = makeCalendar();
        calendar.style.direction = 'rtl';
        const cell = $(calendar, '[data-key="day-2026-03-13"]');
        cell.focus();
        key(cell, 'ArrowRight');
        expect(active(calendar).dataset.date).toBe('2026-03-12');
    });
});

describe('the time grid', () => {
    it('shows each day with a slot for each half hour, the items by time, and the line of now', () => {
        const calendar = makeCalendar({view: 'week', 'day-start': '08:00', 'day-end': '18:00'}, [standup, trip]);
        expect($$(calendar, '.zest-column-head')).toHaveLength(7);
        expect($$(calendar, '.zest-row')).toHaveLength(20);
        const item = $(calendar, '.zest-grid-item[data-id="standup"]');
        expect(item.closest('[data-unit]').dataset.key).toBe(`slot-${Date.UTC(2026, 2, 13, 9) / 60000}`);
        expect(Number(item.style.getPropertyValue('--_top'))).toBeCloseTo(1 / 10);
        expect(Number(item.style.getPropertyValue('--_day'))).toBe(5);
        expect($(calendar, '.zest-all-day-cell .zest-item[data-id="trip"]')).not.toBeNull();
        const now = $(calendar, '.zest-now');
        expect(Number(now.style.getPropertyValue('--_top'))).toBeCloseTo(7 / 10);
    });

    it('sends a slot as UTC instants in the time zone', () => {
        const calendar = makeCalendar({view: 'day', 'time-zone': 'America/Denver', date: '2026-03-13'});
        const seen = heard(calendar, 'calendar-slot-select');
        slotAt(calendar, 'Friday, March 13, 2026, 9:00 AM').click();
        expect(seen[0]).toMatchObject({start: '2026-03-13T15:00:00.000Z', end: '2026-03-13T15:30:00.000Z', allDay: false, view: 'day'});
    });

    it('moves by slot and by day with the keyboard, selects time with Shift, and goes up to the all-day row', () => {
        const calendar = makeCalendar({view: 'day', days: '2'});
        const seen = heard(calendar, 'calendar-slot-select');
        const start = $(calendar, '[data-unit="slot"][tabindex="0"]');
        expect(label(start)).toBe('Friday, March 13, 2026, 8:00 AM');
        start.focus();
        key(start, 'ArrowDown', {shiftKey: true});
        key(active(calendar), 'ArrowDown', {shiftKey: true});
        key(active(calendar), 'Enter');
        expect(seen[0]).toMatchObject({start: '2026-03-13T08:00:00.000Z', end: '2026-03-13T09:30:00.000Z'});
        key(active(calendar), 'ArrowRight');
        expect(label(active(calendar))).toBe('Saturday, March 14, 2026, 9:00 AM');
        const range = heard(calendar, 'calendar-range-changed');
        key(active(calendar), 'ArrowRight');
        expect(range.at(-1)).toMatchObject({startDate: '2026-03-15', endDate: '2026-03-17'});
        expect(label(active(calendar))).toBe('Sunday, March 15, 2026, 9:00 AM');
        // 18 slots up to midnight, and one more to the all-day row
        for (let i = 0; i < 19; i++) { key(active(calendar), 'ArrowUp'); }
        expect(active(calendar).dataset.key).toBe('all-day-2026-03-15');
    });

    it('labels each slot for a screen reader, also the slots with no visible time', () => {
        const calendar = makeCalendar({view: 'day'});
        const halfHour = $$(calendar, '.zest-row')[1].querySelector('.zest-time-label');
        expect(halfHour.textContent).toBe('12:30 AM');
        expect(halfHour.querySelector('.zest-sr')).not.toBeNull();
    });
});

describe('moving and resizing', () => {
    it('moves an item with the keyboard, sends the move, and shows it in its new place until new data comes', async () => {
        const calendar = makeCalendar({view: 'day'}, [standup]);
        const seen = heard(calendar, 'calendar-event-move');
        $(calendar, '.zest-grip').click();
        expect($(calendar, '.zest-status').hidden).toBe(false);
        expect($(calendar, '.zest-status').textContent).toContain('Moving Standup.');
        expect(active(calendar).classList).toContain('zest-grip');
        expect(active(calendar).getAttribute('aria-pressed')).toBe('true');
        key(active(calendar), 'ArrowDown');
        key(active(calendar), 'ArrowDown');
        expect($(calendar, '.zest-live').textContent).toBe('Standup, Friday, March 13, 2026, 10:00 AM – 10:30 AM');
        key(active(calendar), 'Enter');
        expect(seen).toEqual([{
            id: 'standup', start: '2026-03-13T10:00:00.000Z', end: '2026-03-13T10:30:00.000Z', allDay: false,
            seriesId: 'daily', calendarId: 'work', view: 'day', instanceId: calendar.instanceId,
        }]);
        expect($(calendar, '.zest-status').hidden).toBe(true);
        const shown = $(calendar, '.zest-item[data-id="standup"]');
        expect(shown.classList).toContain('zest-pending');
        expect(label(shown.closest('[data-unit]'))).toBe('Friday, March 13, 2026, 10:00 AM');
        // The application could not save, so it sends the old data again
        calendar.events = [standup];
        await flush();
        expect($(calendar, '.zest-item[data-id="standup"]').classList).not.toContain('zest-pending');
        expect(label($(calendar, '.zest-item[data-id="standup"]').closest('[data-unit]'))).toBe('Friday, March 13, 2026, 9:00 AM');
    });

    it('moves an item to a slot with one click, with no drag', () => {
        const calendar = makeCalendar({view: 'day'}, [standup]);
        const seen = heard(calendar, 'calendar-event-move');
        const slots = heard(calendar, 'calendar-slot-select');
        $(calendar, '.zest-grip').click();
        slotAt(calendar, 'Friday, March 13, 2026, 2:00 PM').click();
        expect(seen[0]).toMatchObject({start: '2026-03-13T14:00:00.000Z', end: '2026-03-13T14:30:00.000Z'});
        expect(slots).toEqual([]);
    });

    it('changes the end with a second click on the handle and one click on a slot', () => {
        const calendar = makeCalendar({view: 'day'}, [standup]);
        const seen = heard(calendar, 'calendar-event-move');
        $(calendar, '.zest-grip').click();
        $(calendar, '.zest-grip').click();
        expect($(calendar, '.zest-status').textContent).toContain('Changing the end of Standup.');
        slotAt(calendar, 'Friday, March 13, 2026, 11:00 AM').click();
        expect(seen[0]).toMatchObject({start: '2026-03-13T09:00:00.000Z', end: '2026-03-13T11:30:00.000Z'});
    });

    it('keeps an item at least one slot long, and stops with a third click', () => {
        const calendar = makeCalendar({view: 'day'}, [standup]);
        $(calendar, '.zest-grip').click();
        $(calendar, '.zest-grip').click();
        key(active(calendar), 'ArrowUp');
        key(active(calendar), 'ArrowUp');
        expect($(calendar, '.zest-live').textContent).toBe('Standup, Friday, March 13, 2026, 9:00 AM – 9:30 AM');
        $(calendar, '.zest-grip').click();
        expect($(calendar, '.zest-status').hidden).toBe(true);
    });

    it('cancels with Escape and with the cancel button, and sends nothing', () => {
        const calendar = makeCalendar({view: 'day'}, [standup]);
        const seen = heard(calendar, 'calendar-event-move');
        $(calendar, '.zest-grip').click();
        key(active(calendar), 'ArrowDown');
        key(active(calendar), 'Escape');
        expect($(calendar, '.zest-status').hidden).toBe(true);
        expect($(calendar, '.zest-live').textContent).toBe('The change is cancelled.');
        $(calendar, '.zest-grip').click();
        $(calendar, '.zest-status .zest-cancel').click();
        expect(seen).toEqual([]);
        expect(label($(calendar, '.zest-item[data-id="standup"]').closest('[data-unit]'))).toBe('Friday, March 13, 2026, 9:00 AM');
    });

    it('moves an all-day item by days in the month, and sends dates', () => {
        const calendar = makeCalendar({}, [trip]);
        const seen = heard(calendar, 'calendar-event-move');
        $(calendar, '.zest-item[data-id="trip"] .zest-grip').click();
        key(active(calendar), 'ArrowRight');
        key(active(calendar), 'ArrowDown');
        key(active(calendar), 'Enter');
        expect(seen[0]).toMatchObject({id: 'trip', start: '2026-03-20', end: '2026-03-23', allDay: true});
    });

    it('moves a timed item to another day in the month, and keeps its time', () => {
        const calendar = makeCalendar({}, [standup]);
        const seen = heard(calendar, 'calendar-event-move');
        $(calendar, '.zest-item[data-id="standup"] .zest-grip').click();
        $(calendar, '[data-key="day-2026-03-17"]').click();
        expect(seen[0]).toMatchObject({start: '2026-03-17T09:00:00.000Z', end: '2026-03-17T09:30:00.000Z', allDay: false});
    });

    it('sends nothing when the item ends where it started', () => {
        const calendar = makeCalendar({view: 'day'}, [standup]);
        const seen = heard(calendar, 'calendar-event-move');
        $(calendar, '.zest-grip').click();
        key(active(calendar), 'ArrowDown');
        key(active(calendar), 'ArrowUp');
        key(active(calendar), 'Enter');
        expect(seen).toEqual([]);
    });

    it('lets nobody select or move in a read-only calendar, but the user can still open an item', () => {
        const calendar = makeCalendar({readonly: ''}, [standup]);
        const slots = heard(calendar, 'calendar-slot-select');
        const opened = heard(calendar, 'calendar-event-select');
        expect($(calendar, '.zest-grip')).toBeNull();
        expect($(calendar, '[role="grid"]').getAttribute('aria-readonly')).toBe('true');
        $(calendar, '[data-key="day-2026-03-20"]').click();
        key($(calendar, '[data-key="day-2026-03-13"]'), 'Enter');
        $(calendar, '.zest-item-main').click();
        expect(slots).toEqual([]);
        expect(opened).toHaveLength(1);
    });
});

describe('the agenda', () => {
    it('lists the days that have items, and says when there are none', async () => {
        const calendar = makeCalendar({view: 'agenda'}, [standup, trip]);
        expect($$(calendar, '.zest-agenda-date').map(found => found.textContent)).toEqual([
            'Friday, March 13, 2026', 'Saturday, March 14, 2026',
        ]);
        expect($$(calendar, '.zest-agenda-day')[0].querySelectorAll('.zest-item')[0].dataset.id).toBe('trip');
        expect($(calendar, '.zest-agenda .zest-grip')).toBeNull();
        calendar.events = [];
        await flush();
        expect($(calendar, '.zest-empty').textContent).toBe('No events');
    });
});

describe('the data interface', () => {
    it('takes items from a property and sends events to a plain listener, as a framework does', async () => {
        const calendar = document.createElement('calendar-view');
        calendar.setAttribute('time-zone', 'UTC');
        calendar.setAttribute('date', '2026-03-13');
        calendar.events = [standup];
        const ranges = [];
        calendar.addEventListener('calendar-range-changed', (e) => ranges.push(e.detail));
        document.body.appendChild(calendar);
        expect(ranges).toHaveLength(1);
        expect($(calendar, '.zest-item[data-id="standup"]')).not.toBeNull();
        calendar.events = [];
        await flush();
        expect($(calendar, '.zest-item')).toBeNull();
    });

    it('takes its config from a registry', () => {
        window.calendarRegistry = {calendar: () => ({calendarConfig: {events: [standup], now: () => NOW, labels: {today: 'Now'}}})};
        const calendar = document.createElement('calendar-view');
        calendar.setAttribute('registry-name', 'calendarRegistry');
        calendar.setAttribute('data-register-func-name', 'calendar');
        calendar.setAttribute('time-zone', 'UTC');
        document.body.appendChild(calendar);
        expect($(calendar, '.zest-today-button').textContent).toBe('Now');
        expect($(calendar, '.zest-item[data-id="standup"]')).not.toBeNull();
        delete window.calendarRegistry;
    });

    it('takes other words for each label, and plural forms', () => {
        const calendar = makeCalendar({}, [standup], 'calendar-view');
        calendar.updateConfig({labels: {events: {one: 'un événement', other: '{count} événements'}}});
        return flush().then(() => {
            expect(label($(calendar, '[data-key="day-2026-03-13"]'))).toBe('Friday, March 13, 2026, un événement');
        });
    });

    it('moves the line of now each minute, and does not render or move the focus for it', async () => {
        vi.useFakeTimers();
        try {
            let now = NOW;
            const calendar = makeCalendar({view: 'day'});
            calendar.updateConfig({now: () => now});
            vi.runOnlyPendingTimers();
            const cell = $(calendar, '[data-unit][tabindex="0"]');
            cell.focus();
            const render = vi.spyOn(calendar, 'render');
            now = new Date('2026-03-13T15:30:00Z');
            vi.advanceTimersByTime(60000);
            expect(Number($(calendar, '.zest-now').style.getPropertyValue('--_top'))).toBeCloseTo(15.5 / 24);
            expect(render).not.toHaveBeenCalled();
            expect(active(calendar)).toBe(cell);
            now = new Date('2026-03-14T01:00:00Z');
            vi.advanceTimersByTime(60000);
            await flush();
            expect(render).toHaveBeenCalled();
            expect($(calendar, '.zest-now')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('stops its timer when it leaves the page', () => {
        const stopped = vi.spyOn(globalThis, 'clearInterval');
        const calendar = makeCalendar();
        calendar.remove();
        expect(stopped).toHaveBeenCalledOnce();
        stopped.mockRestore();
    });

    it('works the same in a shadow root, and its events reach the document', () => {
        const seen = [];
        document.addEventListener('calendar-slot-select', (e) => seen.push(e.detail), {once: true});
        const calendar = makeCalendar({}, [], 'shadow-calendar-view');
        expect(calendar.shadowRoot.querySelector('.zest-calendar')).not.toBeNull();
        calendar.shadowRoot.querySelector('[data-key="day-2026-03-20"]').click();
        expect(seen[0]).toMatchObject({start: '2026-03-20', allDay: true});
    });
});

describe('the tags of an item', () => {
    const declined = {id: 'retro', title: 'Retro', start: '2026-03-13T11:00:00Z', end: '2026-03-13T12:00:00Z', tags: ['Declined', 'bad tag', 'needs-action']};
    const party = {id: 'party', title: 'Party', start: '2026-03-13', allDay: true, tags: ['cancelled']};
    const state = (element) => element.querySelector('.zest-item-main > .zest-item-state')?.textContent ?? null;

    it('gives each tag a class, a part, and hidden text before the title, in each view', async () => {
        const calendar = makeCalendar({}, [declined, party, standup]);
        const check = () => {
            const retro = $(calendar, '.zest-item[data-id="retro"]');
            expect(retro.classList.contains('zest-tag-declined')).toBe(true);
            expect(retro.classList.contains('zest-tag-needs-action')).toBe(true);
            expect(retro.getAttribute('part')).toBe('item item-declined item-needs-action');
            // A tag with no text gives no hidden text
            expect(state(retro)).toBe('Declined, ');
            expect(retro.querySelector('.zest-item-main').firstElementChild.classList.contains('zest-item-state')).toBe(true);
            const all = $(calendar, '.zest-item[data-id="party"]');
            expect(all.getAttribute('part')).toBe('item item-cancelled');
            expect(state(all)).toBe('Cancelled, ');
            const plain = $(calendar, '.zest-item[data-id="standup"]');
            expect(plain.getAttribute('part')).toBe('item');
            expect(state(plain)).toBeNull();
        };
        check();
        expect($(calendar, '.zest-item[data-id="retro"]').classList.contains('zest-lane-item')).toBe(true);
        for (const view of ['week', 'agenda']) {
            calendar.view = view;
            await flush();
            check();
        }
        // In the week, the timed item is in the grid and the all-day item is in the all-day row
        calendar.view = 'week';
        await flush();
        expect($(calendar, '.zest-item[data-id="retro"]').classList.contains('zest-grid-item')).toBe(true);
        expect($(calendar, '.zest-all-day-cell .zest-item[data-id="party"]')).not.toBeNull();
    });

    it('takes the text of a tag from labels, and an empty text removes it', async () => {
        const calendar = makeCalendar({}, [declined, party]);
        calendar.updateConfig({labels: {tags: {declined: 'Abgelehnt', 'needs-action': 'Needs an answer', cancelled: ''}}});
        await flush();
        expect(state($(calendar, '.zest-item[data-id="retro"]'))).toBe('Abgelehnt, Needs an answer, ');
        expect(state($(calendar, '.zest-item[data-id="party"]'))).toBeNull();
        // The other default texts stay
        calendar.events = [{...declined, id: 'maybe', tags: ['tentative']}];
        await flush();
        expect(state($(calendar, '.zest-item[data-id="maybe"]'))).toBe('Tentative, ');
    });

    it('gives the parts in a shadow root', () => {
        const calendar = makeCalendar({}, [declined], 'shadow-calendar-view');
        expect(calendar.shadowRoot.querySelector('[part~="item-declined"]').dataset.id).toBe('retro');
    });
});

describe('a set of the same view or date', () => {
    it('does not render or send an event, and the focus stays', async () => {
        const calendar = makeCalendar({}, [standup]);
        await flush();
        const seen = heard(calendar, 'calendar-range-changed');
        const day = $(calendar, '[data-key="day-2026-03-13"]');
        day.focus();
        key(day, 'ArrowRight');
        const focused = active(calendar);
        expect(focused.dataset.key).toBe('day-2026-03-14');
        const render = vi.spyOn(calendar, 'render');
        calendar.view = 'month';
        calendar.date = '2026-03-13';
        calendar.date = calendar.range.date;
        calendar.goTo('2026-03-13');
        await flush();
        expect(render).not.toHaveBeenCalled();
        expect(active(calendar)).toBe(focused);
        expect(focused.tabIndex).toBe(0);
        expect(seen).toHaveLength(0);
    });

    it('does nothing when the application copies the range event back', async () => {
        const calendar = makeCalendar({}, [standup]);
        await flush();
        calendar.addEventListener('calendar-range-changed', (e) => {
            calendar.view = e.detail.view;
            calendar.date = e.detail.date;
        });
        const seen = heard(calendar, 'calendar-range-changed');
        const day = $(calendar, '[data-key="day-2026-03-31"]');
        day.focus();
        key(day, 'PageDown');
        expect(seen.at(-1)).toMatchObject({view: 'month', date: '2026-04-30', startDate: '2026-03-29'});
        const render = vi.spyOn(calendar, 'render');
        await flush();
        expect(render).not.toHaveBeenCalled();
        expect(active(calendar).dataset.key).toBe('day-2026-04-30');
        expect(seen).toHaveLength(1);
    });

    it('does nothing for an attribute that gives the view and the date that show', async () => {
        const calendar = makeCalendar({}, [standup]);
        await flush();
        $(calendar, '.zest-next').click();
        $(calendar, '.zest-view-week').click();
        const render = vi.spyOn(calendar, 'render');
        calendar.setAttribute('view', 'week');
        calendar.setAttribute('date', calendar.date);
        await flush();
        expect(render).not.toHaveBeenCalled();
        // The attribute is the source now, so a later attribute change still wins
        calendar.setAttribute('view', 'day');
        await flush();
        expect(calendar.view).toBe('day');
        expect(render).toHaveBeenCalledTimes(1);
    });

    it('renders for a new view, a new date, and new items of the same content', async () => {
        const calendar = makeCalendar({}, [standup]);
        await flush();
        const render = vi.spyOn(calendar, 'render');
        calendar.date = '2026-03-14';
        await flush();
        expect(render).toHaveBeenCalledTimes(1);
        calendar.view = 'week';
        await flush();
        expect(render).toHaveBeenCalledTimes(2);
        // Items are not compared: the same items in a new array render again
        calendar.events = [{...standup}];
        await flush();
        expect(render).toHaveBeenCalledTimes(3);
        // A view that is not known goes back to the attribute, here the month
        calendar.view = 'year';
        await flush();
        expect(calendar.view).toBe('month');
        expect(render).toHaveBeenCalledTimes(4);
    });
});
