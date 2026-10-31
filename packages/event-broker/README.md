# `EventBroker`

An in-browser publish and subscribe, with custom events on the document.

## Usage

```js
import EventBroker from '@catalystcommunity/event-broker';

const broker = new EventBroker();
broker.SubscribeEvent('saved', 'my-subscriber', (eventName, detail) => console.log(detail));
broker.FireEvent('saved', { id: 7 });
broker.UnsubscribeEvent('saved', 'my-subscriber');   // true if it removed something
broker.cleanup();                                    // removes each subscription
```

A subscriber has one callback for each event. If it subscribes again, the new callback replaces the old one.
