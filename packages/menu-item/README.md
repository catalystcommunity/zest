# `MenuItem`

One entry in a Zest menu.

## Usage

```js
import { MenuItem, ShadowMenuItem } from '@catalystcommunity/menu-item';

customElements.define('menu-item', MenuItem);
```

```html
<menu-item href="/home" icon="/home.png" display="Home"></menu-item>
```

`display` is text, not HTML. The element renders again when an attribute changes.
