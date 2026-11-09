// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { CalendarView, type CalendarItem } from '@catalystcommunity/calendar-view';

customElements.define('calendar-view', CalendarView);

const calendar = document.createElement('calendar-view');
calendar.setAttribute('time-zone', 'America/Denver');
calendar.view = 'week';
calendar.date = '2026-03-13';
const items: CalendarItem[] = [
    {id: 'a1', title: 'Standup', start: '2026-03-13T16:00:00Z', end: '2026-03-13T16:30:00Z', tags: ['tentative'], editable: true},
    {id: 'a2', title: 'Holiday', start: '2026-03-14', allDay: true},
];
calendar.events = items;
calendar.updateConfig({labels: {tags: {'needs-action': 'Needs an answer'}}, now: () => new Date()});
calendar.addEventListener('calendar-range-changed', (event) => {
    const {view, date, start, end} = event.detail;
    // Copying the range back does nothing when it is the same
    calendar.view = view;
    calendar.date = date;
    void [start, end];
});
calendar.addEventListener('calendar-event-move', (event) => {
    void [event.detail.id, event.detail.start, event.detail.allDay, event.detail.seriesId];
});
calendar.addEventListener('calendar-slot-select', (event) => { void event.detail.end; });
document.body.append(calendar);
calendar.next();
const startDate: string = calendar.range.startDate;
void startDate;
