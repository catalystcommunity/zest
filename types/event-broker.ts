// Uses the declarations as an application does. tsc checks it; nothing runs it.
import EventBroker from '@catalystcommunity/event-broker';

interface Saved { id: number; }

const broker = new EventBroker();
const local = new EventBroker(new EventTarget());
const stop: () => void = broker.SubscribeEvent<Saved>('saved', 'my-subscriber', (eventName, detail) => {
    const id: number = detail.id;
    void [eventName, id];
}, {isActive: () => true});
broker.FireEvent('saved', {id: 7});
const removed: boolean = broker.UnsubscribeEvent('saved', 'my-subscriber');
stop();
local.cleanup();
void [removed, broker.subscriberStats.count];
