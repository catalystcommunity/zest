import { describe, it, expect } from 'vitest';
import TwoTierSectionMenu from '../src';

describe('basic test', () => {
    it('should get the hello', () => {
        expect(TwoTierSectionMenu()).toBe('Hello from TwoTierSectionMenu');
    })
});
