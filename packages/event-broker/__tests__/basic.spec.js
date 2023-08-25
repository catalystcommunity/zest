import { describe, it, expect} from 'vitest';
import EventBroker from '../src';

describe('EventBroker', () => {
    it("should initialize correctly", () => {
        const eb = new EventBroker();
        expect(eb).toBeInstanceOf(EventBroker);
    });

    it("should have an empty map with 0 subscribers", () => {
        const eb = new EventBroker();
        expect(eb.subscriberStats.count).toStrictEqual(0);
        expect(eb.subscriberStats.added).toStrictEqual(0);
        expect(eb.subscriberStats.removed).toStrictEqual(0);
        expect(eb.events).toBeInstanceOf(Map);
        expect(eb.events.size).toStrictEqual(0);
    });

    it("should subscribe an event and update stats", () => {
        const eb = new EventBroker();
        const callback = function(_e, _d) {
        }
        eb.SubscribeEvent("foo", "subscriber_a", callback);
        expect(eb.subscriberStats.count).toStrictEqual(1);
        expect(eb.subscriberStats.added).toStrictEqual(1);
        expect(eb.subscriberStats.removed).toStrictEqual(0);
    });

    it("should unsubscribe an event and update stats", () => {
        const eb = new EventBroker();
        const callback = function(_e, _d) {
        }
        eb.SubscribeEvent("foo", "subscriber_a", callback);
        eb.UnsubscribeEvent("foo", "subscriber_a");
        expect(eb.subscriberStats.count).toStrictEqual(0);
        expect(eb.subscriberStats.added).toStrictEqual(1);
        expect(eb.subscriberStats.removed).toStrictEqual(1);
    });

    it("should call the callback when an event is emitted", () => {
        const eb = new EventBroker();
        let initialEventName = "notSet"
        let expectedEventName = "foo"
        let trackedEventName = initialEventName;
        let trackedDetail = {someField: 0};
        const callback = function(eventName, detail) {
            trackedEventName = eventName;
            trackedDetail = detail;
        }
        eb.SubscribeEvent(expectedEventName, "subscriber_a", callback);
        expect(trackedEventName).toEqual(initialEventName);
        expect(trackedDetail.someField).toStrictEqual(0);
        eb.FireEvent(expectedEventName, {someField: 4});
        expect(trackedEventName).toEqual(expectedEventName);
        expect(trackedDetail.someField).toStrictEqual(4);
    });

    it("should call the callback with separate events when emitted separately", () => {
        const eb = new EventBroker();
        let initialEventName = "notSet"
        let expectedEventName = "foo"
        let expectedSecondEventName = "bar"
        let trackedEventName = initialEventName;
        let trackedDetail = {someField: 0};
        const callback = function(eventName, detail) {
            trackedEventName = eventName;
            trackedDetail = detail;
        }
        eb.SubscribeEvent(expectedEventName, "subscriber_a", callback);
        eb.SubscribeEvent(expectedSecondEventName, "subscriber_a", callback);
        expect(trackedEventName).toEqual(initialEventName);
        expect(trackedDetail.someField).toStrictEqual(0);
        eb.FireEvent(expectedEventName, {someField: 4});
        expect(trackedEventName).toEqual(expectedEventName);
        expect(trackedDetail.someField).toStrictEqual(4);
        eb.FireEvent(expectedSecondEventName, {someField: 7});
        expect(trackedEventName).toEqual(expectedSecondEventName);
        expect(trackedDetail.someField).toStrictEqual(7);
    });
});
