// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { addDays, buildRules, formatDisplay, formatValue, fromInstant, parseSelection, parseText, parseValue, toInstant, valueProblem, type DateParts, type DateTimeParts, type ValueProblem } from '@catalystcommunity/date-model';

const now: DateTimeParts = fromInstant(new Date(), 'America/Denver');
const date: DateParts | null = parseValue('2026-03-13', 'date');
if (date) {
    const next = addDays(date, 1);
    const iso: string = formatValue(next, 'date');
    const text: string = formatDisplay(next, 'date', {locale: 'de-DE', format: 'long'});
    void [iso, text];
}
const typed = parseText('tomorrow 3pm', 'datetime', {locale: 'en-US', reference: now});
if (typed) {
    const hour: number = typed.hour;
    const instant: Date = toInstant(typed, 'America/Denver');
    void [hour, instant];
}
const range = parseSelection('2026-03-01/2026-03-05', 'date', 'range');
const rules = buildRules({min: '2026-03-02', disabledWeekdays: [0, 6], isDateDisabled: (iso) => iso.endsWith('-13')}, 'date');
const problem: ValueProblem | null = range ? valueProblem(range[0], rules) : null;
void problem;
