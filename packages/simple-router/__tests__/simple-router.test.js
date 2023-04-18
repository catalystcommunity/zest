'use strict';

const simpleRouter = require('..');
const assert = require('assert').strict;

assert.strictEqual(simpleRouter(), 'Hello from simpleRouter');
console.info('simpleRouter tests passed');
