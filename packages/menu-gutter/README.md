# `MenuGutter`

A container for items at the bottom of a Zest menu.

## Usage

```js
import { MenuGutter, ShadowMenuGutter } from '@catalystcommunity/menu-gutter';

customElements.define('menu-gutter', MenuGutter);
```

```html
<template id="my-gutter"><span>&copy; Me</span></template>
<menu-gutter override-template-id="my-gutter"></menu-gutter>
```
