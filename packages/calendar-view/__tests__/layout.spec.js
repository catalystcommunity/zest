import { describe, it, expect } from 'vitest';
import * as layout from '../src/layout.js';

const d = (year, month, day) => ({year, month, day});
const at = (year, month, day, hour = 0, minute = 0) => layout.minuteOf({year, month, day, hour, minute});
const item = (id, start, end, extra = {}) => ({id, start, end, allDay: false, ...extra});
const UTC = 'UTC';

describe('the visible range', () => {
    it('covers each week of the month, from the first day of the week', () => {
        // March 2026 starts on a Sunday and ends on a Tuesday
        expect(layout.viewRange('month', d(2026, 3, 13), {firstDay: 0})).toEqual({start: d(2026, 3, 1), end: d(2026, 4, 5)});
        expect(layout.viewRange('month', d(2026, 3, 13), {firstDay: 1})).toEqual({start: d(2026, 2, 23), end: d(2026, 4, 6)});
    });

    it('gives a week, a number of days, and an agenda', () => {
        expect(layout.viewRange('week', d(2026, 3, 13), {firstDay: 1})).toEqual({start: d(2026, 3, 9), end: d(2026, 3, 16)});
        expect(layout.viewRange('day', d(2026, 3, 13))).toEqual({start: d(2026, 3, 13), end: d(2026, 3, 14)});
        expect(layout.viewRange('day', d(2026, 3, 13), {days: 3})).toEqual({start: d(2026, 3, 13), end: d(2026, 3, 16)});
        expect(layout.viewRange('agenda', d(2026, 3, 13))).toEqual({start: d(2026, 3, 13), end: d(2026, 3, 20)});
    });

    it('steps by the size of the view', () => {
        expect(layout.stepAnchor('month', d(2026, 1, 31), 1)).toEqual(d(2026, 2, 1));
        expect(layout.stepAnchor('week', d(2026, 3, 13), -1)).toEqual(d(2026, 3, 6));
        expect(layout.stepAnchor('day', d(2026, 3, 13), 1, {days: 3})).toEqual(d(2026, 3, 16));
        expect(layout.stepAnchor('agenda', d(2026, 3, 13), 1)).toEqual(d(2026, 3, 20));
    });

    it('reads a clock time, and falls back on text that it cannot read', () => {
        expect(layout.readClock('08:30', 0)).toBe(510);
        expect(layout.readClock('8', 0)).toBe(480);
        expect(layout.readClock('24:00', 0)).toBe(1440);
        expect(layout.readClock('25:00', 60)).toBe(60);
        expect(layout.readClock('soon', 60)).toBe(60);
        expect(layout.readClock(null, 60)).toBe(60);
    });
});

describe('items', () => {
    it('reads instants in the time zone, and dates for all day with an end after the last day', () => {
        const [allDay, timed] = layout.normalizeEvents([
            {id: 'b', start: '2026-03-13T17:00:00Z', end: '2026-03-13T18:30:00Z', title: 'Talk'},
            {id: 'a', start: '2026-03-13', end: '2026-03-15', allDay: true, title: 'Trip'},
        ], 'America/Denver');
        expect(allDay.id).toBe('a');
        expect(allDay.end - allDay.start).toBe(2 * 1440);
        expect(timed.start).toBe(at(2026, 3, 13, 11));
        expect(timed.end).toBe(at(2026, 3, 13, 12, 30));
    });

    it('takes a Date, gives an all-day item one day with no end, and leaves out what it cannot read', () => {
        const items = layout.normalizeEvents([
            {id: 1, start: new Date(Date.UTC(2026, 2, 13, 9)), title: 'Number id'},
            {id: 'one-day', start: '2026-03-13', allDay: true},
            {id: 'bad', start: 'not a date'},
            {start: '2026-03-13T09:00:00Z'},
            null,
        ], UTC);
        expect(items.map(found => found.id)).toEqual(['one-day', '1']);
        expect(items[0].end - items[0].start).toBe(1440);
        expect(items[1].end).toBe(items[1].start);
    });

    it('hides the details of a busy item, and does not let anyone move it', () => {
        const [busy] = layout.normalizeEvents([{id: 'x', start: '2026-03-13T09:00:00Z', title: 'Secret', busyOnly: true, editable: true}], UTC);
        expect(busy.title).toBeNull();
        expect(busy.editable).toBe(false);
    });

    it('keeps the tags of letters, digits, and "-", in lower case, one time each', () => {
        expect(layout.readTags(['Declined', 'needs-action', 'x_y', 'two words', '', 7, null, 'declined', 'a1'])).toEqual(['declined', 'needs-action', 'a1']);
        expect(layout.readTags('declined')).toEqual([]);
        expect(layout.readTags(undefined)).toEqual([]);
        const [tagged, plain] = layout.normalizeEvents([
            {id: 'a', start: '2026-03-13T09:00:00Z', tags: ['Tentative']},
            {id: 'b', start: '2026-03-13T10:00:00Z'},
        ], UTC);
        expect(tagged.tags).toEqual(['tentative']);
        expect(plain.tags).toEqual([]);
    });

    it('does not put an item that ends at midnight on the next day', () => {
        expect(layout.coveredDays(item('x', at(2026, 3, 13, 22), at(2026, 3, 14)))).toEqual([layout.minuteOf(d(2026, 3, 13)) / 1440, layout.minuteOf(d(2026, 3, 13)) / 1440]);
        expect(layout.spansDays(item('x', at(2026, 3, 13, 22), at(2026, 3, 14, 1)))).toBe(true);
    });
});

describe('the month view', () => {
    const range = {start: d(2026, 3, 1), end: d(2026, 3, 15)};

    it('gives a span the same lane on each of its days, and cuts it at the end of the week', () => {
        const items = layout.normalizeEvents([
            {id: 'trip', start: '2026-03-06', end: '2026-03-10', allDay: true},
            {id: 'call', start: '2026-03-06T09:00:00Z', end: '2026-03-06T10:00:00Z'},
        ], UTC);
        const [first, second] = layout.monthLayout(items, range);
        const trip = first.segments.find(segment => segment.item.id === 'trip');
        expect(trip).toMatchObject({startCol: 5, span: 2, lane: 0, continuesBefore: false, continuesAfter: true});
        expect(first.segments.find(segment => segment.item.id === 'call')).toMatchObject({startCol: 5, span: 1, lane: 1});
        expect(second.segments[0]).toMatchObject({startCol: 0, span: 2, lane: 0, continuesBefore: true, continuesAfter: false});
    });

    it('counts the hidden items of each day for "+N more"', () => {
        const items = layout.normalizeEvents(Array.from({length: 5}, (_, i) => (
            {id: `e${i}`, start: `2026-03-03T0${i}:00:00Z`, end: `2026-03-03T0${i}:30:00Z`})), UTC);
        const [week] = layout.monthLayout(items, range, 3);
        expect(week.segments).toHaveLength(3);
        expect(week.hidden).toEqual([0, 0, 2, 0, 0, 0, 0]);
        expect(week.lanes).toBe(3);
    });

    it('puts the long items first, so that a span does not break around short items', () => {
        const items = layout.normalizeEvents([
            {id: 'short', start: '2026-03-03T09:00:00Z', end: '2026-03-03T10:00:00Z'},
            {id: 'long', start: '2026-03-02', end: '2026-03-05', allDay: true},
        ], UTC);
        expect(items[0].id).toBe('long');
        const [week] = layout.monthLayout(items, range);
        expect(week.segments.find(segment => segment.item.id === 'long').lane).toBe(0);
    });
});

describe('the time grid', () => {
    const days = [d(2026, 3, 13), d(2026, 3, 14)];

    it('puts items that overlap side by side, and lets a later item use a free column', () => {
        const items = [
            item('a', at(2026, 3, 13, 9), at(2026, 3, 13, 11)),
            item('b', at(2026, 3, 13, 10), at(2026, 3, 13, 12)),
            item('c', at(2026, 3, 13, 11), at(2026, 3, 13, 12)),
            item('alone', at(2026, 3, 13, 14), at(2026, 3, 13, 15)),
        ];
        const {columns} = layout.timeGridLayout(items, days);
        const byId = Object.fromEntries(columns[0].segments.map(segment => [segment.item.id, segment]));
        expect(byId.a).toMatchObject({column: 0, columns: 2});
        expect(byId.b).toMatchObject({column: 1, columns: 2});
        expect(byId.c).toMatchObject({column: 0, columns: 2});
        expect(byId.alone).toMatchObject({column: 0, columns: 1});
        expect(byId.a.top).toBeCloseTo(9 / 24);
        expect(byId.a.height).toBeCloseTo(2 / 24);
    });

    it('splits a timed item that crosses midnight into each day', () => {
        const {columns, allDay} = layout.timeGridLayout([item('late', at(2026, 3, 13, 22), at(2026, 3, 14, 2))], days);
        expect(allDay).toEqual([]);
        expect(columns[0].segments[0]).toMatchObject({continuesBefore: false, continuesAfter: true});
        expect(columns[1].segments[0]).toMatchObject({continuesBefore: true, continuesAfter: false, top: 0});
        expect(columns[1].segments[0].height).toBeCloseTo(2 / 24);
    });

    it('puts an all-day item in the top row, and an item outside the hours at the nearest edge', () => {
        const items = [
            {...item('holiday', at(2026, 3, 13), at(2026, 3, 15)), allDay: true},
            item('early', at(2026, 3, 13, 6), at(2026, 3, 13, 7)),
            item('late', at(2026, 3, 13, 20), at(2026, 3, 13, 21)),
            item('point', at(2026, 3, 13, 12), at(2026, 3, 13, 12)),
        ];
        const grid = layout.timeGridLayout(items, days, {dayStart: 8 * 60, dayEnd: 18 * 60});
        expect(grid.allDay[0]).toMatchObject({startCol: 0, span: 2});
        expect(grid.lanes).toBe(1);
        const byId = Object.fromEntries(grid.columns[0].segments.map(segment => [segment.item.id, segment]));
        expect(byId.early).toMatchObject({top: 0, continuesBefore: true});
        expect(byId.late.top + byId.late.height).toBeCloseTo(1);
        expect(byId.late.continuesAfter).toBe(true);
        expect(byId.point.height).toBeCloseTo(15 / 600);
    });
});

describe('the agenda', () => {
    it('lists each day that has items, with all-day items first, and a long item on each of its days', () => {
        const items = layout.normalizeEvents([
            {id: 'call', start: '2026-03-13T09:00:00Z', end: '2026-03-13T10:00:00Z'},
            {id: 'trip', start: '2026-03-13', end: '2026-03-15', allDay: true},
            {id: 'later', start: '2026-03-20T09:00:00Z'},
        ], UTC);
        const agenda = layout.agendaLayout(items, {start: d(2026, 3, 12), end: d(2026, 3, 19)});
        expect(agenda.map(entry => entry.day)).toEqual([d(2026, 3, 13), d(2026, 3, 14)]);
        expect(agenda[0].items.map(found => found.id)).toEqual(['trip', 'call']);
    });
});

describe('moves and details', () => {
    it('keeps the length on a move, and at least one step on a resize', () => {
        const found = item('x', 600, 660);
        expect(layout.moved(found, 900)).toEqual({start: 900, end: 960});
        expect(layout.resized(found, 590, 30)).toEqual({start: 600, end: 630});
    });

    it('gives dates for all day, and UTC instants in the time zone for a time', () => {
        expect(layout.toDetail(at(2026, 3, 13), at(2026, 3, 15), true, UTC)).toEqual({start: '2026-03-13', end: '2026-03-15', allDay: true});
        expect(layout.toDetail(at(2026, 3, 13, 9), at(2026, 3, 13, 10), false, 'America/Denver'))
            .toEqual({start: '2026-03-13T15:00:00.000Z', end: '2026-03-13T16:00:00.000Z', allDay: false});
    });
});
