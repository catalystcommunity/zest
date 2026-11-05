// The layout of the calendar, with no DOM: the visible range of each view, the items in the time
// zone, the spans of the month view, the columns of items that overlap, and the agenda.
//
// Times here are wall clock minutes: the day number times 1440, plus the minutes of the day. The
// grid shows the wall clock, so an item keeps its place on a day when the clocks change.
import * as model from '@catalystcommunity/date-model';

export const VIEWS = ['month', 'week', 'day', 'agenda'];
const DAY = 1440;

export function minuteOf(parts) {
    return model.dayNumber(parts) * DAY + (parts.hour ?? 0) * 60 + (parts.minute ?? 0);
}

export function partsOf(minute) {
    const day = Math.floor(minute / DAY);
    const rest = minute - day * DAY;
    return {...model.fromDayNumber(day), hour: Math.floor(rest / 60), minute: rest % 60, second: 0};
}

export function dayOf(minute) {
    return model.fromDayNumber(Math.floor(minute / DAY));
}

// "08:30" or "8" to minutes of the day. Returns the fallback when the text cannot be read.
export function readClock(text, fallback) {
    if (text === null || text === undefined || text === '') { return fallback; }
    const found = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(text).trim());
    if (!found) { return fallback; }
    const minutes = Number(found[1]) * 60 + Number(found[2] ?? 0);
    return minutes >= 0 && minutes <= DAY ? minutes : fallback;
}

// The first day and the day after the last day. The end is not in the range.
export function viewRange(view, anchor, {firstDay = 0, days} = {}) {
    const date = {year: anchor.year, month: anchor.month, day: anchor.day};
    switch (view) {
        case 'month': {
            const start = model.startOfWeek({...date, day: 1}, firstDay);
            const last = {...date, day: model.daysInMonth(date.year, date.month)};
            return {start, end: model.addDays(model.startOfWeek(last, firstDay), 7)};
        }
        case 'week': {
            const start = model.startOfWeek(date, firstDay);
            return {start, end: model.addDays(start, 7)};
        }
        case 'agenda': return {start: date, end: model.addDays(date, days || 7)};
        default: return {start: date, end: model.addDays(date, days || 1)};
    }
}

// The anchor date after one step back (-1) or forward (1)
export function stepAnchor(view, anchor, direction, {days} = {}) {
    switch (view) {
        case 'month': return model.addMonths({...anchor, day: 1}, direction);
        case 'week': return model.addDays(anchor, 7 * direction);
        case 'agenda': return model.addDays(anchor, (days || 7) * direction);
        default: return model.addDays(anchor, (days || 1) * direction);
    }
}

export function rangeDays(range) {
    return Array.from({length: model.daysBetween(range.start, range.end)}, (_, i) => model.addDays(range.start, i));
}

function readInstant(value) {
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

// The items in wall clock minutes of the time zone, sorted. An all-day item takes dates, and its
// end is the day after its last day, as in iCalendar. An item that cannot be read is left out.
export function normalizeEvents(events = [], timeZone) {
    const items = [];
    for (const event of events ?? []) {
        if (!event || event.id === undefined || event.id === null) { continue; }
        let start;
        let end;
        if (event.allDay) {
            const first = model.parseValue(String(event.start ?? ''), 'date');
            if (!first) { continue; }
            const last = event.end ? model.parseValue(String(event.end), 'date') : null;
            start = model.dayNumber(first) * DAY;
            end = last ? model.dayNumber(last) * DAY : start + DAY;
            if (end <= start) { end = start + DAY; }
        } else {
            const from = readInstant(event.start);
            if (!from) { continue; }
            const to = event.end ? readInstant(event.end) : null;
            start = minuteOf(model.fromInstant(from, timeZone));
            end = to ? minuteOf(model.fromInstant(to, timeZone)) : start;
            if (end < start) { end = start; }
        }
        items.push({
            id: String(event.id),
            event,
            title: event.busyOnly ? null : (event.title ?? null),
            allDay: Boolean(event.allDay),
            busyOnly: Boolean(event.busyOnly),
            editable: Boolean(event.editable) && !event.busyOnly,
            color: event.color ?? null,
            start,
            end,
        });
    }
    return items.sort(compareItems);
}

// All-day and longer items first, then by start, then the longer one, then by id, so that the
// layout is the same each time
function compareItems(a, b) {
    return Number(spansDays(b)) - Number(spansDays(a))
        || a.start - b.start
        || (b.end - b.start) - (a.end - a.start)
        || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// The first and last day number that an item covers. An end at midnight is not on the next day.
export function coveredDays(item) {
    const first = Math.floor(item.start / DAY);
    const last = item.end > item.start ? Math.floor((item.end - 1) / DAY) : first;
    return [first, last];
}

export function spansDays(item) {
    const [first, last] = coveredDays(item);
    return item.allDay || last > first;
}

// Gives each item a lane, the lowest that is free on each of its days. columns is the number of
// days in a row, and firstDay the day number of the first column.
function laneRow(items, firstDay, columns) {
    const lanes = [];
    const segments = [];
    for (const item of items) {
        const [first, last] = coveredDays(item);
        if (last < firstDay || first >= firstDay + columns) { continue; }
        const startCol = Math.max(first, firstDay) - firstDay;
        const endCol = Math.min(last, firstDay + columns - 1) - firstDay;
        let lane = lanes.findIndex(used => used.slice(startCol, endCol + 1).every(free => free));
        if (lane === -1) {
            lane = lanes.length;
            lanes.push(Array(columns).fill(true));
        }
        lanes[lane].fill(false, startCol, endCol + 1);
        segments.push({
            item, lane, startCol, span: endCol - startCol + 1,
            continuesBefore: first < firstDay, continuesAfter: last > firstDay + columns - 1,
        });
    }
    return segments;
}

// The month view, one row for each week. Lanes from maxLanes up are hidden, and hidden counts
// them for each day, for the "+N more" control.
export function monthLayout(items, range, maxLanes = 3) {
    const weeks = [];
    for (let start = range.start; model.compare(start, range.end, 'date') < 0; start = model.addDays(start, 7)) {
        const firstDay = model.dayNumber(start);
        const segments = laneRow(items, firstDay, 7);
        const hidden = Array(7).fill(0);
        for (const segment of segments) {
            if (segment.lane < maxLanes) { continue; }
            for (let col = segment.startCol; col < segment.startCol + segment.span; col++) { hidden[col]++; }
        }
        weeks.push({
            days: Array.from({length: 7}, (_, i) => model.addDays(start, i)),
            segments: segments.filter(segment => segment.lane < maxLanes),
            hidden,
            lanes: Math.min(maxLanes, Math.max(0, ...segments.map(segment => segment.lane + 1))),
        });
    }
    return weeks;
}

// Puts items that overlap side by side. Each item gets a column and the number of columns of
// its group. A group holds the items that overlap, also through other items.
function overlapColumns(segments) {
    const sorted = [...segments].sort((a, b) => a.from - b.from || (b.to - b.from) - (a.to - a.from));
    let group = [];
    let columnEnds = [];
    let groupEnd = -Infinity;
    const finish = () => {
        for (const segment of group) { segment.columns = columnEnds.length; }
        group = [];
        columnEnds = [];
    };
    for (const segment of sorted) {
        if (segment.from >= groupEnd) {
            finish();
            groupEnd = -Infinity;
        }
        let column = columnEnds.findIndex(end => end <= segment.from);
        if (column === -1) {
            column = columnEnds.length;
            columnEnds.push(segment.to);
        } else {
            columnEnds[column] = segment.to;
        }
        segment.column = column;
        group.push(segment);
        groupEnd = Math.max(groupEnd, segment.to);
    }
    finish();
    return sorted;
}

// The week and day views. dayStart and dayEnd are the visible minutes of each day. An item gets
// at least minMinutes of height, and an item outside the visible hours shows at the nearest edge.
// top and height are fractions of the visible day.
export function timeGridLayout(items, days, {dayStart = 0, dayEnd = DAY, minMinutes = 15} = {}) {
    const firstDay = model.dayNumber(days[0]);
    const allDay = laneRow(items.filter(spansAllDayRow), firstDay, days.length);
    const visible = Math.max(1, dayEnd - dayStart);
    const columns = days.map(day => {
        const base = model.dayNumber(day) * DAY;
        const low = base + dayStart;
        const high = base + dayEnd;
        const segments = [];
        for (const item of items) {
            if (spansAllDayRow(item)) { continue; }
            const inDay = item.end > item.start
                ? item.start < base + DAY && item.end > base
                : item.start >= base && item.start < base + DAY;
            if (!inDay) { continue; }
            let from = Math.max(item.start, low);
            let to = Math.min(Math.max(item.end, item.start + minMinutes), high);
            if (to - from < minMinutes) {
                // Outside the visible hours, or too short: it shows at its edge with the minimum height
                if (from >= high - minMinutes) { from = Math.max(low, high - minMinutes); to = high; }
                else { to = Math.min(high, from + minMinutes); }
            }
            segments.push({
                item, from, to,
                continuesBefore: item.start < low,
                continuesAfter: item.end > high,
            });
        }
        return {
            day,
            segments: overlapColumns(segments).map(segment => ({
                ...segment,
                top: (segment.from - low) / visible,
                height: (segment.to - segment.from) / visible,
            })),
        };
    });
    return {allDay, columns, lanes: Math.max(0, ...allDay.map(segment => segment.lane + 1))};
}

// An all-day item goes in the row at the top. A timed item that crosses midnight shows in each
// day column that it covers.
function spansAllDayRow(item) {
    return item.allDay;
}

// The days of the range that have items, each with its items in order
export function agendaLayout(items, range) {
    const found = [];
    for (const day of rangeDays(range)) {
        const number = model.dayNumber(day);
        const onDay = items.filter(item => {
            const [first, last] = coveredDays(item);
            return first <= number && last >= number;
        }).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start || compareItems(a, b));
        if (onDay.length) { found.push({day, items: onDay}); }
    }
    return found;
}

// The start and end of an item after a move of its start to a new minute, with the same length
export function moved(item, start) {
    return {start, end: start + (item.end - item.start)};
}

// The start and end of an item after its end moves. It stays at least one step long.
export function resized(item, end, step) {
    return {start: item.start, end: Math.max(end, item.start + step)};
}

// The detail of an event for a start and an end in wall clock minutes: dates for all day, and
// UTC instants for a time
export function toDetail(start, end, allDay, timeZone) {
    if (allDay) {
        return {start: model.formatDate(dayOf(start)), end: model.formatDate(dayOf(end)), allDay: true};
    }
    return {
        start: model.toInstant(partsOf(start), timeZone).toISOString(),
        end: model.toInstant(partsOf(end), timeZone).toISOString(),
        allDay: false,
    };
}
