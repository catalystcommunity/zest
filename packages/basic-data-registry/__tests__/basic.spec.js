import { describe, it, expect } from 'vitest';
import BasicDataRegistry from '../src';

describe('basic test', () => {
    it('should instantiate a registry and be able to add callable functions', () => {
        let dr = new BasicDataRegistry();
        expect(dr).toBeInstanceOf(BasicDataRegistry);
        expect(dr.myDataFunc).toBeUndefined();
        dr.AddDataFunction('myDataFunc', (id, somedata) => {return id+'-'+somedata})
        expect(dr.myDataFunc).not.toBeUndefined();
        expect(dr.myDataFunc).toBeTypeOf('function');
        expect(dr.myDataFunc('foo', 'bar')).toEqual('foo-bar');
    })
});
