// Uses the declarations as an application does. tsc checks it; nothing runs it.
import BasicDataService, { type DataChangedDetail } from '@catalystcommunity/basic-data-service';

interface Booking { id: string; room: string; }
interface Room { name: string; }

const store = new BasicDataService<{bookings: Booking; rooms: Room}>();
const removeListen = store.listen<Booking[]>(document, 'bookings-loaded', (bookings, service) => {
    service.replace('bookings', bookings.map(booking => [booking.id, booking] as const));
});
store.set('rooms', 'a', {name: 'Room A'});
const booking: Booking | undefined = store.get('bookings', 'b1');
const pairs: Array<[string, Booking]> = store.list('bookings');
void [booking, pairs];

const removeSubscription = store.subscribe((detail: DataChangedDetail<'bookings', Booking>) => {
    for (const change of detail.changes) { void change.newValue?.room; }
}, {collection: 'bookings', keys: ['b1'], filter: (change) => change.oldValue?.room !== change.newValue?.room, isActive: () => true});

store.subscribe((detail) => {
    if (detail.collection === 'rooms') { void detail.changes[0]?.newValue?.name; }
});
store.addEventListener('data-changed', (event) => { void event.detail.collection; });
const count: number = store.transaction((service) => { service.remove('bookings', 'b1'); return 1; });
void count;
removeSubscription();
removeListen();
