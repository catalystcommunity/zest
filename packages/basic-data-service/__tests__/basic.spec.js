import { describe, it, expect} from 'vitest';
import BasicDataService from '../src';

describe('BasicDataService', () => {
    it("should initialize correctly", () => {
        const eb = new BasicDataService();
        expect(eb).toBeInstanceOf(BasicDataService);
    });
});
