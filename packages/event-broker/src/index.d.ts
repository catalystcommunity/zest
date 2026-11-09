// Type declarations for @catalystcommunity/event-broker. The source is JavaScript; keep this file
// in step with src/index.js. __tests__/types.spec.js checks that each export has a declaration.

export type EventBrokerCallback<T = unknown> = (eventName: string, detail: T) => void;

export interface SubscribeOptions {
    /** Before each call. If the result is not `true`, the broker removes the subscription and does not call the callback. */
    isActive?: () => boolean;
}

export interface SubscriberStats {
    count: number;
    added: number;
    removed: number;
}

/** A publish and subscribe with custom events on a target. */
export default class EventBroker {
    /** The default target is `document`. */
    constructor(target?: EventTarget);
    /** Event name, then subscriber name, then the listener on the target. */
    events: Map<string, Map<string, (event: Event) => void>>;
    subscriberStats: SubscriberStats;
    target: EventTarget;
    /** Removes each subscription. */
    cleanup(): void;
    /** Throws on bad inputs. A subscriber has one callback for an event; a new subscribe replaces it. Returns the removal function. */
    SubscribeEvent<T = unknown>(eventName: string, subscriber: string, callback: EventBrokerCallback<T>, options?: SubscribeOptions): () => void;
    /** Returns true if a subscription was removed. */
    UnsubscribeEvent(eventName: string, subscriber: string): boolean;
    FireEvent(eventName: string, data?: unknown): void;
}
