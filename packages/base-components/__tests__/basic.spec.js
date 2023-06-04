import { describe, it, expect } from 'vitest';
import {BaseComponent, DataComponent, OpenShadowDataComponent} from '../src';

describe('basic test', () => {
    it('should get the hello', () => {
        expect(BaseComponent()).toBe('Hello from BaseComponents');
    })
});
