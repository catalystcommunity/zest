import { describe, it, expect } from 'vitest';
import MenuItem from '../src';

describe('basic test', () => {
    it('should get the hello', () => {
        expect(MenuItem()).toBe('Hello from MenuItem');
    })
});
