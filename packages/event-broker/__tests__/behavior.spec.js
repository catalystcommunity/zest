import { describe, it, expect, vi } from 'vitest';
import EventBroker from '../src';

describe('EventBroker', () => {
    it('replaces the callback when a subscriber subscribes again', () => {
        const eb = new EventBroker();
        const first = vi.fn();
        const second = vi.fn();
        eb.SubscribeEvent('again', 'sub', first);
        eb.SubscribeEvent('again', 'sub', second);
        eb.FireEvent('again', {});
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledOnce();
        expect(eb.subscriberStats.count).toEqual(1);
        eb.cleanup();
    });

    it('stops calling after one unsubscribe, even after a repeated subscribe', () => {
        const eb = new EventBroker();
        const callback = vi.fn();
        eb.SubscribeEvent('leak', 'sub', callback);
        eb.SubscribeEvent('leak', 'sub', callback);
        eb.UnsubscribeEvent('leak', 'sub');
        eb.FireEvent('leak', {});
        expect(callback).not.toHaveBeenCalled();
    });

    it('returns false when it unsubscribes from an event with no subscribers', () => {
        const eb = new EventBroker();
        expect(eb.UnsubscribeEvent('neverseen', 'sub')).toEqual(false);
        eb.SubscribeEvent('seen', 'sub', () => {});
        expect(eb.UnsubscribeEvent('seen', 'someoneelse')).toEqual(false);
        eb.cleanup();
    });

    it('removes the listeners and updates the stats on cleanup', () => {
        const eb = new EventBroker();
        const callback = vi.fn();
        eb.SubscribeEvent('clean', 'a', callback);
        eb.SubscribeEvent('clean', 'b', callback);
        eb.cleanup();
        eb.FireEvent('clean', {});
        expect(callback).not.toHaveBeenCalled();
        expect(eb.subscriberStats).toEqual({count: 0, added: 2, removed: 2});
        expect(eb.events.size).toEqual(0);
    });

    it('gives the data to each subscriber', () => {
        const eb = new EventBroker();
        const a = vi.fn();
        const b = vi.fn();
        eb.SubscribeEvent('both', 'a', a);
        eb.SubscribeEvent('both', 'b', b);
        eb.FireEvent('both', {value: 1});
        expect(a).toHaveBeenCalledWith('both', {value: 1});
        expect(b).toHaveBeenCalledWith('both', {value: 1});
        eb.cleanup();
    });

    it('refuses bad inputs', () => {
        const eb = new EventBroker();
        expect(() => eb.SubscribeEvent('a', 'b', 'notfunction')).toThrow();
        expect(() => eb.UnsubscribeEvent(1, 'b')).toThrow();
    });
});
