# `BasicDataService`

A store of data for components, so that components do not hold state. Events update the store. The store publishes each change, and each component decides what the change means to it.

## Usage

```js
import BasicDataService from '@catalystcommunity/basic-data-service';

const store = new BasicDataService();

// Events go in. All the changes from one event go out as one change event.
store.listen(document, 'bookings-loaded', (bookings, service) => {
  for (const booking of bookings) { service.set('bookings', booking.id, booking); }
});

// A component hears only what it renders, and stops when it disconnects
class BookingCount extends BaseComponent {
  connectedCallback() {
    super.connectedCallback();
    store.subscribe(() => this.invalidate(), {
      collection: 'bookings',
      filter: (change) => change.newValue?.room === this.getAttribute('room') || change.oldValue?.room === this.getAttribute('room'),
      signal: this.lifetime,
    });
    this.render();
  }
  render() {
    this.textContent = store.list('bookings').filter(([, b]) => b.room === this.getAttribute('room')).length;
  }
}
```

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

## Options

`new BasicDataService({ broker, eventName })`. With a `broker`, each change also goes to `broker.FireEvent`, so an `EventBroker` subscriber hears it.
