import { describe, it, expect } from 'vitest';
import MenuLogo from '../src';

describe('basic test', () => {
    it('should get the hello', () => {
        expect(MenuLogo()).toBe('Hello from MenuLogo');
    })
});
