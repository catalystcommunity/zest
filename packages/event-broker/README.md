# `EventBroker`

An in-browser publish and subscribe, with custom events on the document.

## Usage

```js
import EventBroker from '@catalystcommunity/event-broker';

const broker = new EventBroker();
const stop = broker.SubscribeEvent('saved', 'my-subscriber', (eventName, detail) => console.log(detail));
broker.FireEvent('saved', { id: 7 });
stop();                                              // or: broker.UnsubscribeEvent('saved', 'my-subscriber')
broker.cleanup();                                    // removes each subscription
```

A subscriber has one callback for each event. If it subscribes again, the new callback replaces the old one. The removal function from the old subscribe then does nothing.

## Components

A subscription is a listener on the target. It holds the callback, and thus the component, until it is removed. In a component, give the removal function to `this.own` in `connectedCallback`:

```js
this.own(broker.SubscribeEvent('saved', `saved-${this.instanceId}`, (name, detail) => this.invalidate(), {
  isActive: () => this.isActive(),
}));
```

`isActive` is a second guard. Before each call, the broker calls `isActive()`. If the result is not `true`, the broker removes the subscription and does not call the callback. It removes the subscription only at the next event, so also use `own`.

## The Target

By default the events go through `document`, so a broker hears each event that bubbles there, such as the events of a `date-time-picker`. To keep application messages apart from the page, give the broker its own target: `new EventBroker(new EventTarget())`.
