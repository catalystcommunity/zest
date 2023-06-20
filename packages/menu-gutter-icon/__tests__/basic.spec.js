import { describe, it, expect } from 'vitest';
import MenuGutterIcon from '../src';

describe('basic test', () => {
    it('should get the hello', () => {
        expect(MenuGutterIcon()).toBe('Hello from MenuGutterIcon');
    })
});
