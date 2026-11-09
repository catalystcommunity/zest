import { describe, it, expect, vi, afterEach } from 'vitest';
import {DateTimePicker, ShadowDateTimePicker} from '../src';

customElements.define('date-time-picker', DateTimePicker);
customElements.define('shadow-date-time-picker', ShadowDateTimePicker);

describe('DateTimePicker', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    function makePicker(attributes = {}, tag = 'date-time-picker') {
        const comp = document.createElement(tag);
        for (const [name, value] of Object.entries(attributes)) {
            comp.setAttribute(name, value);
        }
        document.body.appendChild(comp);
        return comp;
    }

    // The day buttons of the shown month, by the number on the button
    function dayButton(comp, day) {
        return comp.picker.querySelector(`.zest-day:not(.zest-other-month)[data-day="${day}"]`);
    }

    it('makes no new formatter for another picker in the same locale', () => {
        makePicker({locale: 'nl-NL', mode: 'datetime', 'initial-date': '2024-03-15'});
        const names = ['DateTimeFormat', 'NumberFormat', 'RelativeTimeFormat'];
        const spies = names.map(name => vi.spyOn(Intl, name));
        try {
            makePicker({locale: 'nl-NL', mode: 'datetime', 'initial-date': '2024-03-15'});
            spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
        } finally {
            spies.forEach(spy => spy.mockRestore());
        }
    });

    describe('initial date', () => {
        it('reads a date with no time as a local date, so that it does not move a day', () => {
            const comp = makePicker({'initial-date': '2024-03-15'});
            expect(comp.selectedDate.getFullYear()).toEqual(2024);
            expect(comp.selectedDate.getMonth()).toEqual(2);
            expect(comp.selectedDate.getDate()).toEqual(15);
        });

        it('falls back to today and warns for a date that it cannot read', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const comp = makePicker({'initial-date': 'not a date'});
            expect(Number.isNaN(comp.selectedDate.getTime())).toEqual(false);
            expect(comp.input.placeholder).toEqual(new Intl.DateTimeFormat('en-US', {dateStyle: 'medium'}).format(new Date()));
            expect(warn).toHaveBeenCalledOnce();
            warn.mockRestore();
        });

        it('refuses a day that the month does not have', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const comp = makePicker({'initial-date': '2024-02-31'});
            expect(comp.selectedDate.getMonth()).toEqual(new Date().getMonth());
            warn.mockRestore();
        });
    });

    describe('styles', () => {
        it('falls back to a style element with real CSS in a layer when it cannot adopt a sheet', () => {
            const comp = makePicker();
            const style = comp.querySelector('style');
            expect(style.textContent).toMatch(/@layer zest/);
            expect(style.textContent).toMatch(/date-time-picker/);
            expect(style.textContent).not.toMatch(/object/);
        });

        it('has no old token names and gives each color a system color at the end', () => {
            const css = customElements.get('date-time-picker').styles;
            expect(css).not.toMatch(/--zest-dtp|--dtp-/);
            expect(css).toMatch(/--zest-color-highlight, Highlight\)/);
        });
    });

    describe('calendar grid', () => {
        function weeks(comp) {
            return [...comp.picker.querySelectorAll('.zest-week')].map(week =>
                [...week.querySelectorAll('.zest-day')].map(day => Number(day.dataset.day)));
        }

        it('has seven days in each week', () => {
            const comp = makePicker({'initial-date': '2024-03-15'});
            for (const week of weeks(comp)) {
                expect(week.length).toEqual(7);
            }
        });

        it('starts on the Sunday on or before the first of the month', () => {
            const comp = makePicker({'initial-date': '2024-03-15'});
            expect(weeks(comp)[0]).toEqual([25, 26, 27, 28, 29, 1, 2]);
        });

        it('shows no week that is all in the next month', () => {
            // August 2024 ends on a Saturday, and the old loop added a full week of September
            const comp = makePicker({'initial-date': '2024-08-15'});
            expect(weeks(comp).at(-1)).toEqual([25, 26, 27, 28, 29, 30, 31]);
        });

        it('shows no week from the month before when the first is a Sunday', () => {
            const comp = makePicker({'initial-date': '2024-09-15'});
            expect(weeks(comp)[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
        });

        it('shows a February that fills exactly four weeks', () => {
            const comp = makePicker({'initial-date': '2015-02-10'});
            expect(weeks(comp).length).toEqual(4);
        });

        it('marks the selected day', () => {
            const comp = makePicker({'initial-date': '2024-03-15'});
            comp.picker.style.display = 'flex';
            dayButton(comp, 20).click();
            comp.input.click();
            expect(comp.picker.querySelector('.zest-selected').dataset.day).toEqual('20');
        });
    });

    describe('selection', () => {
        it('shows the picked date, closes, logs nothing, and sends an event', () => {
            const log = vi.spyOn(console, 'log');
            const heard = vi.fn();
            const comp = makePicker({'initial-date': '2024-03-15'});
            comp.addEventListener('date-changed', heard);
            comp.input.click();
            dayButton(comp, 20).click();
            expect(comp.selectedDate.toDateString()).toEqual(new Date(2024, 2, 20).toDateString());
            expect(comp.userSelected).toEqual(true);
            expect(comp.input.value).toEqual('Mar 20, 2024');
            expect(comp.picker.style.display).toEqual('none');
            expect(heard).toHaveBeenCalledOnce();
            expect(heard.mock.calls[0][0].detail.date.getDate()).toEqual(20);
            expect(heard.mock.calls[0][0].bubbles).toEqual(true);
            expect(heard.mock.calls[0][0].composed).toEqual(true);
            expect(log).not.toHaveBeenCalled();
            log.mockRestore();
        });

        it('moves to the other month when the user picks a day from it', () => {
            const comp = makePicker({'initial-date': '2024-03-15'});
            comp.picker.querySelector('.zest-day.zest-other-month[data-day="25"]').click();
            expect(comp.selectedDate.getMonth()).toEqual(1);
            expect(comp.picker.querySelector('.zest-month-name').textContent).toEqual('February 2024');
        });
    });

    describe('month navigation', () => {
        it('moves to the next and previous month, over a year boundary', () => {
            const comp = makePicker({'initial-date': '2024-12-15'});
            expect(comp.picker.querySelector('.zest-month-name').textContent).toEqual('December 2024');
            comp.picker.querySelector('.zest-next-month').click();
            expect(comp.picker.querySelector('.zest-month-name').textContent).toEqual('January 2025');
            comp.picker.querySelector('.zest-prev-month').click();
            comp.picker.querySelector('.zest-prev-month').click();
            expect(comp.picker.querySelector('.zest-month-name').textContent).toEqual('November 2024');
        });

        it('does not skip a short month from the 31st', () => {
            const comp = makePicker({'initial-date': '2024-01-31'});
            comp.picker.querySelector('.zest-next-month').click();
            expect(comp.picker.querySelector('.zest-month-name').textContent).toEqual('February 2024');
        });

        it('stays open and does not change the selection', () => {
            const comp = makePicker({'initial-date': '2024-03-15'});
            comp.input.click();
            comp.picker.querySelector('.zest-next-month').click();
            expect(comp.picker.style.display).not.toEqual('none');
            expect(comp.selectedDate.getMonth()).toEqual(2);
        });
    });

    describe('open and close', () => {
        it('starts closed, and opens on a click', () => {
            const comp = makePicker();
            expect(comp.picker.style.display).toEqual('none');
            comp.input.click();
            expect(comp.picker.style.display).toEqual('flex');
            expect(comp.input.getAttribute('aria-expanded')).toEqual('true');
        });

        it('closes on the Escape key', () => {
            const comp = makePicker();
            comp.input.click();
            comp.input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
            expect(comp.picker.style.display).toEqual('none');
        });

        it('closes on a click outside, and stays open on a click inside', () => {
            const comp = makePicker();
            const outside = document.createElement('button');
            document.body.appendChild(outside);
            comp.input.click();
            comp.picker.querySelector('.zest-month-name').click();
            expect(comp.picker.style.display).toEqual('flex');
            outside.click();
            expect(comp.picker.style.display).toEqual('none');
        });

        it('opens and closes the same way in a shadow root', () => {
            const comp = makePicker({}, 'shadow-date-time-picker');
            expect(comp.shadowRoot.querySelector('input')).toBe(comp.input);
            comp.input.click();
            comp.picker.querySelector('.zest-month-name').click();
            expect(comp.picker.style.display).toEqual('flex');
            document.body.click();
            expect(comp.picker.style.display).toEqual('none');
        });

        it('does not add its listeners again when it reconnects', () => {
            const heard = vi.fn();
            const comp = makePicker({'initial-date': '2024-03-15'});
            comp.addEventListener('date-changed', heard);
            comp.remove();
            document.body.appendChild(comp);
            comp.input.value = '2024-04-01';
            comp.input.dispatchEvent(new Event('change'));
            expect(heard).toHaveBeenCalledOnce();
        });

        it('stops listening to the document when it is removed', () => {
            const added = vi.spyOn(document, 'addEventListener');
            const removed = vi.spyOn(document, 'removeEventListener');
            const comp = makePicker();
            const [, handler] = added.mock.calls.find(([name]) => name === 'click');
            comp.remove();
            expect(removed).toHaveBeenCalledWith('click', handler, undefined);
            added.mockRestore();
            removed.mockRestore();
        });
    });

    describe('typed input', () => {
        it('selects a date that the user types, and shows its month', () => {
            const heard = vi.fn();
            const comp = makePicker({'initial-date': '2024-03-15'});
            comp.addEventListener('date-changed', heard);
            comp.input.value = '2024-07-04';
            comp.input.dispatchEvent(new Event('change'));
            expect(comp.selectedDate.getMonth()).toEqual(6);
            expect(comp.selectedDate.getDate()).toEqual(4);
            expect(comp.picker.querySelector('.zest-month-name').textContent).toEqual('July 2024');
            expect(heard).toHaveBeenCalledOnce();
        });

        it('puts back the old value when the user types something that it cannot read', () => {
            const comp = makePicker({'initial-date': '2024-03-15'});
            comp.input.click();
            dayButton(comp, 20).click();
            comp.input.value = 'nonsense';
            comp.input.dispatchEvent(new Event('change'));
            expect(comp.selectedDate.getDate()).toEqual(20);
            expect(comp.input.value).toEqual('Mar 20, 2024');
        });

        it('clears the selection when the user empties the input', () => {
            const heard = vi.fn();
            const comp = makePicker({'initial-date': '2024-03-15'});
            comp.input.click();
            dayButton(comp, 20).click();
            comp.addEventListener('date-changed', heard);
            comp.input.value = '';
            comp.input.dispatchEvent(new Event('change'));
            expect(comp.userSelected).toEqual(false);
            expect(comp.input.value).toEqual('');
            expect(heard.mock.calls[0][0].detail.date).toBeNull();
        });
    });

    describe('the value', () => {
        it('reads the value attribute, in the mode that it has when it connects', () => {
            const comp = document.createElement('date-time-picker');
            comp.setAttribute('value', '09:30');
            comp.setAttribute('mode', 'time');
            document.body.appendChild(comp);
            expect(comp.value).toEqual('09:30');
            expect(comp.userSelected).toEqual(true);
        });

        it('sets from a property with no event, like an input', () => {
            const heard = vi.fn();
            const comp = makePicker();
            comp.addEventListener('date-changed', heard);
            comp.value = '2024-03-15';
            expect(comp.input.value).toEqual('Mar 15, 2024');
            expect(heard).not.toHaveBeenCalled();
            expect(comp.viewMonth).toEqual({year: 2024, month: 3});
        });

        it('takes a property set before it connects', () => {
            const comp = document.createElement('date-time-picker');
            comp.value = '2024-03-15';
            expect(comp.value).toEqual('2024-03-15');
            document.body.appendChild(comp);
            expect(comp.input.value).toEqual('Mar 15, 2024');
        });

        it('clears and warns for a value that it cannot read', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const comp = makePicker({value: '2024-03-15'});
            comp.value = 'nonsense';
            expect(comp.value).toEqual('');
            expect(warn).toHaveBeenCalledOnce();
            warn.mockRestore();
        });

        it('gets and sets as a Date', () => {
            const comp = makePicker();
            expect(comp.valueAsDate).toBeNull();
            comp.valueAsDate = new Date(2024, 2, 15, 13, 0);
            expect(comp.value).toEqual('2024-03-15');
            expect(comp.valueAsDate.getDate()).toEqual(15);
        });

        it('reads the same text again when the mode changes, and clears what it cannot read', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const comp = makePicker({value: '2024-03-15'});
            comp.setAttribute('mode', 'datetime');
            expect(comp.value).toEqual('2024-03-15T00:00');
            comp.setAttribute('mode', 'month');
            expect(comp.value).toEqual('2024-03');
            comp.setAttribute('mode', 'time');
            expect(comp.value).toEqual('');
            warn.mockRestore();
        });
    });

    describe('events', () => {
        it('sends input, change, and date-changed on a selection, with the whole detail', () => {
            const order = [];
            const comp = makePicker({'initial-date': '2024-03-15', 'instance-id': 'the-id', name: 'when'});
            for (const name of ['input', 'change', 'date-changed']) {
                comp.addEventListener(name, () => order.push(name));
            }
            let detail;
            comp.addEventListener('date-changed', (e) => { detail = e.detail; });
            comp.input.click();
            dayButton(comp, 20).click();
            expect(order).toEqual(['input', 'change', 'date-changed']);
            expect(detail.value).toEqual('2024-03-20');
            expect(detail.date).toBeInstanceOf(Date);
            expect(detail.dates).toHaveLength(1);
            expect(detail.instanceId).toEqual('the-id');
            expect(detail.name).toEqual('when');
            expect(detail.mode).toEqual('date');
            expect(detail.parts).toEqual([{year: 2024, month: 3, day: 20}]);
        });

        it('reaches the document, for an EventBroker, from a shadow root', () => {
            const heard = vi.fn();
            document.addEventListener('date-changed', heard);
            const comp = makePicker({'initial-date': '2024-03-15'}, 'shadow-date-time-picker');
            comp.input.click();
            dayButton(comp, 20).click();
            document.removeEventListener('date-changed', heard);
            expect(heard).toHaveBeenCalledOnce();
        });

        it('keeps the events of its inner input and selects inside', () => {
            const heard = vi.fn();
            const comp = makePicker({mode: 'time', value: '09:00'});
            comp.addEventListener('change', heard);
            comp.input.dispatchEvent(new Event('change', {bubbles: true}));
            expect(heard).not.toHaveBeenCalled();
        });

        it('sends no value events when the value stays the same', () => {
            const heard = vi.fn();
            const comp = makePicker({value: '2024-03-20'});
            comp.addEventListener('date-changed', heard);
            comp.input.click();
            dayButton(comp, 20).click();
            expect(heard).not.toHaveBeenCalled();
        });

        it('sends open and close events', () => {
            const opened = vi.fn();
            const closed = vi.fn();
            const comp = makePicker();
            comp.addEventListener('date-picker-open', opened);
            comp.addEventListener('date-picker-close', closed);
            comp.input.click();
            comp.closePicker();
            comp.closePicker();
            expect(opened).toHaveBeenCalledOnce();
            expect(closed).toHaveBeenCalledOnce();
        });

        it('sends date-view-changed with the dates on screen, so that a data owner can load them', () => {
            const heard = vi.fn();
            const comp = makePicker({'initial-date': '2024-03-15', locale: 'en-US'});
            comp.addEventListener('date-view-changed', heard);
            comp.input.click();
            expect(heard).not.toHaveBeenCalled();
            comp.picker.querySelector('.zest-next-month').click();
            expect(heard.mock.calls[0][0].detail).toMatchObject({
                year: 2024, month: 4, firstDate: '2024-04-01', lastDate: '2024-04-30',
                firstVisibleDate: '2024-03-31', lastVisibleDate: '2024-05-04',
            });
        });

        it('sends date-invalid with the reason for a typed value', () => {
            const heard = vi.fn();
            const comp = makePicker({min: '2024-03-10'});
            comp.addEventListener('date-invalid', heard);
            comp.input.value = '2024-03-01';
            comp.input.dispatchEvent(new Event('change'));
            expect(heard.mock.calls[0][0].detail).toMatchObject({text: '2024-03-01', reason: 'before-min'});
            comp.input.value = 'nonsense';
            comp.input.dispatchEvent(new Event('change'));
            expect(heard.mock.calls[1][0].detail.reason).toEqual('unreadable');
            expect(comp.value).toEqual('');
        });
    });

    describe('data from a registry', () => {
        afterEach(() => { delete window.pickerRegistry; });

        it('registers, applies the config, and unregisters', () => {
            const unregister = vi.fn();
            const register = vi.fn(() => ({
                unregisterFunc: unregister,
                pickerConfig: {value: '2024-03-15', min: '2024-03-10', getDayInfo: (iso) => (iso === '2024-03-20' ? {disabled: true, className: 'booked', badge: '!', title: 'Full', label: 'Full'} : null)},
            }));
            window.pickerRegistry = {pickerData: register};
            const comp = makePicker({'registry-name': 'pickerRegistry', 'data-register-func-name': 'pickerData', 'instance-id': 'abc', 'register-data': 'mine'});
            expect(register).toHaveBeenCalledWith('abc', 'mine', expect.any(Function));
            expect(comp.value).toEqual('2024-03-15');
            const booked = dayButton(comp, 20);
            expect(booked.classList.contains('booked')).toEqual(true);
            expect(booked.getAttribute('aria-disabled')).toEqual('true');
            expect(booked.title).toEqual('Full');
            expect(booked.querySelector('.zest-badge').textContent).toEqual('!');
            expect(booked.getAttribute('aria-label')).toMatch(/March 20, 2024, Full$/);
            booked.click();
            expect(comp.value).toEqual('2024-03-15');
            expect(dayButton(comp, 5).getAttribute('aria-disabled')).toEqual('true');
            comp.remove();
            expect(unregister).toHaveBeenCalledWith('abc', undefined);
        });

        it('needs no registry', () => {
            expect(() => makePicker()).not.toThrow();
        });

        it('fails clearly for a registry that does not exist', () => {
            const comp = document.createElement('date-time-picker');
            comp.setAttribute('registry-name', 'noSuchRegistry');
            comp.setAttribute('data-register-func-name', 'func');
            expect(() => comp.connectedCallback()).toThrow(/noSuchRegistry/);
        });

        it('takes new data at any time, and an attribute still wins', () => {
            const comp = makePicker({'initial-date': '2024-03-15', max: '2024-03-20'});
            comp.updateConfig({disabledDates: ['2024-03-12'], max: '2024-03-25'});
            expect(dayButton(comp, 12).classList.contains('zest-unavailable')).toEqual(true);
            expect(dayButton(comp, 22).classList.contains('zest-unavailable')).toEqual(true);
            comp.removeAttribute('max');
            expect(dayButton(comp, 22).classList.contains('zest-unavailable')).toEqual(false);
        });
    });

    describe('modes', () => {
        it('date-time: selects a day and a time, and stays open', () => {
            const comp = makePicker({mode: 'datetime', 'initial-date': '2024-03-15', locale: 'en-GB', 'minute-step': '15'});
            comp.input.click();
            dayButton(comp, 20).click();
            expect(comp.value).toEqual('2024-03-20T00:00');
            expect(comp.picker.style.display).toEqual('flex');
            const hour = comp.picker.querySelector('select.zest-hour');
            hour.value = '14';
            hour.dispatchEvent(new Event('change'));
            const minute = comp.picker.querySelector('select.zest-minute');
            expect([...minute.options].map(option => option.value)).toEqual(['0', '15', '30', '45']);
            minute.value = '30';
            minute.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('2024-03-20T14:30');
            dayButton(comp, 21).click();
            expect(comp.value).toEqual('2024-03-21T14:30');
            comp.picker.querySelector('.zest-done').click();
            expect(comp.picker.style.display).toEqual('none');
        });

        it('date-time: uses the default time', () => {
            const comp = makePicker({mode: 'datetime', 'initial-date': '2024-03-15', 'default-time': '09:00'});
            dayButton(comp, 20).click();
            expect(comp.value).toEqual('2024-03-20T09:00');
        });

        it('time: has a blank until something is selected, then the rest take defaults', () => {
            const comp = makePicker({mode: 'time', locale: 'en-GB'});
            expect(comp.picker.querySelector('.zest-calendars')).toBeNull();
            const hour = comp.picker.querySelector('select.zest-hour');
            expect(hour.value).toEqual('');
            hour.value = '7';
            hour.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('07:00');
        });

        it('time: 12 hour selects, with the hour list for the half of the day', () => {
            const comp = makePicker({mode: 'time', locale: 'en-US', value: '15:05'});
            const hour = comp.picker.querySelector('select.zest-hour');
            expect(hour.options[0].textContent).toEqual('12');
            expect(hour.options[hour.selectedIndex].textContent).toEqual('3');
            const period = comp.picker.querySelector('select.zest-period');
            expect(period.value).toEqual('pm');
            period.value = 'am';
            period.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('03:05');
            const twelve = comp.picker.querySelector('select.zest-hour');
            twelve.value = '0';
            twelve.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('00:05');
            expect(comp.input.value).toMatch(/^12:05/);
        });

        it('time: obeys twenty-four-hour-format over the locale, both ways', () => {
            const on = makePicker({mode: 'time', locale: 'en-US', 'twenty-four-hour-format': ''});
            expect(on.picker.querySelector('select.zest-period')).toBeNull();
            const off = makePicker({mode: 'time', locale: 'de-DE', 'twenty-four-hour-format': 'false'});
            expect(off.picker.querySelector('select.zest-period')).not.toBeNull();
        });

        it('time: shows seconds and their step with include-seconds', () => {
            const comp = makePicker({mode: 'time', locale: 'en-GB', 'include-seconds': '', 'second-step': '30', value: '09:15:30'});
            const second = comp.picker.querySelector('select.zest-second');
            expect([...second.options].map(option => option.value)).toEqual(['0', '30']);
            expect(second.value).toEqual('30');
            expect(comp.value).toEqual('09:15:30');
        });

        it('time: disables the hours and the minutes outside the limits, and moves a time into them', () => {
            const comp = makePicker({mode: 'time', locale: 'en-GB', min: '09:30', max: '17:00', value: '10:00'});
            const hour = comp.picker.querySelector('select.zest-hour');
            expect(hour.querySelector('[value="8"]').disabled).toEqual(true);
            expect(hour.querySelector('[value="9"]').disabled).toEqual(false);
            expect(hour.querySelector('[value="18"]').disabled).toEqual(true);
            hour.value = '9';
            hour.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('09:30');
        });

        it('time: a value that a new step puts off the steps still shows, and is not a choice', () => {
            const comp = makePicker({mode: 'time', locale: 'en-GB', value: '09:07'});
            comp.updateConfig({minuteStep: 15});
            const minute = comp.picker.querySelector('select.zest-minute');
            expect(minute.value).toEqual('7');
            expect([...minute.options].filter(option => !option.hidden).map(option => option.value)).toEqual(['0', '15', '30', '45']);
            expect(comp.validationProblem).toEqual('step');
        });

        it('time: a list from the steps, and slots from data', () => {
            const comp = makePicker({mode: 'time', locale: 'en-GB', 'time-view': 'list', 'minute-step': '30', min: '09:00'});
            comp.input.click();
            expect(comp.picker.querySelectorAll('.zest-slot')).toHaveLength(48);
            expect(comp.picker.querySelector('[data-time="08:30"]').getAttribute('aria-disabled')).toEqual('true');
            comp.picker.querySelector('[data-time="09:30"]').click();
            expect(comp.value).toEqual('09:30');
            expect(comp.picker.style.display).toEqual('none');
            comp.updateConfig({timeSlots: [{value: '10:00', label: 'Morning'}, {value: '14:00', disabled: true}, '16:00']});
            const slots = [...comp.picker.querySelectorAll('.zest-slot')];
            expect(slots.map(slot => slot.textContent)).toEqual(['Morning', '14:00', '16:00']);
            slots[1].click();
            expect(comp.value).toEqual('09:30');
        });

        it('month: selects from a month grid', () => {
            const comp = makePicker({mode: 'month', 'initial-date': '2024-03-15', locale: 'en-US'});
            comp.input.click();
            expect(comp.picker.querySelectorAll('.zest-cell')).toHaveLength(12);
            expect(comp.picker.querySelector('.zest-day')).toBeNull();
            comp.picker.querySelector('[data-date="2024-07"]').click();
            expect(comp.value).toEqual('2024-07');
            expect(comp.input.value).toEqual('July 2024');
            expect(comp.picker.style.display).toEqual('none');
        });

        it('year: selects from a year grid, and moves by pages', () => {
            const comp = makePicker({mode: 'year', 'initial-date': '2024-03-15', locale: 'en-US'});
            comp.input.click();
            expect(comp.picker.querySelectorAll('.zest-cell')).toHaveLength(12);
            comp.picker.querySelector('[data-date="2025"]').click();
            expect(comp.value).toEqual('2025');
            comp.input.click();
            const before = comp.picker.querySelector('.zest-cell').dataset.date;
            comp.picker.querySelector('.zest-next-month').click();
            expect(Number(comp.picker.querySelector('.zest-cell').dataset.date)).toEqual(Number(before) + 12);
        });

        it('week: selects a whole week, in ISO form, with week numbers', () => {
            const comp = makePicker({mode: 'week', 'initial-date': '2024-03-15', locale: 'en-GB'});
            comp.input.click();
            expect(comp.picker.querySelector('.zest-week-number[role="rowheader"]')).not.toBeNull();
            dayButton(comp, 13).click();
            expect(comp.value).toEqual('2024-W11');
            comp.input.click();
            expect([...comp.picker.querySelectorAll('.zest-day.zest-selected')].map(day => day.dataset.day)).toEqual(['11', '12', '13', '14', '15', '16', '17']);
        });

        it('falls back to date for a mode that it does not know', () => {
            expect(makePicker({mode: 'nonsense'}).mode).toEqual('date');
        });
    });

    describe('moving between the views', () => {
        it('goes from days to months to years, and back with a selection', () => {
            const comp = makePicker({'initial-date': '2024-03-15', locale: 'en-US'});
            comp.input.click();
            comp.picker.querySelector('.zest-month-name').click();
            expect(comp.picker.querySelectorAll('.zest-cell')).toHaveLength(12);
            comp.picker.querySelector('.zest-month-name').click();
            expect(comp.picker.querySelector('[data-date="2024"]')).not.toBeNull();
            comp.picker.querySelector('[data-date="2026"]').click();
            comp.picker.querySelector('[data-date="2026-06"]').click();
            expect(comp.picker.querySelector('.zest-month-name').textContent).toEqual('June 2026');
            expect(comp.value).toEqual('');
        });

        it('moves a year at a time', () => {
            const comp = makePicker({'initial-date': '2024-03-15', locale: 'en-US'});
            comp.picker.querySelector('.zest-next-year').click();
            expect(comp.picker.querySelector('.zest-month-name').textContent).toEqual('March 2025');
            comp.picker.querySelector('.zest-prev-year').click();
            comp.picker.querySelector('.zest-prev-year').click();
            expect(comp.picker.querySelector('.zest-month-name').textContent).toEqual('March 2023');
        });

        it('hides the arrows that go past the limits', () => {
            const comp = makePicker({'initial-date': '2024-03-15', min: '2024-03-01', max: '2024-04-30'});
            expect(comp.picker.querySelector('.zest-prev-month').disabled).toEqual(true);
            expect(comp.picker.querySelector('.zest-next-month').disabled).toEqual(false);
            comp.picker.querySelector('.zest-next-month').click();
            expect(comp.picker.querySelector('.zest-next-month').disabled).toEqual(true);
        });

        it('shows more than one month, with no day twice', () => {
            const comp = makePicker({'initial-date': '2024-03-15', months: '2', locale: 'en-US'});
            expect([...comp.picker.querySelectorAll('.zest-month-name')].map(name => name.textContent)).toEqual(['March 2024', 'April 2024']);
            const dates = [...comp.picker.querySelectorAll('.zest-day')].map(day => day.dataset.date);
            expect(new Set(dates).size).toEqual(dates.length);
            expect(comp.picker.querySelectorAll('.zest-next-month')).toHaveLength(1);
        });

        it('shows six weeks with fixed-weeks', () => {
            const comp = makePicker({'initial-date': '2015-02-10', 'fixed-weeks': '', locale: 'en-US'});
            expect(comp.picker.querySelectorAll('.zest-week')).toHaveLength(6);
        });

        it('starts the week where it is told, or where the locale does', () => {
            const headers = (comp) => [...comp.picker.querySelectorAll('.zest-weekday')].map(cell => cell.textContent);
            expect(headers(makePicker({locale: 'en-US'}))[0]).toEqual('Sun');
            expect(headers(makePicker({locale: 'en-GB'}))[0]).toEqual('Mon');
            expect(headers(makePicker({locale: 'en-US', 'first-day-of-week': '3'}))[0]).toEqual('Wed');
            expect(headers(makePicker({locale: 'en-GB', 'first-day-of-week': '0'}))[0]).toEqual('Sun');
        });

        it('lines up the days under a week that starts on Monday', () => {
            const comp = makePicker({'initial-date': '2024-03-15', locale: 'en-GB'});
            const first = [...comp.picker.querySelector('.zest-week').querySelectorAll('.zest-day')].map(day => Number(day.dataset.day));
            expect(first).toEqual([26, 27, 28, 29, 1, 2, 3]);
        });

        it('writes in the language of the locale', () => {
            const comp = makePicker({'initial-date': '2024-03-15', locale: 'de-DE'});
            expect(comp.picker.querySelector('.zest-month-name').textContent).toEqual('März 2024');
            expect(comp.input.placeholder).toEqual('15.03.2024');
        });
    });

    describe('selection', () => {
        it('range: two clicks in any sequence, with the start event first', () => {
            const started = vi.fn();
            const changed = vi.fn();
            const comp = makePicker({selection: 'range', 'initial-date': '2024-03-15', locale: 'en-US'});
            comp.addEventListener('date-range-start', started);
            comp.addEventListener('date-changed', changed);
            comp.input.click();
            dayButton(comp, 20).click();
            expect(started.mock.calls[0][0].detail.value).toEqual('2024-03-20');
            expect(changed).not.toHaveBeenCalled();
            expect(comp.value).toEqual('');
            expect(comp.input.value).toEqual('Mar 20, 2024 – ');
            expect(comp.picker.style.display).toEqual('flex');
            dayButton(comp, 10).click();
            expect(comp.value).toEqual('2024-03-10/2024-03-20');
            expect(comp.input.value).toEqual('Mar 10, 2024 – Mar 20, 2024');
            expect(changed).toHaveBeenCalledOnce();
            expect(changed.mock.calls[0][0].detail.start.getDate()).toEqual(10);
            expect(changed.mock.calls[0][0].detail.end.getDate()).toEqual(20);
            expect(comp.picker.style.display).toEqual('none');
            comp.input.click();
            expect(dayButton(comp, 10).classList.contains('zest-range-start')).toEqual(true);
            expect(dayButton(comp, 15).classList.contains('zest-in-range')).toEqual(true);
            expect(dayButton(comp, 20).classList.contains('zest-range-end')).toEqual(true);
        });

        it('range: previews on hover, and a half range leaves the old value when it closes', () => {
            const changed = vi.fn();
            const comp = makePicker({selection: 'range', locale: 'en-US', value: '2024-03-01/2024-03-02'});
            comp.addEventListener('date-changed', changed);
            comp.input.click();
            dayButton(comp, 10).click();
            dayButton(comp, 14).dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
            expect(dayButton(comp, 12).classList.contains('zest-in-range-preview')).toEqual(true);
            expect(dayButton(comp, 16).classList.contains('zest-in-range-preview')).toEqual(false);
            expect(comp.value).toEqual('2024-03-01/2024-03-02');
            comp.closePicker();
            expect(comp.input.value).toEqual('Mar 1, 2024 \u2013 Mar 2, 2024');
            expect(comp.value).toEqual('2024-03-01/2024-03-02');
            expect(changed).not.toHaveBeenCalled();
        });

        it('range: refuses a range with a day that is not available, and keeps the start', () => {
            const invalid = vi.fn();
            const comp = makePicker({selection: 'range', 'initial-date': '2024-03-15', 'disabled-dates': '2024-03-12'});
            comp.addEventListener('date-invalid', invalid);
            comp.input.click();
            dayButton(comp, 10).click();
            dayButton(comp, 14).click();
            expect(comp.value).toEqual('');
            expect(invalid.mock.calls[0][0].detail.reason).toEqual('disabled-in-range');
            dayButton(comp, 11).click();
            expect(comp.value).toEqual('2024-03-10/2024-03-11');
        });

        it('range: obeys the shortest and the longest range', () => {
            const comp = makePicker({selection: 'range', 'initial-date': '2024-03-15', 'min-range-days': '3', 'max-range-days': '5'});
            comp.input.click();
            dayButton(comp, 10).click();
            dayButton(comp, 11).click();
            expect(comp.value).toEqual('');
            dayButton(comp, 16).click();
            expect(comp.value).toEqual('');
            dayButton(comp, 14).click();
            expect(comp.value).toEqual('2024-03-10/2024-03-14');
        });

        it('range: reads what it writes when the user types', () => {
            const comp = makePicker({selection: 'range', locale: 'en-US'});
            comp.input.value = 'Mar 20, 2024 – Mar 10, 2024';
            comp.input.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('2024-03-10/2024-03-20');
            comp.input.value = '4/1/2024 to 4/5/2024';
            comp.input.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('2024-04-01/2024-04-05');
            comp.input.value = '2024-05-01/2024-05-03';
            comp.input.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('2024-05-01/2024-05-03');
        });

        it('range of date and time: has a start row and an end row', () => {
            const comp = makePicker({mode: 'datetime', selection: 'range', locale: 'en-GB', value: '2024-03-10T09:00/2024-03-12T17:00'});
            const rows = comp.picker.querySelectorAll('.zest-time-row');
            expect(rows).toHaveLength(2);
            expect(rows[0].querySelector('select.zest-hour').value).toEqual('9');
            expect(rows[1].querySelector('select.zest-hour').value).toEqual('17');
            const end = rows[1].querySelector('select.zest-hour');
            end.value = '18';
            end.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('2024-03-10T09:00/2024-03-12T18:00');
        });

        it('range of times: works with no calendar, and keeps them in sequence', () => {
            const comp = makePicker({mode: 'time', selection: 'range', locale: 'en-GB'});
            const start = comp.picker.querySelector('.zest-time-row[data-row="0"] select.zest-hour');
            start.value = '9';
            start.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('09:00/09:00');
            const end = comp.picker.querySelector('.zest-time-row[data-row="1"] select.zest-hour');
            end.value = '17';
            end.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('09:00/17:00');
        });

        it('range of times: a value goes to the other row only when the start is past the end', () => {
            const comp = makePicker({mode: 'time', selection: 'range', locale: 'en-GB'});
            const set = (row, part, value) => {
                const select = comp.picker.querySelector(`.zest-time-row[data-row="${row}"] select.zest-${part}`);
                select.value = value;
                select.dispatchEvent(new Event('change'));
            };
            set(0, 'hour', '9');
            set(0, 'minute', '30');
            expect(comp.value).toEqual('09:30/09:30');
            set(1, 'hour', '17');
            set(0, 'minute', '45');
            expect(comp.value).toEqual('09:45/17:30');
            set(0, 'hour', '18');
            expect(comp.value).toEqual('18:45/18:45');
            set(0, 'hour', '8');
            expect(comp.value).toEqual('08:45/18:45');
            set(1, 'hour', '7');
            expect(comp.value).toEqual('07:45/07:45');
        });

        it('multiple: toggles days, keeps them in sequence, and stays open', () => {
            const comp = makePicker({selection: 'multiple', 'initial-date': '2024-03-15', locale: 'en-US'});
            comp.input.click();
            dayButton(comp, 20).click();
            dayButton(comp, 10).click();
            expect(comp.value).toEqual('2024-03-10,2024-03-20');
            expect(comp.input.value).toEqual('Mar 10, 2024; Mar 20, 2024');
            expect(comp.picker.style.display).toEqual('flex');
            dayButton(comp, 20).click();
            expect(comp.value).toEqual('2024-03-10');
            comp.input.value = 'Mar 1, 2024; Mar 2, 2024';
            comp.input.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('2024-03-01,2024-03-02');
        });

        it('range of months', () => {
            const comp = makePicker({mode: 'month', selection: 'range', 'initial-date': '2024-03-15'});
            comp.input.click();
            comp.picker.querySelector('[data-date="2024-02"]').click();
            comp.picker.querySelector('[data-date="2024-05"]').click();
            expect(comp.value).toEqual('2024-02/2024-05');
        });

        it('clear and today buttons', () => {
            const comp = makePicker({value: '2024-03-15', locale: 'en-US'});
            comp.input.click();
            comp.picker.querySelector('.zest-clear').click();
            expect(comp.value).toEqual('');
            expect(comp.picker.querySelector('.zest-clear')).toBeNull();
            expect(comp.picker.querySelector('.zest-now').textContent).toEqual('Today');
            comp.picker.querySelector('.zest-now').click();
            expect(comp.input.value).toEqual(new Intl.DateTimeFormat('en-US', {dateStyle: 'medium'}).format(new Date()));
        });

        it('the now button uses the time zone', () => {
            vi.useFakeTimers({now: new Date('2024-07-01T02:00:00Z'), toFake: ['Date']});
            const comp = makePicker({mode: 'datetime', 'time-zone': 'America/New_York', locale: 'en-GB'});
            comp.input.click();
            comp.picker.querySelector('.zest-now').click();
            expect(comp.value).toEqual('2024-06-30T22:00');
        });

        it('the now button selects the nearest step, and sends the exact moment', () => {
            vi.useFakeTimers({now: new Date('2024-07-01T13:07:30Z'), toFake: ['Date']});
            const comp = makePicker({mode: 'datetime', 'time-zone': 'UTC', locale: 'en-GB', 'minute-step': '15', 'initial-date': '2024-03-15'});
            const sent = [];
            comp.addEventListener('date-now', (e) => sent.push(e.detail));
            comp.input.click();
            comp.picker.querySelector('.zest-now').click();
            expect(comp.value).toEqual('2024-07-01T13:00');
            expect(comp.validationProblem).toBeNull();
            expect(comp.picker.textContent).toContain('July 2024');
            expect(sent[0].date.toISOString()).toEqual('2024-07-01T13:07:30.000Z');
            expect(sent[0].parts).toMatchObject({year: 2024, month: 7, day: 1, hour: 13, minute: 7, second: 30});
            expect(sent[0].value).toEqual('2024-07-01T13:00');
        });

        it('the now button replaces the date and the time of a value', () => {
            vi.useFakeTimers({now: new Date('2024-07-01T13:07:00Z'), toFake: ['Date']});
            const comp = makePicker({mode: 'datetime', 'time-zone': 'UTC', locale: 'en-GB', value: '2024-03-15T09:30'});
            comp.input.click();
            comp.picker.querySelector('.zest-now').click();
            expect(comp.value).toEqual('2024-07-01T13:07');
            expect(comp.picker.querySelector('.zest-day.zest-selected').dataset.date).toEqual('2024-07-01');
            expect(comp.picker.querySelector('select.zest-hour').value).toEqual('13');
            expect(comp.picker.querySelector('select.zest-minute').value).toEqual('7');
        });

        it('the now button rounds up, and a time at the same distance goes to the later step', () => {
            vi.useFakeTimers({now: new Date('2024-07-01T13:08:00Z'), toFake: ['Date']});
            const up = makePicker({mode: 'time', 'time-zone': 'UTC', 'minute-step': '15', locale: 'en-GB'});
            up.input.click();
            up.picker.querySelector('.zest-now').click();
            expect(up.value).toEqual('13:15');
            vi.setSystemTime(new Date('2024-07-01T13:15:00Z'));
            const tie = makePicker({mode: 'time', 'time-zone': 'UTC', 'minute-step': '30', locale: 'en-GB'});
            tie.input.click();
            tie.picker.querySelector('.zest-now').click();
            expect(tie.value).toEqual('13:30');
        });

        it('the now button stays on the same day', () => {
            vi.useFakeTimers({now: new Date('2024-07-01T23:53:00Z'), toFake: ['Date']});
            const comp = makePicker({mode: 'datetime', 'time-zone': 'UTC', 'minute-step': '15', locale: 'en-GB'});
            comp.input.click();
            comp.picker.querySelector('.zest-now').click();
            expect(comp.value).toEqual('2024-07-01T23:45');
        });

        it('the now button selects from a list, and the list stays the same', () => {
            vi.useFakeTimers({now: new Date('2024-07-01T13:07:00Z'), toFake: ['Date']});
            const comp = makePicker({mode: 'time', 'time-zone': 'UTC', 'time-view': 'list', 'minute-step': '30', locale: 'en-GB'});
            comp.input.click();
            const count = comp.picker.querySelectorAll('.zest-slot').length;
            comp.picker.querySelector('.zest-now').click();
            expect(comp.value).toEqual('13:00');
            expect(comp.picker.querySelectorAll('.zest-slot').length).toEqual(count);
            expect(comp.picker.querySelector('.zest-slot.zest-selected').dataset.time).toEqual('13:00');
        });

        it('the now button is disabled when now is out of the limits', () => {
            vi.useFakeTimers({now: new Date('2024-07-01T20:07:00Z'), toFake: ['Date']});
            const comp = makePicker({mode: 'time', 'time-zone': 'UTC', 'minute-step': '30', min: '09:00', max: '17:00', locale: 'en-GB'});
            comp.input.click();
            expect(comp.picker.querySelector('.zest-now').disabled).toBe(true);
        });

        it('a value from any source goes to the nearest step, and sends no event', () => {
            const comp = makePicker({mode: 'datetime', 'minute-step': '15', locale: 'en-GB'});
            const changes = [];
            comp.addEventListener('date-changed', (e) => changes.push(e.detail.value));
            comp.value = '2024-07-01T13:13';
            expect(comp.value).toEqual('2024-07-01T13:15');
            expect(changes).toEqual([]);
            expect(makePicker({mode: 'time', 'minute-step': '15', value: '13:13'}).value).toEqual('13:15');
            expect(makePicker({mode: 'time', value: '13:13'}).value).toEqual('13:13');
            expect(makePicker({mode: 'time', selection: 'range', 'minute-step': '15', value: '09:07/13:13'}).value).toEqual('09:00/13:15');
        });

        it('a value out of the limits stays as it is, and is reported', () => {
            const comp = makePicker({mode: 'time', 'minute-step': '15', min: '09:00', max: '17:00', value: '20:07'});
            expect(comp.value).toEqual('20:07');
            expect(comp.validationProblem).toEqual('after-max');
        });

        it('the now button sends the usual events', () => {
            vi.useFakeTimers({now: new Date('2024-07-01T13:07:00Z'), toFake: ['Date']});
            const comp = makePicker({mode: 'datetime', 'time-zone': 'UTC', locale: 'en-GB'});
            const changes = [];
            comp.addEventListener('date-changed', (e) => changes.push(e.detail.value));
            comp.input.click();
            comp.picker.querySelector('.zest-now').click();
            comp.picker.querySelector('.zest-now').click();
            expect(changes).toEqual(['2024-07-01T13:07']);
        });

        it('the now button fills a range, and adds to multiple dates', () => {
            vi.useFakeTimers({now: new Date('2024-07-01T13:07:00Z'), toFake: ['Date']});
            const range = makePicker({mode: 'datetime', selection: 'range', 'time-zone': 'UTC', locale: 'en-GB'});
            range.input.click();
            range.picker.querySelector('.zest-now').click();
            expect(range.value).toEqual('2024-07-01T13:07/2024-07-01T13:07');
            const multiple = makePicker({selection: 'multiple', 'time-zone': 'UTC', value: '2024-03-15', locale: 'en-GB'});
            multiple.input.click();
            multiple.picker.querySelector('.zest-now').click();
            expect(multiple.value).toEqual('2024-03-15,2024-07-01');
            expect(multiple.picker.style.display).toEqual('flex');
        });

        it('show-now="false" removes the now button', () => {
            const comp = makePicker({mode: 'datetime', 'show-now': 'false', locale: 'en-GB'});
            comp.input.click();
            expect(comp.picker.querySelector('.zest-now')).toBeNull();
        });

        it('has no clear button when clearable is false, or when required', () => {
            const off = makePicker({value: '2024-03-15', clearable: 'false'});
            expect(off.picker.querySelector('.zest-clear')).toBeNull();
            const required = makePicker({value: '2024-03-15', required: ''});
            expect(required.picker.querySelector('.zest-clear')).toBeNull();
        });

        it('applies a preset from data, including a function', () => {
            const comp = makePicker({selection: 'range', 'initial-date': '2024-03-15', locale: 'en-US'});
            comp.updateConfig({presets: [
                {label: 'Fixed', value: '2024-01-01/2024-01-07'},
                {label: 'From now', value: (now) => `${now.year}-01-01/${now.year}-01-02`},
            ]});
            comp.input.click();
            const buttons = comp.picker.querySelectorAll('.zest-preset');
            buttons[0].click();
            expect(comp.value).toEqual('2024-01-01/2024-01-07');
            expect(comp.viewMonth).toEqual({year: 2024, month: 1});
            expect(comp.picker.style.display).toEqual('none');
        });
    });

    describe('disabled, read only, and inline', () => {
        it('disabled: does not open, and accepts nothing', () => {
            const comp = makePicker({disabled: ''});
            comp.input.click();
            expect(comp.picker.style.display).toEqual('none');
            expect(comp.input.disabled).toEqual(true);
            expect(comp.toggle.disabled).toEqual(true);
            expect(comp.disabled).toEqual(true);
        });

        it('disabled property reflects, and a day cannot be selected', () => {
            const comp = makePicker({'initial-date': '2024-03-15', inline: ''});
            comp.disabled = true;
            expect(comp.hasAttribute('disabled')).toEqual(true);
            dayButton(comp, 10).click();
            expect(comp.value).toEqual('');
            comp.disabled = false;
            dayButton(comp, 10).click();
            expect(comp.value).toEqual('2024-03-10');
        });

        it('read only: shows the value, does not open, and takes no text', () => {
            const comp = makePicker({readonly: '', value: '2024-03-15', locale: 'en-US'});
            comp.input.click();
            expect(comp.picker.style.display).toEqual('none');
            expect(comp.input.readOnly).toEqual(true);
            expect(comp.input.value).toEqual('Mar 15, 2024');
        });

        it('no-typing: opens, and takes no text', () => {
            const comp = makePicker({'no-typing': ''});
            comp.input.click();
            expect(comp.input.readOnly).toEqual(true);
            expect(comp.picker.style.display).toEqual('flex');
        });

        it('inline: always shows, with no input, and stays after a selection', () => {
            const comp = makePicker({inline: '', 'initial-date': '2024-03-15'});
            expect(comp.picker.style.display).toEqual('flex');
            expect(comp.input.parentElement.style.display).toEqual('none');
            dayButton(comp, 20).click();
            expect(comp.value).toEqual('2024-03-20');
            expect(comp.picker.style.display).toEqual('flex');
            expect(comp.picker.querySelector('.zest-done')).toBeNull();
            document.body.click();
            expect(comp.picker.style.display).toEqual('flex');
        });
    });

    describe('validity without a browser form', () => {
        it('gives the problem', () => {
            const comp = makePicker({required: ''});
            expect(comp.validationProblem).toEqual('value-missing');
            comp.value = '2024-03-15';
            expect(comp.validationProblem).toBeNull();
            comp.setAttribute('min', '2024-04-01');
            comp.value = '2024-03-15';
            expect(comp.validationProblem).toEqual('before-min');
            expect(comp.input.getAttribute('aria-invalid')).toEqual('true');
            comp.value = '2024-05-15';
            expect(comp.input.hasAttribute('aria-invalid')).toEqual(false);
        });
    });

    describe('custom text', () => {
        it('uses a custom format and parser from data', () => {
            const comp = makePicker({locale: 'en-US'});
            comp.updateConfig({
                formatDisplay: (iso) => `<<${iso}>>`,
                parseText: (text) => (text === 'launch' ? '2030-01-01' : null),
            });
            comp.value = '2024-03-15';
            expect(comp.input.value).toEqual('<<2024-03-15>>');
            comp.input.value = 'launch';
            comp.input.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('2030-01-01');
        });

        it('uses labels from data', () => {
            const comp = makePicker({value: '2024-03-15'});
            comp.updateConfig({labels: {clear: 'Effacer'}});
            expect(comp.picker.querySelector('.zest-clear').textContent).toEqual('Effacer');
        });
    });

    describe('time zones', () => {
        it('gives the instant in the time zone of the element', () => {
            const comp = makePicker({mode: 'datetime', 'time-zone': 'Asia/Tokyo', value: '2024-03-15T09:00'});
            expect(comp.valueAsDate.toISOString()).toEqual('2024-03-15T00:00:00.000Z');
            let detail;
            comp.addEventListener('date-changed', (e) => { detail = e.detail; });
            comp.input.value = '2024-03-15T10:00';
            comp.input.dispatchEvent(new Event('change'));
            expect(detail.date.toISOString()).toEqual('2024-03-15T01:00:00.000Z');
            expect(detail.timeZone).toEqual('Asia/Tokyo');
        });

        it('reads a value with an offset as the wall clock of the zone', () => {
            const comp = makePicker({mode: 'datetime', 'time-zone': 'America/New_York', value: '2024-03-15T12:00:00Z'});
            expect(comp.value).toEqual('2024-03-15T08:00');
        });

        it('marks today in the time zone of the element', () => {
            vi.useFakeTimers({now: new Date('2024-07-01T02:00:00Z'), toFake: ['Date']});
            const comp = makePicker({'time-zone': 'America/New_York'});
            expect(comp.picker.querySelector('.zest-today').dataset.date).toEqual('2024-06-30');
        });

        it('keeps the wall clock and moves the instant when the user selects a zone', () => {
            const zones = vi.fn();
            const changed = vi.fn();
            const comp = makePicker({mode: 'datetime', 'time-zone-selectable': '', 'time-zone': 'UTC', value: '2024-03-15T09:00'});
            comp.addEventListener('date-time-zone-changed', zones);
            comp.addEventListener('date-changed', changed);
            const select = comp.picker.querySelector('.zest-time-zone-select');
            select.value = 'Asia/Tokyo';
            select.dispatchEvent(new Event('change'));
            expect(comp.value).toEqual('2024-03-15T09:00');
            expect(zones.mock.calls[0][0].detail.timeZone).toEqual('Asia/Tokyo');
            expect(changed.mock.calls[0][0].detail.date.toISOString()).toEqual('2024-03-15T00:00:00.000Z');
        });
    });
});
