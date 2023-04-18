'use strict';

const eventBroker = require('..');
const assert = require('assert').strict;

assert.strictEqual(eventBroker(), 'Hello from eventBroker');
console.info('eventBroker tests passed');
