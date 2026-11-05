import { describe, it, expect, vi } from 'vitest';
import BasicDataService from '../src';

function collect(service, options) {
    const seen = [];
    service.subscribe(detail => seen.push(detail), options);
    return seen;
}

describe('the store', () => {
    it('gives back what it holds', () => {
        const service = new BasicDataService();
        service.set('people', 'a', {name: 'Ada'});
        expect(service.get('people', 'a')).toEqual({name: 'Ada'});
        expect(service.list('people')).toEqual([['a', {name: 'Ada'}]]);
        expect(service.get('people', 'b')).toBeUndefined();
        expect(service.list('nothing')).toEqual([]);
    });

    it('publishes the collection, the key, and the old and new values', () => {
        const service = new BasicDataService();
        const seen = collect(service);
        service.set('people', 'a', 1);
        service.set('people', 'a', 2);
        service.remove('people', 'a');
        expect(seen).toEqual([
            {collection: 'people', changes: [{key: 'a', oldValue: undefined, newValue: 1}]},
            {collection: 'people', changes: [{key: 'a', oldValue: 1, newValue: 2}]},
            {collection: 'people', changes: [{key: 'a', oldValue: 2, newValue: undefined}]},
        ]);
    });

    it('publishes nothing when nothing changes', () => {
        const service = new BasicDataService();
        service.set('people', 'a', 1);
        const seen = collect(service);
        service.set('people', 'a', 1);
        service.remove('people', 'missing');
        expect(seen).toEqual([]);
    });

    it('publishes a stored undefined as a new key, and a real event for a plain listener', () => {
        const service = new BasicDataService();
        const listener = vi.fn();
        service.addEventListener('data-changed', listener);
        service.set('people', 'a', 1);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].detail.collection).toEqual('people');
    });
});

describe('a transaction', () => {
    it('sends one event for each collection, with one change for each key', () => {
        const service = new BasicDataService();
        service.set('people', 'a', 1);
        const seen = collect(service);
        service.transaction(() => {
            service.set('people', 'a', 2);
            service.set('people', 'a', 3);
            service.set('people', 'b', 9);
            service.set('rooms', 'r', 5);
        });
        expect(seen).toEqual([
            {collection: 'people', changes: [{key: 'a', oldValue: 1, newValue: 3}, {key: 'b', oldValue: undefined, newValue: 9}]},
            {collection: 'rooms', changes: [{key: 'r', oldValue: undefined, newValue: 5}]},
        ]);
    });

    it('leaves out a key that ends at its first value', () => {
        const service = new BasicDataService();
        service.set('people', 'a', 1);
        const seen = collect(service);
        service.transaction(() => {
            service.set('people', 'a', 2);
            service.set('people', 'a', 1);
        });
        expect(seen).toEqual([]);
    });

    it('waits for the outer transaction, and publishes what changed before a throw', () => {
        const service = new BasicDataService();
        const seen = collect(service);
        expect(() => service.transaction(() => {
            service.transaction(() => service.set('people', 'a', 1));
            expect(seen).toEqual([]);
            throw new Error('stop');
        })).toThrow('stop');
        expect(seen).toHaveLength(1);
    });

    it('lets a subscriber change the store while it hears a change', () => {
        const service = new BasicDataService();
        service.subscribe(() => service.set('counts', 'people', service.list('people').length), {collection: 'people'});
        service.set('people', 'a', 1);
        expect(service.get('counts', 'people')).toBe(1);
    });

    it('sends a change made during a send after that send, so each subscriber hears the changes in order', () => {
        const service = new BasicDataService();
        service.subscribe(({changes}) => { if (changes[0].newValue === 1) { service.set('c', 'n', 2); } });
        const seen = collect(service);
        service.set('c', 'n', 1);
        expect(seen.map(({changes}) => changes[0].newValue)).toEqual([1, 2]);
        expect(service.get('c', 'n')).toBe(2);
    });

    it('continues to send after a subscriber throws', () => {
        const service = new BasicDataService();
        const errors = [];
        const onError = (event) => { errors.push(event.error); event.preventDefault(); };
        window.addEventListener('error', onError);
        service.subscribe(() => { throw new Error('subscriber failed'); });
        const seen = collect(service);
        service.set('c', 'n', 1);
        service.set('c', 'n', 2);
        window.removeEventListener('error', onError);
        expect(seen).toHaveLength(2);
    });

    it('tells if it holds a key, also a key with an undefined value', () => {
        const service = new BasicDataService();
        service.set('people', 'a', undefined);
        expect(service.has('people', 'a')).toBe(true);
        expect(service.has('people', 'b')).toBe(false);
        expect(service.has('nothing', 'a')).toBe(false);
    });

    it('clears a collection in one event', () => {
        const service = new BasicDataService();
        service.set('people', 'a', 1);
        service.set('people', 'b', 2);
        const seen = collect(service);
        service.clear('people');
        service.clear('nothing');
        expect(service.list('people')).toEqual([]);
        expect(seen).toEqual([{collection: 'people', changes: [
            {key: 'a', oldValue: 1, newValue: undefined},
            {key: 'b', oldValue: 2, newValue: undefined},
        ]}]);
    });

    it('replaces a collection in one event, with only the keys that change', () => {
        const service = new BasicDataService();
        service.set('people', 'kept', 1);
        service.set('people', 'changed', 2);
        service.set('people', 'gone', 3);
        const seen = collect(service);
        service.replace('people', [['kept', 1], ['changed', 20], ['new', 4]]);
        expect(service.list('people')).toEqual([['kept', 1], ['changed', 20], ['new', 4]]);
        expect(seen).toEqual([{collection: 'people', changes: [
            {key: 'gone', oldValue: 3, newValue: undefined},
            {key: 'changed', oldValue: 2, newValue: 20},
            {key: 'new', oldValue: undefined, newValue: 4},
        ]}]);
        service.replace('people', new Map(service.list('people')));
        expect(seen).toHaveLength(1);
    });
});

describe('subscribe', () => {
    it('filters by collection and by key', () => {
        const service = new BasicDataService();
        const byKey = collect(service, {collection: 'people', keys: ['a']});
        service.transaction(() => {
            service.set('people', 'a', 1);
            service.set('people', 'b', 2);
            service.set('rooms', 'a', 3);
        });
        expect(byKey).toEqual([{collection: 'people', changes: [{key: 'a', oldValue: undefined, newValue: 1}]}]);
    });

    it('lets a component decide with a filter what it renders', () => {
        const service = new BasicDataService();
        const seen = collect(service, {filter: change => change.newValue?.visible});
        service.set('items', 'hidden', {visible: false});
        expect(seen).toEqual([]);
        service.set('items', 'shown', {visible: true});
        expect(seen).toHaveLength(1);
    });

    it('stops with the function that it returns', () => {
        const service = new BasicDataService();
        const handler = vi.fn();
        const stop = service.subscribe(handler);
        stop();
        service.set('people', 'a', 1);
        expect(handler).not.toHaveBeenCalled();
    });

    it('removes itself when isActive is not true, and does not call the handler', () => {
        const service = new BasicDataService();
        const handler = vi.fn();
        const isActive = vi.fn(() => true);
        service.subscribe(handler, {isActive});
        service.set('people', 'a', 1);
        expect(handler).toHaveBeenCalledOnce();
        isActive.mockReturnValue('yes');
        service.set('people', 'a', 2);
        isActive.mockReturnValue(true);
        service.set('people', 'a', 3);
        expect(handler).toHaveBeenCalledOnce();
        expect(isActive).toHaveBeenCalledTimes(2);
    });

    it('does not call a subscriber that an earlier subscriber removes during the same send', () => {
        const service = new BasicDataService();
        const later = vi.fn();
        let stopLater;
        service.subscribe(() => stopLater());
        stopLater = service.subscribe(later);
        service.set('people', 'a', 1);
        expect(later).not.toHaveBeenCalled();
    });
});

describe('listen', () => {
    it('updates from an event, in one transaction, and stops with the function that it returns', () => {
        const service = new BasicDataService();
        const bus = new EventTarget();
        const seen = collect(service);
        const stop = service.listen(bus, 'people-loaded', (detail, store) => {
            for (const person of detail) { store.set('people', person.id, person); }
        });
        bus.dispatchEvent(new CustomEvent('people-loaded', {detail: [{id: 'a'}, {id: 'b'}]}));
        expect(seen).toHaveLength(1);
        expect(seen[0].changes.map(change => change.key)).toEqual(['a', 'b']);
        stop();
        bus.dispatchEvent(new CustomEvent('people-loaded', {detail: [{id: 'c'}]}));
        expect(service.get('people', 'c')).toBeUndefined();
    });

    it('removes itself when isActive is not true', () => {
        const service = new BasicDataService();
        const bus = new EventTarget();
        const removed = vi.spyOn(bus, 'removeEventListener');
        const reducer = vi.fn();
        service.listen(bus, 'people-loaded', reducer, {isActive: () => false});
        bus.dispatchEvent(new CustomEvent('people-loaded', {detail: []}));
        expect(reducer).not.toHaveBeenCalled();
        expect(removed).toHaveBeenCalledOnce();
    });
});

describe('a broker', () => {
    it('also gets each change, and the event name can change', () => {
        const FireEvent = vi.fn();
        const service = new BasicDataService({broker: {FireEvent}, eventName: 'store-changed'});
        const seen = collect(service);
        service.set('people', 'a', 1);
        expect(seen).toHaveLength(1);
        expect(FireEvent).toHaveBeenCalledWith('store-changed', seen[0]);
    });
});
