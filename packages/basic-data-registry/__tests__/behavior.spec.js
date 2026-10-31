import { describe, it, expect } from 'vitest';
import BasicDataRegistry from '../src';

describe('BasicDataRegistry', () => {
    it('refuses a name that is already registered', () => {
        const dr = new BasicDataRegistry();
        dr.AddDataFunction('myFunc', () => {});
        expect(() => dr.AddDataFunction('myFunc', () => {})).toThrow(/already registered/);
    });

    it('refuses a name that would replace its own method', () => {
        const dr = new BasicDataRegistry();
        expect(() => dr.AddDataFunction('AddDataFunction', () => {})).toThrow();
    });

    it('refuses a thing that is not a function', () => {
        const dr = new BasicDataRegistry();
        expect(() => dr.AddDataFunction('myFunc', 'text')).toThrow(/not a function/);
        expect(dr.myFunc).toBeUndefined();
    });
});
