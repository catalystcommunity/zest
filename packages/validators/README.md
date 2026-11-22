# `validators`

Validators for the core CSIL types. A validator reads the text that a person typed and gives the typed value, or a message that tells the problem. The package has no DOM, so a form, a spreadsheet, and a server can use the same validators.

## Usage

```js
import { validators as v, validateRecord } from '@catalystcommunity/validators';

const quantity = v.uint({max: 100});
quantity.parse('12');   // {valid: true, value: 12}
quantity.parse('120');  // {valid: false, reason: 'max', message: 'Type a number that is 100 or less.'}
quantity.parse('');     // {valid: true, value: null}

const order = {item: v.text({required: true}), quantity, price: v.decimal({scale: 2})};
validateRecord({item: 'Pens', quantity: '12', price: '1.5'}, order);
// {valid: true, value: {item: 'Pens', quantity: 12, price: '1.50'}, errors: {}}
```

## Design

- **Parse, not only check.** `parse(text)` gives the value that goes to the server: a `number` for `int`, a `Date` for `timestamp`, a `Uint8Array` for `bytes`. These are the types of the TypeScript code that csilgen makes.
- **An empty input is valid and gives `null`.** Give `required: true` to refuse it. A spreadsheet cell or a form field with no text is then a problem.
- **Each result has a reason and a message.** The reason is stable, for example `'max'`, so that code can read it. The message is a short sentence for a person. Give `messages: {max: (limit) => '...'}` to change it.
- **No state.** A validator is a plain object. You can make one validator and use it for each field of a column, or for each request on a server.
- **Fast.** A validator compiles its regular expressions one time. `oneOf` makes a map one time, so that a list of 10,000 options costs one lookup for each input.

## Validators

Each validator takes `required`, `test`, and `messages`. `test(value)` runs after the other checks. It gives a message for a problem, or `null`.

| Validator | Reads | Value | Options |
| --- | --- | --- | --- |
| `int()` | `42`, `-17`, `1,234` | `number` | `min`, `max`, `above`, `below`, `equal`, `notEqual`, `bigint` |
| `uint()` | `0`, `42` | `number` | The same as `int`. `min` is 0. |
| `float()` | `3.14`, `-.5`, `1e3` | `number` | The limits, and `finite` (default `true`) |
| `decimal()` | `12.5`, `0012` | text, such as `"12.50"` | `scale`, `min`, `max`, `above`, `below` |
| `text()` | any text | `string` | `minLength`, `maxLength` (Unicode code points), `pattern`, `trim` (default `true`) |
| `bool()` | `TRUE`, `FALSE`, `yes`, `no`, `1`, `0`, `on`, `off`, `x` | `boolean` | |
| `bytes()` | `DE AD BE EF`, `0x0102` | `Uint8Array` | `encoding` (`'hex'` or `'base64'`), `minLength`, `maxLength` (bytes) |
| `timestamp()` | `2026-03-13T09:30:00Z`, `2026-03-13 09:30+02:00` | `Date` | `min`, `max`, `timeZone` |
| `date()` | `2026-03-13`, and `13.03.2026` with a German locale | text, such as `"2026-03-13"` | `min`, `max`, `above`, `below` |
| `uuid()` | `123e4567-e89b-12d3-a456-426614174000` | lower-case text | |
| `oneOf(list)` | the label or the value of an option, with no case | the value of the option | `caseSensitive` |
| `any()` | any text | `string` | |

- `int` refuses a number outside the safe range of a JavaScript number (more than 2^53). Give `bigint: true` to get a `bigint` for each value, also for a small one.
- `decimal` gives text, so that no digit is lost. With `scale: 2`, the text has exactly two decimals, and an input with more decimals that are not zero is a problem.
- `timestamp` needs `Z` or an offset, so that the time does not change with the time zone of the computer that reads it. The reason of the problem is then `'offset'`. Give `timeZone: 'Europe/Berlin'` (a name of the IANA time zone database) or `timeZone: 'local'` to read a time with no offset in that zone. The validator finds the offset of that date, also in summer time. An offset in the text wins. Use `date` for a calendar date with no time.
- An item of `oneOf` is a value, or `{value, label}`. The validator has `options` and `labelOf(value)`, so that a list or a type-ahead can show the labels.
- `v.required(validator)` and `v.optional(validator)` make a copy that refuses or accepts an empty input.
- With no locale, numbers use the `1,234.5` form, and dates are ISO. See "Locales".

Each validator also has:

- `kind`: the name of the type, such as `'int'` or `'enum'`.
- `check(value)`: checks a value that is already typed, for example from a server. A text goes through `parse`.
- `format(value)`: the text for a value, which `parse` reads back to the same value. `bool` gives `TRUE` or `FALSE`, `bytes` gives hexadecimal, and `oneOf` gives the label.
- `inputMode`: `'numeric'`, `'decimal'`, or `'text'`, for the `inputmode` of a field.

## Locales

The parse of a text takes a context: `parse(text, {locale})`. The locale is the locale of the text, not of the validator. So one validator reads the text of a German person in a form, and the exact data on a server:

```js
const price = v.decimal({scale: 2});
price.parse('1.234,5', {locale: 'de-DE'});  // {valid: true, value: '1234.50'}
price.parse('1234.5');                      // {valid: true, value: '1234.50'}
price.format('1234.50', {locale: 'de-DE'}); // '1234,50'
```

- **Numbers.** The decimal sign and the group sign come from `Intl.NumberFormat` of the locale. The validator finds them one time for each locale. A group sign must stand before a group of 3 digits, so that `1.5` in German is a problem, not 15. A group sign that is a space can be typed as any space.
- **Dates.** `date` and `timestamp` read the order of the locale, for example `13.03.2026` in German and `3/13/2026` in American English. A year of two digits is in 2000 to 2099. ISO text always works.
- **A locale is explicit.** In German, `1.234` is 1234. With no locale, it is 1.234. So a validator never guesses the locale. Give the locale of the person for typed text, and no locale for data from a server or a file in the canonical form.
- `format(value, {locale})` writes a number with the decimal sign of the locale and no group signs, so that `parse` with the same locale reads it back.
- `numberSeparators(locale)` gives `{group, decimal}`, and `dateOrder(locale)` gives the order of the parts of a date.

## Messages

The messages are short English sentences. Each problem has a reason, for example `'max'`, and the message comes from the first of these that has the reason:

1. `messages` of the validator: `v.int({max: 10, messages: {max: 'Ten or less.'}})`.
2. `messages` of the parse context: `parse(text, {messages})`. A spreadsheet gives its own table here.
3. The shared table of the application, from `setValidatorMessages(table)`. `setValidatorMessages(null)` removes it.
4. The defaults. `validatorMessages` has them, with their reasons.

A message for a limit can be a function of the limit. The second argument is the kind of the validator, for example `'date'`, so that one function can write a message for numbers and for dates:

```js
import { setValidatorMessages } from '@catalystcommunity/validators';

setValidatorMessages({
  required: 'Bitte einen Wert eingeben.',
  max: (limit) => `Höchstens ${limit}.`,
});
```

## Records

`validateRecord(record, fields)` validates each field of an object. `fields` is `{key: validator}` or `[{key, validator}]`. A field with a `null` validator keeps its value. The result is `{valid, value, errors}`. `errors` has a message for each field with a problem.

## CSIL Schema Descriptors

`validatorsFromCsil(schema, ruleName)` makes a validator for each field of a CSIL record type. `schema` is the schema descriptor that `csilgen generate` writes, after you decode its CBOR, or only its `body`. The result is `[{key, validator, required}]`, in the order of the fields.

```js
const fields = validatorsFromCsil(descriptor, 'Order');
sheet.setColumns(fields.map(({key, validator}) => ({key, title: key, validate: validator})));
```

| CSIL | Validator |
| --- | --- |
| `int`, `uint`, `float`, `float16`, `float32`, `float64` | `int`, `uint`, `float` |
| `text`, `tstr`, `bytes`, `bstr`, `bool` | `text`, `bytes`, `bool` |
| `timestamp`, `date`, `decimal`, `uuid`, `any` | `timestamp`, `date`, `decimal`, `uuid`, `any` |
| `.size`, `.regex`, `.ge`, `.le`, `.gt`, `.lt`, `.eq`, `.ne` | `minLength`, `maxLength`, `pattern`, `min`, `max`, `above`, `below`, `equal`, `notEqual` |
| `1..10`, `1...10` | `int` or `float` with `min` and `max` or `below` |
| `"small" / "large"` | `oneOf` |
| A reference to a rule | The validator of that rule |
| `?` on a field, or `type / null` | `required` is false |

A CSIL `date` is a calendar day, and its validator gives ISO text (`"2026-03-13"`), as the csilgen TypeScript code does. It does not give a `Date`: a `Date` at UTC midnight shows the day before in time zones west of UTC. The bounds of a date, such as `date .ge "2026-01-01" .lt "2027-01-01"`, become `min` and `below`.

A field that has no text form, such as an array or a map, has `validator: null`. A CBOR decoder can give an integer literal as a `bigint`; the validators read it as a number.
