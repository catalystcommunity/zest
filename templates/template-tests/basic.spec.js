import { describe, it, expect } from 'vitest';
import REPLACEME from '../src';

describe('basic test', () => {
    it('should get the hello', () => {
        expect(REPLACEME()).toBe('Hello from REPLACEME');
    })
});
