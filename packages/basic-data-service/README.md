# `BasicDataService`

A store of data for components, so that components do not hold state. Events update the store. The store publishes each change, and each component decides what the change means to it.

## Usage

```js
import BasicDataService from '@catalystcommunity/basic-data-service';

const store = new BasicDataService();

// Events go in. All the changes from one event go out as one change event.
store.listen(document, 'bookings-loaded', (bookings, service) => {
  service.replace('bookings', bookings.map(booking => [booking.id, booking]));
});

// A component hears only what it renders, and stops when it disconnects
class BookingCount extends BaseComponent {
  connectedCallback() {
    super.connectedCallback();
    this.own(store.subscribe(() => this.invalidate(), {
      collection: 'bookings',
      filter: (change) => change.newValue?.room === this.getAttribute('room') || change.oldValue?.room === this.getAttribute('room'),
    }));
    this.render();
  }
  render() {
    this.textContent = store.list('bookings').filter(([, b]) => b.room === this.getAttribute('room')).length;
  }
}
```

## Methods

- `get(collection, key)`, `has(collection, key)`, and `list(collection)`, which gives `[key, value]` pairs.
- `set(collection, key, value)` and `remove(collection, key)`.
- `clear(collection)` removes each key, in one event.
- `replace(collection, entries)` makes the collection hold only the given `[key, value]` pairs, in one event. A key with the same value is not in the event. Use it when the application sends a full set of new data.
- `transaction(fn)`: see below.
- `listen(target, eventName, reducer, options)` and `subscribe(handler, options)` each give a removal function. In a component, give it to `this.own`.

## Stopping a Subscription

Call the removal function. A component does this with `this.own`, so the subscription stops when the component disconnects.

As a second guard, give `isActive` to `subscribe` or `listen`. Before each call, the store calls `isActive()`. If the result is not `true`, the store removes the subscription and does not call the handler. A component gives `isActive: () => this.isActive()`. This guard removes a subscription only at the next event. Until that event, the subscription holds the component in memory, so also use `own`.

## The Change Event

Each change goes out as a `data-changed` event on the store, with this `detail`:

```js
{
  collection: 'bookings',
  changes: [{ key: 'b1', oldValue: undefined, newValue: { room: 'A' } }],
}
```

- A removed key has `newValue: undefined`.
- Setting a value that the store already holds sends no event. The compare uses `Object.is`, so change an object by setting a new object.
- `transaction(fn)` sends one event for each collection when it ends. A key that ends at its first value is not in the event.
- A handler can change the store. The store sends that change after it sends the current change to all handlers. Thus each handler gets the changes in the order that they occurred.
- If a handler throws, the browser reports the error, and the store continues to send to the other handlers.
- The handlers get each change in the order of their `subscribe` calls. A listener that you add with `addEventListener('data-changed', ...)` gets the change before all handlers.
- A subscription with `keys` is in an index by collection and key. A write calls only the handlers of that key. Thus 20,000 components, each with one key, cost about 2.5 µs for each write in Chromium. A subscription with no `keys` gets each change of its collection, so use `keys` when a component shows only some keys.

## Options

`new BasicDataService({ broker, eventName })`. With a `broker`, each change also goes to `broker.FireEvent`, so an `EventBroker` subscriber hears it. If two stores use the same broker, give each store a different `eventName`.
