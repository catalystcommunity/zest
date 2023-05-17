import { describe, it, expect } from 'vitest';
import SimpleRouter from '../src';

describe('basic test', () => {
    it('should get the hello', () => {
        expect(SimpleRouter()).toBe('Hello from SimpleRouter');
    })
});
