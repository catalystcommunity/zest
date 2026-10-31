# `SimpleRouter`

A small router for an application that does not need much from a router.

## Usage

```js
import SimpleRouter from '@catalystcommunity/simple-router';

const router = new SimpleRouter();
router.registerRoute('/home', (routeData, state, changeType) => { /* render */ }, ['/start']);
router.registerRoute('/notfound', () => { /* render */ }, [], true);   // the default route
router.changePage('/home/more', { from: 'somewhere' });
```

- A route matches its own path and the paths under it, on whole segments. `/home` matches `/home/more` but not `/homepage`. The root route `/` matches only the root.
- The longest match wins, in any registration sequence.
- The third argument of `registerRoute` holds equivalent paths. `changePage` writes the main path to the URL.
- The router sends a `url-changed` event on the document, where an `EventBroker` subscriber hears it. Set `router.eventSender` to send it another way.
- The router does not catch clicks on links. Call `changePage` from your own click handler. See `demo/main.js`.
- Call `cleanup()` to remove the listeners.
