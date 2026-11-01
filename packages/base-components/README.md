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
- `this.lifetime` is an `AbortSignal` for the time that the element is connected: `addEventListener(name, handler, {signal: this.lifetime})`.
- `this.emit(name, detail)` sends an event that bubbles and leaves a shadow root. Send events for what the user does. A change from code sends no event, the same as a native input.
- `this.invalidate()` calls `render()` one time after the current work. If you override `disconnectedCallback`, call `super.disconnectedCallback()`.
- `DataComponent` calls a function from a registry on `window` when you call `doDataRegistration()`. It calls the unregister function one time when the element disconnects. Set `registry-name` and `data-register-func-name`. The function can return `unregisterFunc`, or you can set `unregister-func` to the name of a function in the registry.
