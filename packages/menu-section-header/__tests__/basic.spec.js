import { describe, it, expect } from 'vitest';
import MenuSectionHeader from '../src';

describe('basic test', () => {
    it('should get the hello', () => {
        expect(MenuSectionHeader()).toBe('Hello from MenuSectionHeader');
    })
});
