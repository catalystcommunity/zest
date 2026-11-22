// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { validators as v, validateRecord, validatorsFromCsil, type Validator } from '@catalystcommunity/validators';

const quantity: Validator<number> = v.uint({max: 100, messages: {max: (limit: number) => `No more than ${limit}.`}});
const result = quantity.parse('12');
if (result.valid) { const n: number | null = result.value; console.log(n); } else { console.log(result.reason, result.message); }
const big: Validator<bigint> = v.int({bigint: true});
const size = v.oneOf([{value: 's', label: 'Small'}, {value: 'l', label: 'Large'}]);
console.log(size.labelOf?.('s'), size.options?.length, big.kind);
const stamp: Validator<Date> = v.timestamp({min: '2026-01-01T00:00:00Z'});
const record = validateRecord({item: 'Pens', quantity: '3'}, {item: v.required(v.text()), quantity, when: stamp});
if (!record.valid) { console.log(record.errors.item); }
for (const field of validatorsFromCsil({body: {rules: []}}, 'Order')) { console.log(field.key, field.required, field.validator?.kind); }

// Locales, time zones, and messages
import { setValidatorMessages, validatorMessages, numberSeparators, dateOrder, canonicalNumberText } from '@catalystcommunity/validators';
const german = v.float().parse('1.234,5', {locale: 'de-DE', messages: {float: 'Eine Zahl.'}});
const berlin: Validator<Date> = v.timestamp({timeZone: 'Europe/Berlin'});
console.log(german.valid, berlin.format(new Date(), {locale: 'de-DE'}), numberSeparators('de-DE').decimal, dateOrder('en-US')[0], canonicalNumberText('1.234,5', 'de-DE'));
setValidatorMessages({required: 'Bitte einen Wert eingeben.', max: (limit: number) => `Höchstens ${limit}.`});
setValidatorMessages(null);
console.log(validatorMessages.required);
