# `BaseComponents`

The base classes for Zest web components.

## Usage

```js
import { BaseComponent, OpenShadowComponent, DataComponent, OpenShadowDataComponent, CheckCleanupCall } from '@catalystcommunity/base-components';

class MyElement extends BaseComponent {
  // The browser reads this one time, so it must be a static field.
  static changeAttributes = ['my-setting'];

  connectedCallback() {
    super.connectedCallback();
    this.render();
  }
  postObservedAttributeChange() {
    if (this.isConnected) { this.render(); }   // this.mySetting holds the new value
  }
  render() {
    this.root.innerHTML = this.template;
  }
}
customElements.define('my-element', MyElement);
```

- `override-template-id` and `override-style-template-id` select a `<template>` by ID.
- `connectedCallback` runs each time that the element connects. This can occur more than one time.
- `static styles` holds the default CSS as text. Call `this.applyStyles()` in `render()`. Each instance shares one stylesheet, and the defaults are in the `zest` layer, so a page style wins. `MyElement.addStyles(css)` adds rules, also to elements that are already on the page. An instance with `override-style-template-id` uses only that template in its shadow root. In the light DOM, the shared sheet of another instance can still apply, but the template wins.
- `this.own(remove)` keeps a removal function. When the element disconnects, it calls each removal function one time, the last first. Use it for each subscription to something outside the element: `this.own(store.subscribe(...))`, `this.own(broker.SubscribeEvent(...))`.
- `this.listen(target, name, handler, options)` adds an event listener and owns its removal.
- Call `own` and `listen` in `connectedCallback`, after `super.connectedCallback()`. They throw if the element is not connected, because nothing removes a subscription from an element that never disconnects. Each connect must subscribe again.
- A listener on a child element of the component does not need `own`. The listener and the child element go away with the component.
- `this.isActive()` is true while the element is connected. Give it as `isActive` to a store or a broker as a second guard. After an `await`, call it before you change the element.
- `this.emit(name, detail)` sends an event that bubbles and leaves a shadow root. Send events for what the user does. A change from code sends no event, the same as a native input.
- `this.invalidate()` calls `render()` one time after the current work. If you override `disconnectedCallback`, call `super.disconnectedCallback()`.
- `DataComponent` calls a function from a registry on `window` when you call `doDataRegistration()`. The function gets `(instanceId, registerData, isActive)`. Before the registry sends data, it can call `isActive()`, and drop the component if the result is not `true`. The element calls the unregister function one time when it disconnects, also if a removal function throws. Set `registry-name` and `data-register-func-name`. The function can return `unregisterFunc`, or you can set `unregister-func` to the name of a function in the registry.
