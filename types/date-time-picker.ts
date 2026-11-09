// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { DateTimePicker, ShadowDateTimePicker, type DayInfo } from '@catalystcommunity/date-time-picker';

customElements.define('date-time-picker', DateTimePicker);
customElements.define('shadow-date-time-picker', ShadowDateTimePicker);

const picker = document.createElement('date-time-picker');
picker.setAttribute('mode', 'datetime');
picker.value = '2026-03-13T09:00';
const days: Record<string, DayInfo> = {'2026-03-14': {disabled: true, badge: 'Full'}};
picker.updateConfig({
    minuteStep: 15,
    getDayInfo: (iso) => days[iso],
    presets: [{label: 'Now', value: (now) => `${now.year}-03-13`}],
    labels: {done: 'OK'},
});
picker.addEventListener('date-changed', (event) => {
    const when: Date | null = event.detail.date;
    void [when, event.detail.value, event.detail.instanceId];
});
picker.addEventListener('date-view-changed', (event) => { void event.detail.firstVisibleDate; });
picker.addEventListener('date-invalid', (event) => { void (event.detail.reason === 'step'); });
document.body.append(picker);
picker.openPicker();
const valid: boolean = picker.checkValidity();
void [valid, picker.validationProblem, picker.valueAsDate];
