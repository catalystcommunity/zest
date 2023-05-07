// tests/aboutPage.spec.ts

import {describe, expect, beforeEach, it} from '@jest/globals';
import TestCompA from "../src";
import fs from 'fs';
import path from 'path';
const html = fs.readFileSync(path.resolve(__dirname, './test.html'), 'utf8');

jest.dontMock('fs');

describe("TestCompA", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html.toString();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should initialize correctly", () => {
    const testComp = new TestCompA();
    expect(testComp).toBeInstanceOf(TestCompA);
  });

});

