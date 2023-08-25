export default class EventBroker {
    events;
    subscriberStats;

    constructor(){
        this.events = new Map();
        this.subscriberStats = {
            count: 0,
            added: 0,
            removed: 0,
        };
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
        this.events.get(eventName).set(subscriber, handler);
        this.subscriberStats.count++;
        this.subscriberStats.added++;
        document.addEventListener(eventName, handler);
    }
    
    UnsubscribeEvent(eventName, subscriber) {
        if(typeof eventName !== "string" || typeof subscriber !== "string"){
            throw new Error(`UnsubscribeEvent failed because of bad inputs. eventName: ${eventName}, subscriber: ${subscriber}`);
        }
        let callback = this.events.get(eventName).get(subscriber);
        if (callback) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          document.removeEventListener(eventName, callback);
          this.events.get(eventName).delete(subscriber);
          this.subscriberStats.count--;
          this.subscriberStats.removed++;
          return true;
        }
        return false;
    }
    
    // Anyone could fire it directly, we just provide convenience for wrapping it with metadata, which is limited at the moment obviously
    FireEvent(eventName, data) {
        document.dispatchEvent(new CustomEvent(eventName, {detail: data}));
    }
}
