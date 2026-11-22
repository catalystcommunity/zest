// The gallery section of @catalystcommunity/validators: type a value for each core CSIL type, and
// see the value or the message.
import {validators as v} from '../../src/index.js';
import {card, el} from '../kit.js';

export const definitions = {};

const KINDS = [
  ['int', 'int({min: 0, max: 120})', v.int({min: 0, max: 120}), '36'],
  ['uint', 'uint({bigint: true})', v.uint({bigint: true}), '18446744073709551615'],
  ['float', 'float()', v.float(), '3.14'],
  ['decimal', 'decimal({scale: 2})', v.decimal({scale: 2}), '12.5'],
  ['text', "text({minLength: 3, pattern: '[a-z]+'})", v.text({minLength: 3, pattern: '[a-z]+'}), 'zest'],
  ['bool', 'bool()', v.bool(), 'yes'],
  ['bytes', 'bytes()', v.bytes(), 'DE AD BE EF'],
  ['timestamp', 'timestamp()', v.timestamp(), '2026-03-13T09:30:00Z'],
  ['date', 'date()', v.date(), '2026-02-29'],
  ['uuid', 'uuid()', v.uuid(), '123e4567-e89b-12d3-a456-426614174000'],
  ['enum', "oneOf(['Small', 'Medium', 'Large'])", v.oneOf(['Small', 'Medium', 'Large']), 'medium'],
];

function show(value) {
  if (value instanceof Uint8Array) { return `Uint8Array [${[...value].join(', ')}]`; }
  if (value instanceof Date) { return `Date ${value.toISOString()}`; }
  if (typeof value === 'bigint') { return `${value}n`; }
  return JSON.stringify(value);
}

function row([kind, code, validator, sample]) {
  const id = `validator-${kind}`;
  const input = el('input', {id, value: sample, 'data-testid': `${id}-input`, autocomplete: 'off', spellcheck: 'false'});
  input.inputMode = validator.inputMode;
  const output = el('output', {for: id, 'data-testid': `${id}-output`});
  const update = () => {
    const result = validator.parse(input.value);
    output.textContent = result.valid ? `value ${show(result.value)}` : `${result.reason}: ${result.message}`;
    output.classList.toggle('invalid', !result.valid);
    input.setAttribute('aria-invalid', String(!result.valid));
  };
  input.addEventListener('input', update);
  update();
  return el('div', {class: 'validator-row', style: 'display: grid; grid-template-columns: minmax(0, 14em) minmax(0, 1fr); gap: 0.25em 1em; align-items: center; margin-block: 0.5em;'},
    el('label', {for: id}, el('code', {}, code)), input, el('span'), output);
}

export const section = {
  id: 'validators',
  title: 'Validators',
  render: () => [
    card('validators-types', 'Read typed text for each core CSIL type',
      el('p', {}, 'Change a value. The result shows the typed value, or the reason and the message of the problem.'),
      ...KINDS.map(row)),
  ],
};
