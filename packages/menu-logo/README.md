# `MenuLogo`

The top item of a Zest menu, where the logo goes.

## Usage

```js
import { MenuLogo, ShadowMenuLogo } from '@catalystcommunity/menu-logo';

customElements.define('menu-logo', MenuLogo);
```

```html
<menu-logo logo="/logo.png" alt="My company" logo-text="Company" href="/"></menu-logo>
```

`logo-text` is text, not HTML. The element renders again when an attribute changes.
