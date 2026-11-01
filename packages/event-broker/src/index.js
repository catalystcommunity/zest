export default class EventBroker {
    events;
    subscriberStats;
    target;

    // The target holds the events. A broker with its own EventTarget hears nothing from the page.
    constructor(target = document){
        this.target = target;
        this.events = new Map();
        this.subscriberStats = {
            count: 0,
            added: 0,
            removed: 0,
        };
    }
    cleanup(){
        for(const [eventName, subs] of this.events){
            for(const [_, callback] of subs){
                this.target.removeEventListener(eventName, callback)
                this.subscriberStats.count--;
                this.subscriberStats.removed++;
            }
        }
        this.events = new Map();
    }

    SubscribeEvent(eventName, subscriber, callback) {
        if(typeof eventName !== "string" || typeof subscriber !== "string" || typeof callback !== "function"){
            throw new Error(`SubscribeEvent failed because of bad inputs. eventName: ${eventName}, subscriber: ${subscriber}, callback: ${callback}`);
        }
        let handler = (e) => {
          callback(eventName, e.detail);
        }
        if (this.events.get(eventName) === undefined || this.events.get(eventName) === null) {
            this.events.set(eventName, new Map());
        }
        // A subscriber has one callback for an event, so a repeated subscribe replaces the old one
        this.UnsubscribeEvent(eventName, subscriber);
        this.events.get(eventName).set(subscriber, handler);
        this.subscriberStats.count++;
        this.subscriberStats.added++;
        this.target.addEventListener(eventName, handler);
    }
    
    UnsubscribeEvent(eventName, subscriber) {
        if(typeof eventName !== "string" || typeof subscriber !== "string"){
            throw new Error(`UnsubscribeEvent failed because of bad inputs. eventName: ${eventName}, subscriber: ${subscriber}`);
        }
        let callback = this.events.get(eventName)?.get(subscriber);
        if (callback) {
          this.target.removeEventListener(eventName, callback);
          this.events.get(eventName).delete(subscriber);
          this.subscriberStats.count--;
          this.subscriberStats.removed++;
          return true;
        }
        return false;
    }
    
    // Anyone could fire it directly, we just provide convenience for wrapping it with metadata, which is limited at the moment obviously
    FireEvent(eventName, data) {
        this.target.dispatchEvent(new CustomEvent(eventName, {detail: data}));
    }
}
