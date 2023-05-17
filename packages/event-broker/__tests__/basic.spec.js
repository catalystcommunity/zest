import { describe, it, expect } from 'vitest';
import EventBroker from '../src';

describe('basic test', () => {
    it('should get the hello', () => {
        expect(EventBroker()).toBe('Hello from EventBroker');
    })
});
