import { describe, it, expect, vi, afterEach } from 'vitest';
import {BaseComponent, BasicDataService, EventBroker} from '../src/index.js';

// A component that uses the store, the broker, and the document, as an application component does
const store = new BasicDataService();
const broker = new EventBroker(new EventTarget());
const heard = vi.fn();

class CleanupComponent extends BaseComponent {
    connectedCallback() {
        super.connectedCallback();
        this.own(store.subscribe(() => heard('store'), {collection: 'items'}));
        this.own(broker.SubscribeEvent('item-saved', `cleanup-${this.id}`, () => heard('broker')));
        this.listen(document, 'item-clicked', () => heard('document'));
    }
}
customElements.define('cleanup-component', CleanupComponent);

// Only the safety check, with no own(): the subscriptions remove themselves at the next event
class ForgetfulComponent extends BaseComponent {
    connectedCallback() {
        super.connectedCallback();
        store.subscribe(() => heard('store'), {collection: 'items', isActive: () => this.isActive()});
        broker.SubscribeEvent('item-saved', `forgetful-${this.id}`, () => heard('broker'), {isActive: () => this.isActive()});
    }
}
customElements.define('forgetful-component', ForgetfulComponent);

function sendAll(value) {
    store.set('items', 'a', value);
    broker.FireEvent('item-saved', {});
    document.dispatchEvent(new Event('item-clicked'));
}

describe('cleanup when components leave the page', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        broker.cleanup();
        store.clear('items');
    });

    it('calls nothing and keeps no subscription after many connects and disconnects', () => {
        const added = vi.spyOn(store, 'addEventListener');
        const removed = vi.spyOn(store, 'removeEventListener');
        const components = Array.from({length: 50}, (_, i) => {
            const comp = document.createElement('cleanup-component');
            comp.id = `c${i}`;
            return comp;
        });
        for (let round = 0; round < 20; round++) {
            for (const comp of components) { document.body.appendChild(comp); }
            for (const comp of components) { comp.remove(); }
        }
        heard.mockClear();
        sendAll(1);
        expect(heard).not.toHaveBeenCalled();
        expect(broker.subscriberStats.count).toEqual(0);
        expect(added.mock.calls.length).toEqual(removed.mock.calls.length);
    });

    it('calls each connected component one time for each event', () => {
        const comps = ['x', 'y'].map(id => Object.assign(document.createElement('cleanup-component'), {id}));
        for (const comp of comps) { document.body.appendChild(comp); }
        comps[0].remove();
        document.body.appendChild(comps[0]);
        heard.mockClear();
        sendAll(2);
        expect(heard.mock.calls.map(([source]) => source).sort()).toEqual(['broker', 'broker', 'document', 'document', 'store', 'store']);
    });

    it('does not call a component that forgot to own its subscriptions, and drops them at the next event', () => {
        const comp = Object.assign(document.createElement('forgetful-component'), {id: 'f'});
        document.body.appendChild(comp);
        comp.remove();
        heard.mockClear();
        sendAll(3);
        expect(heard).not.toHaveBeenCalled();
        expect(broker.subscriberStats.count).toEqual(0);
    });
});
