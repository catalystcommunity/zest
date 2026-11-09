// Type declarations for @catalystcommunity/calendar-view. The source is JavaScript; keep this file
// in step with src/index.js. __tests__/types.spec.js checks that each export has a declaration.
import { DataComponent } from '@catalystcommunity/base-components';

export type CalendarViewName = 'month' | 'week' | 'day' | 'agenda';

/** One item that the application gives. */
export interface CalendarItem {
    /** Unique in the array. The events give it back as text. */
    id: string | number;
    title?: string | null;
    /** An instant (ISO 8601 text or a Date). For an all-day item, a date `YYYY-MM-DD`. */
    start: string | Date;
    /** For an all-day item, the day after the last day. With no end, a timed item has no length and an all-day item is one day. */
    end?: string | Date | null;
    allDay?: boolean;
    /** Any CSS color, for the stripe of the item. */
    color?: string | null;
    /** The state of the item, for example `declined`. Each tag of letters, digits, and `-` gives a class `zest-tag-<tag>` and a part `item-<tag>`. */
    tags?: string[];
    /** Shows "Busy", with no title. The user cannot move it. */
    busyOnly?: boolean;
    /** The user can move and resize it. */
    editable?: boolean;
    /** Comes back in the events. */
    seriesId?: string | null;
    /** Comes back in the events. */
    calendarId?: string | null;
}

export interface CalendarLabels {
    previousMonth: string; nextMonth: string; previousWeek: string; nextWeek: string;
    previousDays: string; nextDays: string; today: string; views: string;
    month: string; week: string; day: string; agenda: string;
    time: string; allDay: string; busy: string; untitled: string; noEvents: string;
    /** `{count}` is the count. */
    more: string;
    /** `{date}` is the date. */
    moreOn: string;
    /** By plural category. `{count}` is the count. */
    events: Partial<Record<Intl.LDMLPluralRule, string>>;
    continues: string;
    /** `{title}` is the title. */
    grip: string;
    cancel: string;
    moving: string;
    resizing: string;
    cancelled: string;
    /** The hidden text of each tag. This adds to the defaults. An empty text removes the text of a tag. */
    tags: Record<string, string>;
}

/**
 * The options of `updateConfig` and of a registry `calendarConfig`. An attribute wins over the same
 * option here. Text options take the same text as their attributes.
 */
export interface CalendarConfig {
    events?: CalendarItem[];
    labels?: Partial<CalendarLabels>;
    /** Gives the time now, for tests and demonstrations. */
    now?: () => Date;
    view?: CalendarViewName;
    /** `YYYY-MM-DD`. */
    date?: string;
    locale?: string;
    timeZone?: string;
    firstDayOfWeek?: number | string;
    /** `HH:MM`. */
    dayStart?: string;
    dayEnd?: string;
    slotMinutes?: number | string;
    days?: number | string;
    readonly?: boolean | string;
    /** `month,week,day,agenda`, the view buttons in the toolbar. */
    views?: string;
    maxItems?: number | string;
    scrollTime?: string;
    twentyFourHourFormat?: boolean | string;
}

/** The detail of `calendar-range-changed`, and the value of `range`. */
export interface CalendarRangeChangedDetail {
    view: CalendarViewName;
    /** The anchor date, `YYYY-MM-DD`, the same as the `date` property. */
    date: string;
    /** UTC instants, ISO 8601. */
    start: string;
    end: string;
    /** `YYYY-MM-DD`. In the month, `startDate` can be in the month before. */
    startDate: string;
    /** The day after the last day. */
    endDate: string;
    timeZone: string | null;
    instanceId: string;
}
export type CalendarRange = Omit<CalendarRangeChangedDetail, 'instanceId'>;

export interface CalendarEventSelectDetail {
    id: string;
    seriesId: string | null;
    calendarId: string | null;
    view: CalendarViewName;
    instanceId: string;
}
/** Dates `YYYY-MM-DD` for all day, UTC instants for a time. `end` is not in the selection. */
export interface CalendarSlotSelectDetail {
    start: string;
    end: string;
    allDay: boolean;
    view: CalendarViewName;
    instanceId: string;
}
export interface CalendarEventMoveDetail {
    id: string;
    /** Dates `YYYY-MM-DD` for all day, UTC instants for a time. */
    start: string;
    end: string;
    allDay: boolean;
    seriesId: string | null;
    calendarId: string | null;
    view: CalendarViewName;
    instanceId: string;
}

export default class CalendarView extends DataComponent {
    readonly locale: string;
    readonly timeZone: string | undefined;
    /** A set of the view that shows does nothing. An invalid view goes back to the attribute. */
    get view(): CalendarViewName;
    set view(view: CalendarViewName | null | undefined);
    /** The anchor date, `YYYY-MM-DD`. A set of the date that shows, in any text, does nothing. */
    get date(): string;
    set date(text: string);
    /** The items. A set replaces each move that waited for new data. */
    get events(): CalendarItem[];
    set events(events: CalendarItem[] | null | undefined);
    readonly readOnly: boolean;
    /** The same object as the detail of `calendar-range-changed`, with no `instanceId`. */
    readonly range: CalendarRange;

    /** Merges options and draws again. */
    updateConfig(partial?: CalendarConfig): void;
    previous(): void;
    next(): void;
    today(): void;
    /** The same as a set of `date`. */
    goTo(date: string): void;
}

export declare class ShadowCalendarView extends CalendarView {
    shadow: ShadowRoot;
}

export { CalendarView };

declare global {
    interface HTMLElementEventMap {
        'calendar-range-changed': CustomEvent<CalendarRangeChangedDetail>;
        'calendar-event-select': CustomEvent<CalendarEventSelectDetail>;
        'calendar-slot-select': CustomEvent<CalendarSlotSelectDetail>;
        'calendar-event-move': CustomEvent<CalendarEventMoveDetail>;
    }
    interface HTMLElementTagNameMap {
        'calendar-view': CalendarView;
        'shadow-calendar-view': ShadowCalendarView;
    }
}
