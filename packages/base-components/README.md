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
- `static styles` holds the default CSS as text. Call `this.applyStyles()` in `render()`. If the browser has no adopted stylesheets, for example jsdom, `applyStyles` adds a `<style>` element to the container. Make the children of the component first, then call `applyStyles`, so that code that moves the children does not also move the style. Each instance shares one stylesheet, and the defaults are in the `zest` layer, so a page style wins. `MyElement.addStyles(css)` adds rules, also to elements that are already on the page. An instance with `override-style-template-id` uses only that template in its shadow root. In the light DOM, the shared sheet of another instance can still apply, but the template wins.
- `this.own(remove)` keeps a removal function. When the element disconnects, it calls each removal function one time, the last first. Use it for each subscription to something outside the element: `this.own(store.subscribe(...))`, `this.own(broker.SubscribeEvent(...))`.
- `this.listen(target, name, handler, options)` adds an event listener and owns its removal.
- Call `own` and `listen` in `connectedCallback`, after `super.connectedCallback()`. They throw if the element is not connected, because nothing removes a subscription from an element that never disconnects. Each connect must subscribe again.
- A listener on a child element of the component does not need `own`. The listener and the child element go away with the component.
- `this.isActive()` is true while the element is connected. Give it as `isActive` to a store or a broker as a second guard. After an `await`, call it before you change the element.
- `this.emit(name, detail, {cancelable})` sends an event that bubbles and leaves a shadow root. With `cancelable: true`, a listener can stop the action with `preventDefault()`, and `emit` returns `false`. Send events for what the user does. A change from code sends no event, the same as a native input.
- `this.invalidate()` calls `render()` one time after the current work. If you override `disconnectedCallback`, call `super.disconnectedCallback()`.
- `DataComponent` calls a function from a registry on `window` when you call `doDataRegistration()`. The function gets `(instanceId, registerData, isActive)`. Before the registry sends data, it can call `isActive()`, and drop the component if the result is not `true`. The element calls the unregister function one time when it disconnects, also if a removal function throws. Set `registry-name` and `data-register-func-name`. The function can return `unregisterFunc`, or you can set `unregister-func` to the name of a function in the registry.

## Typed Properties

Declare the properties of a component in `static properties`. Each one has a property and an attribute that agree.

```js
class VolumeKnob extends BaseComponent {
  static properties = {
    value: {type: Number, default: 50},                // attribute "value"
    muted: {type: Boolean, reflect: true},             // the attribute follows the property
    marks: {type: Array, default: () => [0, 50, 100]},  // JSON in the attribute
    format: {type: Function, attribute: false},        // a property only
    label: {type: String, render: false},              // no render after a change
  };
  propertyChanged(name, oldValue, newValue) { }
  render() { }
}
```

- The types are `String`, `Number`, `Boolean`, `Array`, `Object`, and `Function`. The attribute name is the kebab-case name of the property. Set `attribute` to use a different name.
- A Boolean attribute is true when it is present, also with an empty value. The value `"false"` is false.
- A change of the property or of the attribute calls `propertyChanged(name, oldValue, newValue)`, then `invalidate()`. The same value causes no call.
- A default that is a function gives a new value for each instance. Use a function for an array or an object default.
- A value that the application set before the tag was defined is kept. Its `propertyChanged` call occurs at the first connect, because the fields of the child class do not exist in the constructor.
- Do not declare a class field with the name of a property. The field hides the property.
- An attribute that is not valid, for example `items="not json"`, does not change the value. The browser reports the error.

## Renders

- `this.invalidate()` asks for one render. Many calls before the render cause one render.
- `static renderTiming = 'microtask'` is the default. The render occurs after the current work.
- `static renderTiming = 'frame'` renders one time in the next animation frame. Use it for a component that can get many changes in a second, for example from a pointer, a timer, or a data stream. A storm of changes then paints at the rate of the screen, not one time for each change.
- Frame renders go from the parent to the child, also across shadow roots. A render that asks for a render goes to the next frame, so a loop of renders cannot stop the page.
- `flushRenders()` does the frame renders that wait, now. Use it in tests, and before you measure.
- A frame component that measures its layout in an event handler must first paint a render that waits: `if (isRenderScheduled(this)) { this.render(); }`. If not, two keys in one frame both start from the old layout, and one step is lost.

## Composition

A parent that makes child components must know the tag of each child class. The application can define a class with any tag.

- `tagFor(ChildClass, 'preferred-tag')` gives the tag of the class. If the class has no tag, it defines the preferred tag. If a different class has that tag, a new child class of `ChildClass` gets the tag `preferred-tag-2`.
- `createElementOf(ChildClass, 'preferred-tag', attributes)` makes an element of the class.
- `defineElements({'my-tag': MyClass})` defines each tag that is not defined yet.
- Importing a package defines nothing. A tag is defined only when the application or a parent asks for it.

## Keyboard Focus in a Group

`RovingFocus` keeps one item of a group in the tab order. The arrow keys move between the items, as in a toolbar, a tab list, a menu, or a list.

```js
connectedCallback() {
  super.connectedCallback();
  this.focusGroup ??= new RovingFocus(this.root, {items: '[role="tab"]', orientation: 'horizontal'});
  this.own(this.focusGroup.attach());
}
render() {
  // ... make the items
  this.focusGroup.update();
}
```

- The options are `items` (a selector or a function), `orientation` (`horizontal`, `vertical`, or `both`), `wrap`, `skipDisabled`, `typeahead`, `onMove(item, event)`, and `onKey(event, item)`.
- In a right-to-left page, the left and right arrows change direction.
- A key with Ctrl, Alt, or Meta goes to the application.

## Popups

`placePopup(popup, anchor, {placement})` puts a popup next to its anchor. `placePopupAt(popup, x, y)` puts it at a point, for example a context menu at the pointer. Use the popup with `popover="manual"`, so that a parent with `overflow: hidden` cannot clip it. If there is no room on one side, the popup goes to the other side. It always stays in the window. If the popup is larger than the room on its side, `placePopup` sets its `max-height` (or `max-width`) to that room, so the popup does not cover its anchor. Give the popup `overflow: auto`.

To keep the focus in a field when the user presses a button in its popup, call `preventDefault()` on `mousedown`. In Chromium, `preventDefault()` on `pointerdown` does not keep the focus.

## Size and Visibility

`observeResize(element, callback, {box})` and `observeVisibility(element, callback, {rootMargin, threshold})` call `callback(entry)` when the size of the element changes, or when the element goes into or out of the window. All components share one observer for each set of options, because one observer for each instance costs much more. Each function returns the removal function: `this.own(observeResize(this.scroller, () => this.invalidate()))`. If the browser does not know the box `device-pixel-content-box`, the function uses the content box.

## Tokens

`tokenAliases('check-box')` gives the private aliases (`--_face`, `--_border`, and the others) in the token order: widget, family, global, system color. Put the result in the rule of the outer element of the component. `visuallyHidden` is CSS for text that only a screen reader reads.

## Rules for a Zest Component

These rules make the components work together, as the parts of one GUI toolkit.

- **Shadow DOM or light DOM.** A container that holds the children of the application, for example a tab view or a splitter, uses a shadow root and slots. A component that makes all of its own children uses the light DOM, and also has a `Shadow...` class with an open shadow root.
- **Values.** A component with a value sends `input` while the value changes and `change` when the user commits the value, as a native input does. Each event bubbles and is composed. A change from code sends no event.
- **Other events.** Use the name `<tag>-<verb>`, for example `tab-view-select`. Put the data in `detail`.
- **Forms.** A component with a value uses `static formAssociated = true` and `ElementInternals`. It supports `name`, `disabled`, `required`, and form reset.
- **Keyboard.** Each thing that a pointer can do, the keyboard can also do. Follow the ARIA Authoring Practices for the role.
- **Accessibility.** Each target is 24 by 24 CSS pixels or more. The focus ring uses `:focus-visible` and `outline`. Do not show a state with color only. Each page of the gallery passes axe in light and dark, and reflows at 320 CSS pixels.
- **Look.** Read the tokens with `tokenAliases()`. Put the default CSS in `static styles`. Use `em` for sizes and `min-height` in place of `height`.
- **Cleanup.** Use `own` and `listen` for each subscription to something outside the component.
- **Updates.** Change the parts of the DOM that changed. Do not make all of the DOM again for a small change, because that loses the focus and the scroll position.
