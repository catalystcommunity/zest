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
- `DataComponent` calls a function from a registry on `window` when you call `doDataRegistration()`. It calls the unregister function one time when the element disconnects. Set `registry-name` and `data-register-func-name`. The function can return `unregisterFunc`, or you can set `unregister-func` to the name of a function in the registry.
