import { describe, it, expect } from 'vitest';
import * as model from '../src/model.js';

const d = (year, month, day) => ({year, month, day});
const dt = (year, month, day, hour = 0, minute = 0, second = 0) => ({year, month, day, hour, minute, second});
const t = (hour, minute = 0, second = 0) => ({hour, minute, second});
const rules = (options = {}, kind = 'date') => model.buildRules(options, kind);

// Counts each formatter that is made while `work` runs
function formattersMadeBy(work) {
    const names = ['DateTimeFormat', 'NumberFormat', 'RelativeTimeFormat'];
    const originals = names.map(name => Intl[name]);
    let made = 0;
    names.forEach((name, index) => {
        Intl[name] = new Proxy(originals[index], {
            construct(target, args) { made += 1; return new target(...args); },
        });
    });
    try {
        work();
    } finally {
        names.forEach((name, index) => { Intl[name] = originals[index]; });
    }
    return made;
}

describe('formatters', () => {
    const useThemAll = (locale) => {
        model.monthNames(locale);
        model.weekdayNames(locale);
        model.formatNumber(5, locale, 2);
        model.formatDisplay(d(2024, 3, 15), 'date', {locale});
        model.dayPeriods(locale);
        model.parseText('tomorrow', 'date', {locale, reference: d(2024, 3, 15)});
    };

    it('makes each one time, because a page can hold many pickers', () => {
        expect(formattersMadeBy(() => useThemAll('pt-PT'))).toBeGreaterThan(0);
        expect(formattersMadeBy(() => useThemAll('pt-PT'))).toBe(0);
    });

    it('does not share one between locales or options', () => {
        expect(model.monthNames('fr', 'long')[2]).toBe('mars');
        expect(model.monthNames('de', 'long')[2]).toBe('März');
        expect(model.monthNames('de', 'short')[2]).not.toBe('März');
        expect(model.formatDisplay(d(2024, 3, 15), 'date', {locale: 'en-US', format: 'short'}))
            .not.toBe(model.formatDisplay(d(2024, 3, 15), 'date', {locale: 'en-US', format: 'long'}));
    });

    it('does not keep a formatter for a time zone that does not exist', () => {
        expect(() => model.fromInstant(new Date(0), 'Not/AZone')).toThrow();
        expect(() => model.fromInstant(new Date(0), 'Not/AZone')).toThrow();
    });
});

describe('calendar math', () => {
    it('knows leap years', () => {
        expect(model.daysInMonth(2024, 2)).toBe(29);
        expect(model.daysInMonth(2023, 2)).toBe(28);
        expect(model.daysInMonth(1900, 2)).toBe(28);
        expect(model.daysInMonth(2000, 2)).toBe(29);
        expect(model.daysInMonth(2024, 12)).toBe(31);
    });

    it('adds days over a month and a year boundary', () => {
        expect(model.addDays(d(2024, 12, 31), 1)).toEqual(d(2025, 1, 1));
        expect(model.addDays(d(2024, 3, 1), -1)).toEqual(d(2024, 2, 29));
    });

    it('keeps the time when it adds days', () => {
        expect(model.addDays(dt(2024, 3, 9, 2, 30), 1)).toEqual(dt(2024, 3, 10, 2, 30));
    });

    it('keeps the day in the month when it adds months', () => {
        expect(model.addMonths(d(2024, 1, 31), 1)).toEqual(d(2024, 2, 29));
        expect(model.addMonths(d(2024, 12, 15), 1)).toEqual(d(2025, 1, 15));
        expect(model.addMonths(d(2024, 1, 15), -1)).toEqual(d(2023, 12, 15));
        expect(model.addMonths(d(2024, 3, 31), -13)).toEqual(d(2023, 2, 28));
    });

    it('handles the years before 100', () => {
        expect(model.weekday(d(1, 1, 1))).toBe(1);
        expect(model.formatDate(d(99, 3, 5))).toBe('0099-03-05');
        expect(model.daysInMonth(4, 2)).toBe(29);
    });
});

describe('ISO weeks', () => {
    it.each([
        [d(2024, 1, 1), 2024, 1],
        [d(2021, 1, 3), 2020, 53],
        [d(2020, 12, 31), 2020, 53],
        [d(2018, 12, 31), 2019, 1],
        [d(2026, 1, 4), 2026, 1],
    ])('%o is in %i week %i', (parts, year, week) => {
        expect(model.isoWeek(parts)).toEqual({year, week});
    });

    it('stores a week as its Monday', () => {
        expect(model.truncate(d(2024, 3, 17), 'week')).toEqual(d(2024, 3, 11));
        expect(model.fromIsoWeek(2024, 11)).toEqual(d(2024, 3, 11));
    });

    it('reads a week only if the year has it', () => {
        expect(model.parseValue('2020-W53', 'week')).toEqual(d(2020, 12, 28));
        expect(model.parseValue('2021-W53', 'week')).toBeNull();
        expect(model.parseValue('2021-W00', 'week')).toBeNull();
    });
});

describe('strict values', () => {
    it.each([
        ['2024-03-15', 'date', d(2024, 3, 15)],
        ['13:45', 'time', t(13, 45)],
        ['13:45:10', 'time', t(13, 45, 10)],
        ['2024-03-15T13:45', 'datetime', dt(2024, 3, 15, 13, 45)],
        ['2024-03-15 13:45:10', 'datetime', dt(2024, 3, 15, 13, 45, 10)],
        ['2024-03', 'month', {year: 2024, month: 3}],
        ['2024', 'year', {year: 2024}],
        ['2024-03-15T13:45', 'date', d(2024, 3, 15)],
        ['2024-03-15T13:45', 'time', t(13, 45)],
        ['2024-03-15', 'datetime', dt(2024, 3, 15)],
    ])('reads %s as a %s', (text, kind, expected) => {
        expect(model.parseValue(text, kind)).toEqual(expected);
    });

    it.each([
        ['2024-02-30', 'date'], ['2023-02-29', 'date'], ['2024-13-01', 'date'], ['2024-00-10', 'date'],
        ['0000-01-01', 'date'], ['24:00', 'time'], ['12:60', 'time'], ['12:00:60', 'time'],
        ['2024-02-30T10:00', 'datetime'], ['hello', 'date'], ['', 'date'], ['13:45', 'date'], ['2024-03-15', 'time'],
    ])('refuses %s as a %s', (text, kind) => {
        expect(model.parseValue(text, kind)).toBeNull();
    });

    it('refuses what is not a string', () => {
        expect(model.parseValue(null, 'date')).toBeNull();
        expect(model.parseValue(20240315, 'date')).toBeNull();
    });

    it('reads a date as the end of the day for a maximum', () => {
        expect(model.parseValue('2024-03-15', 'datetime', {endOfDay: true})).toEqual(dt(2024, 3, 15, 23, 59, 59));
    });

    it('moves a time with an offset into the time zone', () => {
        expect(model.parseValue('2024-03-15T12:00:00Z', 'datetime', {timeZone: 'America/New_York'})).toEqual(dt(2024, 3, 15, 8));
        expect(model.parseValue('2024-03-15T23:00:00-05:00', 'date', {timeZone: 'Asia/Tokyo'})).toEqual(d(2024, 3, 16));
    });

    it.each([
        [d(2024, 3, 5), 'date', '2024-03-05'],
        [t(9, 5), 'time', '09:05'],
        [t(9, 5, 7), 'time', '09:05:07'],
        [dt(2024, 3, 5, 9, 5), 'datetime', '2024-03-05T09:05'],
        [{year: 2024, month: 3}, 'month', '2024-03'],
        [{year: 2024}, 'year', '2024'],
        [d(2024, 3, 11), 'week', '2024-W11'],
    ])('writes %o as a %s', (parts, kind, expected) => {
        expect(model.formatValue(parts, kind)).toBe(expected);
        expect(model.parseValue(expected, kind)).toEqual(model.truncate(parts, kind));
    });

    it('writes the seconds when it is told to', () => {
        expect(model.formatValue(t(9, 5), 'time', true)).toBe('09:05:00');
    });
});

describe('selections', () => {
    it('reads an empty string as nothing, and a bad part as null', () => {
        expect(model.parseSelection('', 'date')).toEqual([]);
        expect(model.parseSelection(null, 'date')).toEqual([]);
        expect(model.parseSelection('bad', 'date')).toBeNull();
        expect(model.parseSelection('2024-01-01,bad', 'date', 'multiple')).toBeNull();
    });

    it('reads a range as an interval, and puts it in sequence', () => {
        expect(model.parseSelection('2024-03-20/2024-03-10', 'date', 'range')).toEqual([d(2024, 3, 10), d(2024, 3, 20)]);
        expect(model.parseSelection('2024-03-10', 'date', 'range')).toBeNull();
    });

    it('writes a range and multiple values', () => {
        expect(model.formatSelection([d(2024, 3, 10), d(2024, 3, 20)], 'date', 'range')).toBe('2024-03-10/2024-03-20');
        expect(model.formatSelection([d(2024, 3, 10), d(2024, 3, 20)], 'date', 'multiple')).toBe('2024-03-10,2024-03-20');
    });
});

describe('time zones', () => {
    it('finds the instant of a wall clock', () => {
        expect(model.toInstant(dt(2024, 7, 1, 12), 'America/New_York').toISOString()).toBe('2024-07-01T16:00:00.000Z');
        expect(model.toInstant(dt(2024, 1, 1, 12), 'America/New_York').toISOString()).toBe('2024-01-01T17:00:00.000Z');
        expect(model.toInstant(dt(2024, 1, 1, 12), 'Asia/Kolkata').toISOString()).toBe('2024-01-01T06:30:00.000Z');
    });

    it('moves forward in a gap, when the clocks skip the time', () => {
        expect(model.toInstant(dt(2024, 3, 10, 2, 30), 'America/New_York').toISOString()).toBe('2024-03-10T07:30:00.000Z');
    });

    it('takes the first time in an overlap, when the time occurs twice', () => {
        expect(model.toInstant(dt(2024, 11, 3, 1, 30), 'America/New_York').toISOString()).toBe('2024-11-03T05:30:00.000Z');
    });

    it('gets the wall clock back from the instant', () => {
        const instant = new Date('2024-07-01T16:00:00Z');
        expect(model.fromInstant(instant, 'America/New_York')).toEqual(dt(2024, 7, 1, 12));
        expect(model.fromInstant(instant, 'Asia/Tokyo')).toEqual(dt(2024, 7, 2, 1));
    });

    it('uses the local zone with no zone name', () => {
        const instant = model.toInstant(dt(2024, 7, 1, 12));
        expect(instant.getHours()).toBe(12);
        expect(model.fromInstant(instant)).toEqual(dt(2024, 7, 1, 12));
    });
});

describe('locale defaults', () => {
    it('finds the first day of the week', () => {
        expect(model.firstDayOfWeek('en-US')).toBe(0);
        expect(model.firstDayOfWeek('en-GB')).toBe(1);
        expect(model.firstDayOfWeek('de-DE')).toBe(1);
        expect(model.firstDayOfWeek('ar-EG')).toBe(6);
    });

    it('finds the hour format', () => {
        expect(model.usesTwentyFourHours('en-US')).toBe(false);
        expect(model.usesTwentyFourHours('de-DE')).toBe(true);
    });

    it('names the months and the days', () => {
        expect(model.monthNames('en-US')[2]).toBe('March');
        expect(model.monthNames('de-DE')[2]).toBe('März');
        expect(model.weekdayNames('en-US')[0]).toBe('Sun');
    });

    it('stays Gregorian in a locale with another default calendar', () => {
        expect(model.formatDisplay(d(2024, 3, 15), 'date', {locale: 'th-TH', format: 'medium'})).toContain('2024');
    });
});

describe('display', () => {
    it('writes the date and the time for a locale', () => {
        expect(model.formatDisplay(d(2024, 3, 15), 'date', {locale: 'en-US'})).toBe('Mar 15, 2024');
        expect(model.formatDisplay(d(2024, 3, 15), 'date', {locale: 'en-US', format: 'iso'})).toBe('2024-03-15');
        expect(model.formatDisplay({year: 2024, month: 3}, 'month', {locale: 'en-US'})).toBe('March 2024');
        expect(model.formatDisplay(d(2024, 3, 11), 'week', {locale: 'en-US'})).toBe('2024-W11');
        expect(model.formatDisplay(t(15, 5), 'time', {locale: 'de-DE'})).toBe('15:05');
    });

    it('obeys the hour format, and has no zone name in the long formats', () => {
        expect(model.formatDisplay(t(15, 5), 'time', {locale: 'en-GB', twentyFourHours: false}).toLowerCase()).toContain('pm');
        expect(model.formatDisplay(t(15, 5), 'time', {locale: 'en-US', twentyFourHours: true})).toBe('15:05');
        expect(model.formatDisplay(dt(2024, 3, 15, 15, 5), 'datetime', {locale: 'en-US', format: 'full'})).not.toMatch(/UTC|Coordinated/);
    });

    it('does not move the day for the time zone of the browser', () => {
        for (const kind of ['date', 'datetime']) {
            expect(model.formatDisplay(dt(2024, 3, 15, 0, 0), kind, {locale: 'en-US'})).toContain('15');
            expect(model.formatDisplay(dt(2024, 3, 15, 23, 59), kind, {locale: 'en-US'})).toContain('15');
        }
    });
});

describe('typed text', () => {
    const reference = dt(2024, 6, 15, 10, 30);
    const read = (text, kind, locale = 'en-US') => model.parseText(text, kind, {locale, reference});

    it.each([
        ['2024-03-15', 'en-US', d(2024, 3, 15)],
        ['3/15/2024', 'en-US', d(2024, 3, 15)],
        ['15/3/2024', 'en-GB', d(2024, 3, 15)],
        ['15.3.2024', 'de-DE', d(2024, 3, 15)],
        ['2024/3/15', 'ja-JP', d(2024, 3, 15)],
        ['3/15/24', 'en-US', d(2024, 3, 15)],
        ['3/15', 'en-US', d(2024, 3, 15)],
        ['15/3', 'en-GB', d(2024, 3, 15)],
        ['March 15, 2024', 'en-US', d(2024, 3, 15)],
        ['Mar 15', 'en-US', d(2024, 3, 15)],
        ['15 mar 2024', 'en-GB', d(2024, 3, 15)],
        ['15 March 2024', 'de-DE', d(2024, 3, 15)],
        ['15. März 2024', 'de-DE', d(2024, 3, 15)],
        ['Fri Mar 15 2024', 'en-US', d(2024, 3, 15)],
        ['today', 'en-US', d(2024, 6, 15)],
        ['Tomorrow', 'en-US', d(2024, 6, 16)],
        ['yesterday', 'en-US', d(2024, 6, 14)],
        ['morgen', 'de-DE', d(2024, 6, 16)],
    ])('reads the date %s in %s', (text, locale, expected) => {
        expect(read(text, 'date', locale)).toEqual(expected);
    });

    it.each([['nonsense'], ['2/30/2024'], ['13/13/2024'], ['99'], ['hello 12'], ['1/2/3/4']])('refuses the date %s', (text) => {
        expect(read(text, 'date')).toBeNull();
    });

    it.each([
        ['13:45', t(13, 45)], ['1:45 pm', t(13, 45)], ['1:45pm', t(13, 45)], ['12:00 am', t(0)], ['12:00 pm', t(12)],
        ['3pm', t(15)], ['3 PM', t(15)], ['11a', t(11)], ['9', t(9)], ['1530', t(15, 30)], ['13:45:10', t(13, 45, 10)],
        ['now', t(10, 30)],
    ])('reads the time %s', (text, expected) => {
        expect(read(text, 'time')).toEqual(expected);
    });

    it.each([['25:00'], ['13:00 pm'], ['12:61'], ['hello'], ['0pm']])('refuses the time %s', (text) => {
        expect(read(text, 'time')).toBeNull();
    });

    it('reads a date and a time together, and a date alone', () => {
        expect(read('3/15/2024 3:30 PM', 'datetime')).toEqual(dt(2024, 3, 15, 15, 30));
        expect(read('Mar 15, 2024, 3:30 PM', 'datetime')).toEqual(dt(2024, 3, 15, 15, 30));
        expect(read('15.03.24, 10:30', 'datetime', 'de-DE')).toEqual(dt(2024, 3, 15, 10, 30));
        expect(read('3/15/2024', 'datetime')).toEqual(dt(2024, 3, 15));
    });

    it('reads months, years, and weeks', () => {
        expect(read('March 2024', 'month')).toEqual({year: 2024, month: 3});
        expect(read('3/2024', 'month')).toEqual({year: 2024, month: 3});
        expect(read('2024/3', 'month')).toEqual({year: 2024, month: 3});
        expect(read('2024', 'year')).toEqual({year: 2024});
        expect(read('W11 2024', 'week')).toEqual(d(2024, 3, 11));
        expect(read('2024W11', 'week')).toEqual(d(2024, 3, 11));
        expect(read('3/15/2024', 'week')).toEqual(d(2024, 3, 11));
    });

    // What the picker writes in the input, it must read back
    describe.each(['en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'ja-JP', 'ko-KR', 'zh-CN', 'pt-BR', 'ar-EG', 'ru-RU', 'da-DK', 'fi-FI', 'hi-IN', 'he-IL', 'tr-TR'])('round trip in %s', (locale) => {
        const dates = [d(2024, 3, 5), d(2024, 12, 25), d(2031, 1, 31)];
        it.each(['short', 'medium', 'long', 'full'])('dates in the %s format', (format) => {
            for (const date of dates) {
                const shown = model.formatDisplay(date, 'date', {locale, format});
                expect(model.parseText(shown, 'date', {locale, reference}), shown).toEqual(date);
            }
        });

        it.each([false, true])('times, with twenty four hours %s', (twentyFourHours) => {
            for (const time of [t(0, 5), t(9, 30), t(12), t(15, 45), t(23, 59)]) {
                const shown = model.formatDisplay(time, 'time', {locale, twentyFourHours});
                expect(model.parseText(shown, 'time', {locale, reference}), shown).toEqual(time);
            }
        });

        it('date and time together', () => {
            const value = dt(2024, 3, 5, 15, 45);
            for (const format of ['short', 'medium', 'long', 'full']) {
                const shown = model.formatDisplay(value, 'datetime', {locale, format});
                expect(model.parseText(shown, 'datetime', {locale, reference}), shown).toEqual(value);
            }
        });

        it('months', () => {
            const shown = model.formatDisplay({year: 2024, month: 3}, 'month', {locale});
            expect(model.parseText(shown, 'month', {locale, reference}), shown).toEqual({year: 2024, month: 3});
        });
    });
});

describe('rules', () => {
    it('applies the minimum and the maximum to a day', () => {
        const r = rules({min: '2024-03-10', max: '2024-03-20'});
        expect(model.dayIsDisabled(d(2024, 3, 9), r)).toBe(true);
        expect(model.dayIsDisabled(d(2024, 3, 10), r)).toBe(false);
        expect(model.dayIsDisabled(d(2024, 3, 20), r)).toBe(false);
        expect(model.dayIsDisabled(d(2024, 3, 21), r)).toBe(true);
    });

    it('applies disabled dates, ranges of dates, weekdays, and functions', () => {
        const r = rules({
            disabledDates: '2024-03-10,2024-03-20/2024-03-22', disabledWeekdays: '0,6',
            isDateDisabled: (iso) => iso === '2024-03-12',
            getDayInfo: (iso) => (iso === '2024-03-13' ? {disabled: true} : null),
        });
        expect(model.dayIsDisabled(d(2024, 3, 10), r)).toBe(true);
        expect(model.dayIsDisabled(d(2024, 3, 21), r)).toBe(true);
        expect(model.dayIsDisabled(d(2024, 3, 23), r)).toBe(true);
        expect(model.dayIsDisabled(d(2024, 3, 12), r)).toBe(true);
        expect(model.dayIsDisabled(d(2024, 3, 13), r)).toBe(true);
        expect(model.dayIsDisabled(d(2024, 3, 14), r)).toBe(false);
    });

    it('accepts arrays from data as well as attribute strings', () => {
        const r = rules({disabledDates: ['2024-03-10'], disabledWeekdays: [1]});
        expect(model.dayIsDisabled(d(2024, 3, 10), r)).toBe(true);
        expect(model.dayIsDisabled(d(2024, 3, 11), r)).toBe(true);
    });

    it('applies a datetime minimum on its own day only', () => {
        const r = rules({min: '2024-03-10T09:30'}, 'datetime');
        expect(model.timeIsDisabled(t(9), d(2024, 3, 10), r)).toBe(true);
        expect(model.timeIsDisabled(t(9, 30), d(2024, 3, 10), r)).toBe(false);
        expect(model.timeIsDisabled(t(9), d(2024, 3, 11), r)).toBe(false);
    });

    it('applies a daily window, which can go through midnight', () => {
        const day = rules({minTime: '09:00', maxTime: '17:00'}, 'datetime');
        expect(model.timeIsDisabled(t(8), d(2024, 3, 10), day)).toBe(true);
        expect(model.timeIsDisabled(t(12), d(2024, 3, 10), day)).toBe(false);
        const night = rules({min: '22:00', max: '06:00'}, 'time');
        expect(model.timeIsDisabled(t(23), null, night)).toBe(false);
        expect(model.timeIsDisabled(t(3), null, night)).toBe(false);
        expect(model.timeIsDisabled(t(12), null, night)).toBe(true);
    });

    it('gives the reason that a value is not allowed', () => {
        const r = rules({min: '2024-03-10', max: '2024-03-20', disabledDates: '2024-03-15'});
        expect(model.valueProblem(d(2024, 3, 9), r)).toBe('before-min');
        expect(model.valueProblem(d(2024, 3, 21), r)).toBe('after-max');
        expect(model.valueProblem(d(2024, 3, 15), r)).toBe('disabled-date');
        expect(model.valueProblem(d(2024, 3, 16), r)).toBeNull();
        const step = rules({minuteStep: 15}, 'time');
        expect(model.valueProblem(t(9, 15), step)).toBeNull();
        expect(model.valueProblem(t(9, 10), step)).toBe('step');
    });

    it('gives the reason that two values are not a range', () => {
        const r = rules({minRangeDays: 2, maxRangeDays: 5, disabledDates: '2024-03-10'});
        expect(model.rangeProblem(d(2024, 3, 1), d(2024, 3, 1), r)).toBe('range-too-short');
        expect(model.rangeProblem(d(2024, 3, 1), d(2024, 3, 2), r)).toBeNull();
        expect(model.rangeProblem(d(2024, 3, 1), d(2024, 3, 6), r)).toBe('range-too-long');
        expect(model.rangeProblem(d(2024, 3, 9), d(2024, 3, 11), r)).toBe('disabled-in-range');
        expect(model.rangeProblem(d(2024, 3, 9), d(2024, 3, 11), rules({disabledDates: '2024-03-10', allowDisabledInRange: true}))).toBeNull();
    });
});
