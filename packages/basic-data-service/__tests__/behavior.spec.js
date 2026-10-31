import { describe, it, expect } from 'vitest';
import BasicDataService from '../src';

describe('BasicDataService', () => {
    it('gives each instance its own data', () => {
        const first = new BasicDataService();
        const second = new BasicDataService();
        first.data.value = 1;
        expect(second.data.value).toBeUndefined();
    });
});
