import { validators, validateRecord, validatorsFromCsil, setValidatorMessages, validatorMessages, numberSeparators, dateOrder } from '../src/index.js';

const v = validators;
const ok = (result) => { expect(result.valid).toBe(true); return result.value; };
const bad = (result) => { expect(result.valid).toBe(false); return result; };

describe('empty input', () => {
    it('is valid and null, unless the validator is required', () => {
        for (const make of [v.int, v.uint, v.float, v.decimal, v.text, v.bool, v.bytes, v.timestamp, v.date, v.uuid, v.any]) {
            expect(make().parse('')).toEqual({valid: true, value: null});
            expect(make().parse('   ')).toEqual({valid: true, value: null});
            expect(make().parse(null)).toEqual({valid: true, value: null});
            const result = bad(make({required: true}).parse(''));
            expect(result.reason).toBe('required');
            expect(result.message).toBe('Type a value.');
        }
    });

    it('required() and optional() make copies', () => {
        const base = v.int({min: 1});
        expect(v.required(base).parse('').reason).toBe('required');
        expect(v.optional(v.required(base)).parse('').valid).toBe(true);
        expect(v.required(base).parse('0').reason).toBe('min');
        expect(base.required).toBe(false);
    });
});

describe('int and uint', () => {
    it('reads whole numbers, also with correct grouping', () => {
        expect(ok(v.int().parse('42'))).toBe(42);
        expect(ok(v.int().parse(' -17 '))).toBe(-17);
        expect(ok(v.int().parse('+5'))).toBe(5);
        expect(ok(v.int().parse('1,234,567'))).toBe(1234567);
        expect(ok(v.int().parse('-0'))).toBe(0);
        expect(Object.is(ok(v.int().parse('-0')), 0)).toBe(true);
    });

    it('refuses other text', () => {
        for (const input of ['1.5', '1e3', 'abc', '12,34', '1,2345', '--1', '0x10', '1 000']) {
            expect(bad(v.int().parse(input)).reason).toBe('type');
        }
        expect(v.int().parse('1.5').message).toBe('Type a whole number.');
    });

    it('refuses a number outside the safe range, unless bigint is true', () => {
        expect(bad(v.int().parse('9007199254740993')).reason).toBe('unsafe');
        expect(ok(v.int({bigint: true}).parse('9007199254740993'))).toBe(9007199254740993n);
        expect(ok(v.int({bigint: true}).parse('12'))).toBe(12n);
    });

    it('checks the limits', () => {
        const age = v.int({min: 0, max: 120});
        expect(ok(age.parse('120'))).toBe(120);
        expect(bad(age.parse('121')).message).toBe('Type a number that is 120 or less.');
        expect(bad(age.parse('-1')).message).toBe('Type a number that is 0 or more.');
        expect(bad(v.int({above: 0}).parse('0')).reason).toBe('above');
        expect(bad(v.int({below: 10}).parse('10')).reason).toBe('below');
        expect(bad(v.int({min: 5n, bigint: true}).parse('4')).reason).toBe('min');
    });

    it('uint refuses a negative number', () => {
        expect(ok(v.uint().parse('0'))).toBe(0);
        expect(ok(v.uint().parse('-0'))).toBe(0);
        expect(bad(v.uint().parse('-3')).message).toBe('Type a whole number that is 0 or more.');
        expect(v.uint().kind).toBe('uint');
        expect(v.uint().inputMode).toBe('numeric');
    });

    it('formats a value that parse reads back', () => {
        const int = v.int();
        expect(int.format(-42)).toBe('-42');
        expect(ok(int.parse(int.format(-42)))).toBe(-42);
        expect(int.format(null)).toBe('');
    });
});

describe('float', () => {
    it('reads numbers', () => {
        expect(ok(v.float().parse('3.14'))).toBe(3.14);
        expect(ok(v.float().parse('-.5'))).toBe(-0.5);
        expect(ok(v.float().parse('1e3'))).toBe(1000);
        expect(ok(v.float().parse('1,234.5'))).toBe(1234.5);
        expect(ok(v.float().parse('7.'))).toBe(7);
        expect(bad(v.float().parse('1.2.3')).reason).toBe('type');
        expect(bad(v.float().parse('NaN')).reason).toBe('type');
    });

    it('reads infinity only when finite is false', () => {
        expect(bad(v.float().parse('Infinity')).reason).toBe('type');
        expect(bad(v.float().parse('1e400')).reason).toBe('finite');
        expect(ok(v.float({finite: false}).parse('-Infinity'))).toBe(-Infinity);
    });

    it('checks the limits and equality', () => {
        expect(bad(v.float({max: 1}).parse('1.5')).reason).toBe('max');
        expect(bad(v.float({equal: 2}).parse('3')).message).toBe('Type 2.');
        expect(bad(v.float({notEqual: 0}).parse('0')).message).toBe('Do not type 0.');
    });
});

describe('decimal', () => {
    it('keeps each digit as text', () => {
        expect(ok(v.decimal().parse('12.50'))).toBe('12.5');
        expect(ok(v.decimal().parse('0012'))).toBe('12');
        expect(ok(v.decimal().parse('-0.00'))).toBe('0');
        expect(ok(v.decimal().parse('.25'))).toBe('0.25');
        expect(ok(v.decimal().parse('123456789012345678901234567890.123'))).toBe('123456789012345678901234567890.123');
    });

    it('with a scale, has exactly that many decimals', () => {
        const money = v.decimal({scale: 2});
        expect(ok(money.parse('12.5'))).toBe('12.50');
        expect(ok(money.parse('3'))).toBe('3.00');
        expect(ok(money.parse('1.230'))).toBe('1.23');
        expect(bad(money.parse('1.234')).message).toBe('Type a number with 2 decimals or fewer.');
        expect(bad(v.decimal({min: 0}).parse('-1')).reason).toBe('min');
        expect(bad(v.decimal().parse('1e3')).reason).toBe('type');
    });
});

describe('text', () => {
    it('counts code points, not UTF-16 units', () => {
        const short = v.text({maxLength: 2});
        expect(ok(short.parse('😀😀'))).toBe('😀😀');
        expect(bad(short.parse('abc')).message).toBe('Type 2 characters or fewer.');
        expect(bad(v.text({minLength: 3}).parse('ab')).message).toBe('Type 3 characters or more.');
    });

    it('matches a pattern against all of the text', () => {
        const code = v.text({pattern: '[A-Z]{3}'});
        expect(ok(code.parse('ABC'))).toBe('ABC');
        expect(bad(code.parse('ABCD')).reason).toBe('pattern');
        const global = v.text({pattern: /^\d+$/g});
        expect(global.parse('12').valid).toBe(true);
        expect(global.parse('12').valid).toBe(true);
    });

    it('trims, unless trim is false', () => {
        expect(ok(v.text().parse('  a b  '))).toBe('a b');
        expect(ok(v.text({trim: false}).parse('  a b  '))).toBe('  a b  ');
    });

    it('runs the test function after the other checks', () => {
        const even = v.int({test: (value) => (value % 2 ? 'Type an even number.' : null)});
        expect(ok(even.parse('4'))).toBe(4);
        expect(bad(even.parse('3')).message).toBe('Type an even number.');
        expect(bad(even.parse('x')).reason).toBe('type');
    });

    it('takes other messages', () => {
        const name = v.text({required: true, messages: {required: 'Type the name.'}});
        expect(name.parse('').message).toBe('Type the name.');
    });
});

describe('bool', () => {
    it('reads common words', () => {
        for (const word of ['TRUE', 'true', 'yes', 'Y', '1', 'on', 'x']) { expect(ok(v.bool().parse(word))).toBe(true); }
        for (const word of ['FALSE', 'no', 'N', '0', 'off']) { expect(ok(v.bool().parse(word))).toBe(false); }
        expect(bad(v.bool().parse('maybe')).message).toBe('Type TRUE or FALSE.');
        expect(v.bool().format(true)).toBe('TRUE');
    });
});

describe('bytes', () => {
    it('reads hexadecimal, with spaces and 0x', () => {
        expect([...ok(v.bytes().parse('DE AD be ef'))]).toEqual([0xde, 0xad, 0xbe, 0xef]);
        expect([...ok(v.bytes().parse('0x0102'))]).toEqual([1, 2]);
        expect(bad(v.bytes().parse('ABC')).reason).toBe('type');
        expect(bad(v.bytes().parse('zz')).reason).toBe('type');
        expect(v.bytes().format(new Uint8Array([0, 255]))).toBe('00ff');
    });

    it('reads Base64, and checks the length in bytes', () => {
        const b64 = v.bytes({encoding: 'base64', maxLength: 2});
        expect([...ok(b64.parse('AQI='))]).toEqual([1, 2]);
        expect(bad(b64.parse('AQID')).message).toBe('Type 2 bytes or fewer.');
        expect(bad(b64.parse('***')).reason).toBe('type');
        expect(b64.format(new Uint8Array([1, 2]))).toBe('AQI=');
    });
});

describe('timestamp and date', () => {
    it('reads ISO 8601 with an offset', () => {
        expect(ok(v.timestamp().parse('2026-03-13T09:30:00Z')).toISOString()).toBe('2026-03-13T09:30:00.000Z');
        expect(ok(v.timestamp().parse('2026-03-13 09:30+02:00')).toISOString()).toBe('2026-03-13T07:30:00.000Z');
        expect(ok(v.timestamp().parse('2026-03-13T09:30:00.123456Z')).toISOString()).toBe('2026-03-13T09:30:00.123Z');
    });

    it('refuses a time with no offset, and dates that do not exist', () => {
        expect(bad(v.timestamp().parse('2026-03-13T09:30:00')).reason).toBe('offset');
        for (const input of ['2026-02-30T00:00Z', '2026-13-01T00:00Z', '2026-03-13T24:00Z', 'tomorrow']) {
            expect(bad(v.timestamp().parse(input)).reason).toBe('type');
        }
        expect(bad(v.timestamp({min: '2026-01-01T00:00:00Z'}).parse('2025-12-31T23:59Z')).message).toBe('Type a date and time that is 2026-01-01T00:00:00.000Z or later.');
    });

    it('formats a Date as ISO text', () => {
        const stamp = v.timestamp();
        const value = new Date('2026-03-13T09:30:00Z');
        expect(stamp.format(value)).toBe('2026-03-13T09:30:00.000Z');
        expect(stamp.check(value).valid).toBe(true);
    });

    it('date reads a calendar date, also a leap day', () => {
        expect(ok(v.date().parse('2024-02-29'))).toBe('2024-02-29');
        expect(bad(v.date().parse('2026-02-29')).reason).toBe('type');
        expect(bad(v.date().parse('3/13/2026')).message).toBe('Type a date, for example 2026-03-13.');
        expect(bad(v.date({min: '2026-01-01'}).parse('2025-12-31')).reason).toBe('min');
        expect(bad(v.date({min: '2026-01-01'}).parse('2025-12-31')).message).toBe('Type a date that is 2026-01-01 or later.');
        expect(bad(v.date({max: '2026-01-01'}).parse('2026-01-02')).message).toBe('Type a date that is 2026-01-01 or earlier.');
        expect(bad(v.date({above: '2026-01-01'}).parse('2026-01-01')).message).toBe('Type a date that is after 2026-01-01.');
        expect(bad(v.date({below: '2026-01-01'}).parse('2026-01-01')).reason).toBe('below');
        expect(ok(v.date({above: '2026-01-01', below: '2026-01-03'}).parse('2026-01-02'))).toBe('2026-01-02');
        expect(bad(v.timestamp({min: '2026-01-01T00:00:00Z'}).parse('2025-12-31T00:00:00Z')).message).toBe('Type a date and time that is 2026-01-01T00:00:00.000Z or later.');
        expect(bad(v.int({min: 2}).parse('1')).message).toBe('Type a number that is 2 or more.');
    });
});

describe('uuid', () => {
    it('reads a UUID in lower case', () => {
        expect(ok(v.uuid().parse('123E4567-E89B-12D3-A456-426614174000'))).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(bad(v.uuid().parse('123e4567e89b12d3a456426614174000')).reason).toBe('type');
    });
});

describe('oneOf', () => {
    const size = v.oneOf([{value: 's', label: 'Small'}, {value: 'm', label: 'Medium'}, 'Large']);

    it('reads the label or the value, with no case', () => {
        expect(ok(size.parse('small'))).toBe('s');
        expect(ok(size.parse('M'))).toBe('m');
        expect(ok(size.parse('LARGE'))).toBe('Large');
        expect(bad(size.parse('Huge')).message).toBe('Select a value from the list.');
        expect(bad(v.oneOf(['A'], {caseSensitive: true}).parse('a')).reason).toBe('oneOf');
    });

    it('gives the options and the label of a value', () => {
        expect(size.kind).toBe('enum');
        expect(size.options.map((item) => item.label)).toEqual(['Small', 'Medium', 'Large']);
        expect(size.labelOf('m')).toBe('Medium');
        expect(size.format('s')).toBe('Small');
        expect(size.check('s').value).toBe('s');
    });

    it('keeps number values', () => {
        const level = v.oneOf([{value: 1, label: 'Low'}, {value: 2, label: 'High'}]);
        expect(ok(level.parse('high'))).toBe(2);
        expect(ok(level.parse('2'))).toBe(2);
        expect(level.check(1).value).toBe(1);
    });

    it('reads one of 10,000 options in constant time', () => {
        const many = v.oneOf(Array.from({length: 10000}, (_, i) => `Item ${i}`));
        const start = performance.now();
        for (let i = 0; i < 10000; i++) { many.parse(`item ${i}`); }
        expect(performance.now() - start).toBeLessThan(200);
    });
});

describe('check', () => {
    it('checks a typed value', () => {
        expect(v.int({max: 3}).check(4).reason).toBe('max');
        expect(v.int().check(4).value).toBe(4);
        expect(v.bool().check(false).value).toBe(false);
        expect(v.bytes().check(new Uint8Array([1])).valid).toBe(true);
        expect(v.text({required: true}).check(null).reason).toBe('required');
    });
});

describe('validateRecord', () => {
    it('gives the typed values and a message for each problem', () => {
        const fields = {name: v.text({required: true}), age: v.int({min: 0}), note: null};
        expect(validateRecord({name: 'Ada', age: '36', note: 'x'}, fields)).toEqual({valid: true, value: {name: 'Ada', age: 36, note: 'x'}, errors: {}});
        const result = validateRecord({name: '', age: '-1'}, fields);
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual({name: 'Type a value.', age: 'Type a number that is 0 or more.'});
    });

    it('takes a list of fields', () => {
        expect(validateRecord({a: '1'}, [{key: 'a', validator: v.int()}]).value).toEqual({a: 1});
    });
});

describe('validatorsFromCsil', () => {
    const constrained = (base, ...constraints) => ({Constrained: {base: {Builtin: base}, constraints}});
    const field = (key, value, occurrence = null) => ({key: {Bare: key}, value, occurrence, metadata: []});
    const descriptor = {
        format: 'csil-schema',
        version: 'v1alpha1',
        body: {
            root: 'shop',
            services: [],
            rules: [
                {name: 'Username', definition: {Type: constrained('text', {Size: {Range: {min: 3, max: 50}}})}},
                {name: 'Size', definition: {Type: {Choice: [{Literal: {Text: 'small'}}, {Literal: {Text: 'large'}}]}}},
                {name: 'Order', definition: {Group: {entries: [
                    field('id', {Builtin: 'uuid'}),
                    field('owner', {Reference: 'Username'}),
                    field('quantity', constrained('uint', {LessEqual: {Integer: 100}})),
                    field('price', {Builtin: 'decimal'}),
                    field('size', {Reference: 'Size'}),
                    field('gift', {Builtin: 'bool'}, 'Optional'),
                    field('at', {Builtin: 'timestamp'}),
                    field('rating', {Range: {start: {Integer: 1}, end: {Integer: 5}, inclusive: true}}),
                    field('note', {Choice: [{Builtin: 'text'}, {Literal: 'Null'}]}),
                    field('tags', {Array: {element: {Builtin: 'text'}, occurrence: 'ZeroOrMore'}}),
                ]}}},
                {name: 'OrderAlias', definition: {Type: {Reference: 'Order'}}},
            ],
        },
    };

    it('makes a validator for each field of a record', () => {
        const fields = validatorsFromCsil(descriptor, 'Order');
        const byKey = Object.fromEntries(fields.map((item) => [item.key, item]));
        expect(fields.map((item) => item.key)).toEqual(['id', 'owner', 'quantity', 'price', 'size', 'gift', 'at', 'rating', 'note', 'tags']);
        expect(byKey.id.validator.kind).toBe('uuid');
        expect(byKey.owner.validator.parse('ab').reason).toBe('minLength');
        expect(byKey.owner.validator.parse('').reason).toBe('required');
        expect(byKey.quantity.validator.parse('101').reason).toBe('max');
        expect(byKey.quantity.validator.parse('-1').valid).toBe(false);
        expect(byKey.price.validator.kind).toBe('decimal');
        expect(byKey.size.validator.options.map((item) => item.value)).toEqual(['small', 'large']);
        expect(byKey.gift.required).toBe(false);
        expect(byKey.gift.validator.parse('').valid).toBe(true);
        expect(byKey.at.validator.kind).toBe('timestamp');
        expect(byKey.rating.validator.parse('6').reason).toBe('max');
        expect(byKey.note.validator.parse('').valid).toBe(true);
        expect(byKey.tags.validator).toBe(null);
    });

    it('follows a rule that names another rule, and reads a body alone', () => {
        expect(validatorsFromCsil(descriptor.body, 'OrderAlias').length).toBe(10);
    });

    it('refuses what is not a record', () => {
        expect(() => validatorsFromCsil(descriptor, 'Size')).toThrow('not a record type');
        expect(() => validatorsFromCsil(descriptor, 'Nope')).toThrow('No rule');
        expect(() => validatorsFromCsil({format: 'other'}, 'Order')).toThrow('Not a CSIL schema descriptor');
    });

    it('makes a date validator with the bounds of a CSIL date', () => {
        // The shape that csilgen 0.2.14 writes for `due: date .ge "2026-01-01" .lt "2027-01-01", ? start: date`
        const body = {rules: [{name: 'Task', definition: {Type: {Group: {entries: [
            field('due', constrained('date', {GreaterEqual: {Text: '2026-01-01'}}, {LessThan: {Text: '2027-01-01'}})),
            field('start', {Builtin: 'date'}, 'Optional'),
            field('bad', constrained('date', {GreaterEqual: {Text: '2026-02-30'}})),
        ]}}}}]};
        const [due, start, bad] = validatorsFromCsil(body, 'Task');
        expect(due.validator.kind).toBe('date');
        expect(due.validator.parse('2026-03-13')).toMatchObject({valid: true, value: '2026-03-13'});
        expect(due.validator.parse('2025-12-31').reason).toBe('min');
        expect(due.validator.parse('2027-01-01').reason).toBe('below');
        expect(due.validator.parse('2026-12-31').valid).toBe(true);
        expect(due.validator.parse('13.03.2026', {locale: 'de-DE'}).value).toBe('2026-03-13');
        expect(due.validator.parse('').reason).toBe('required');
        expect(start.required).toBe(false);
        expect(start.validator.parse('')).toMatchObject({valid: true, value: null});
        // A bound that is not a real date is not a limit
        expect(bad.validator.parse('2026-01-01').valid).toBe(true);
    });

    it('reads bigint literals from a CBOR decoder', () => {
        const body = {rules: [{name: 'R', definition: {Group: {entries: [field('n', constrained('int', {GreaterEqual: {Integer: 2n}}))]}}}]};
        expect(validatorsFromCsil(body, 'R')[0].validator.parse('1').reason).toBe('min');
    });
});

describe('locales', () => {
    it('reads the numbers of a locale, and only at parse time', () => {
        const de = {locale: 'de-DE'};
        expect(numberSeparators('de-DE')).toEqual({group: '.', decimal: ','});
        expect(ok(v.float().parse('1.234,5', de))).toBe(1234.5);
        expect(ok(v.float().parse('0,25', de))).toBe(0.25);
        expect(ok(v.int().parse('1.234', de))).toBe(1234);
        expect(ok(v.decimal({scale: 2}).parse('12,5', de))).toBe('12.50');
        // In German, "1.5" is not a number: a group needs three digits
        expect(bad(v.float().parse('1.5', de)).reason).toBe('type');
        expect(bad(v.int().parse('1,5', de)).reason).toBe('type');
        // With no locale, the text is in the 1,234.5 form
        expect(ok(v.float().parse('1,234.5'))).toBe(1234.5);
        // A space as the group sign can be typed as any space
        expect(ok(v.float().parse('1 234,5', {locale: 'fr-FR'}))).toBe(1234.5);
        expect(v.float().format(1234.5, de)).toBe('1234,5');
        expect(v.decimal().format('12.50', de)).toBe('12,50');
    });

    it('reads a date in the order of the locale, and ISO always', () => {
        expect(dateOrder('de-DE')).toEqual(['day', 'month', 'year']);
        expect(dateOrder('en-US')).toEqual(['month', 'day', 'year']);
        expect(ok(v.date().parse('21.11.2026', {locale: 'de-DE'}))).toBe('2026-11-21');
        expect(ok(v.date().parse('11/21/26', {locale: 'en-US'}))).toBe('2026-11-21');
        expect(ok(v.date().parse('2026-11-21', {locale: 'de-DE'}))).toBe('2026-11-21');
        expect(bad(v.date().parse('31.02.2026', {locale: 'de-DE'})).reason).toBe('type');
        expect(bad(v.date().parse('21.11.2026')).reason).toBe('type');
    });

    it('a timestamp with no offset uses the time zone of the validator', () => {
        const berlin = v.timestamp({timeZone: 'Europe/Berlin'});
        expect(ok(berlin.parse('2026-01-15 10:00')).toISOString()).toBe('2026-01-15T09:00:00.000Z');
        // Summer time
        expect(ok(berlin.parse('2026-07-15T10:00')).toISOString()).toBe('2026-07-15T08:00:00.000Z');
        // An offset in the text wins
        expect(ok(berlin.parse('2026-07-15T10:00Z')).toISOString()).toBe('2026-07-15T10:00:00.000Z');
        expect(ok(berlin.parse('15.07.2026 10:00', {locale: 'de-DE'})).toISOString()).toBe('2026-07-15T08:00:00.000Z');
        const local = v.timestamp({timeZone: 'local'}).parse('2026-07-15 10:00');
        expect(ok(local).getTime()).toBe(new Date(2026, 6, 15, 10, 0).getTime());
        expect(bad(v.timestamp({timeZone: 'Not/AZone'}).parse('2026-07-15 10:00')).reason).toBe('type');
    });
});

describe('messages', () => {
    it('a shared table changes the messages, and a validator or a parse context wins over it', () => {
        try {
            setValidatorMessages({required: 'Bitte einen Wert eingeben.', max: (limit) => `Höchstens ${limit}.`});
            expect(bad(v.int({required: true}).parse('')).message).toBe('Bitte einen Wert eingeben.');
            expect(bad(v.int({max: 3}).parse('4')).message).toBe('Höchstens 3.');
            expect(bad(v.int({max: 3}).parse('4', {messages: {max: 'Too big.'}})).message).toBe('Too big.');
            expect(bad(v.int({max: 3, messages: {max: 'Mine.'}}).parse('4', {messages: {max: 'Too big.'}})).message).toBe('Mine.');
            expect(bad(v.required(v.int()).parse('')).message).toBe('Bitte einen Wert eingeben.');
            expect(validatorMessages.required).toBe('Type a value.');
        } finally {
            setValidatorMessages(null);
        }
        expect(bad(v.int({required: true}).parse('')).message).toBe('Type a value.');
    });
});
