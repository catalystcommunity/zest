import { describe, it, expect } from 'vitest';
import MenuGutter from '../src';

describe('basic test', () => {
    it('should get the hello', () => {
        expect(MenuGutter()).toBe('Hello from MenuGutter');
    })
});
