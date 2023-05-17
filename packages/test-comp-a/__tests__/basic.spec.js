import { describe, it, expect } from 'vitest';
import TestCompA from '../src/index';

describe('basic test', () => {
    it('should get the hello', () => {
        expect(TestCompA()).toBe('Hello from TestCompA');
    })
});
