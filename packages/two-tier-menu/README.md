# `TwoTierMenu`

A menu with sections and items, which gets its data from a data registry.

## Usage

```js
import { TwoTierMenu, ShadowTwoTierMenu } from '@catalystcommunity/two-tier-menu';

customElements.define('two-tier-menu', TwoTierMenu);
// Also define the tags that it makes: menu-item, menu-logo, and menu-gutter.

window.appDataRegistry.AddDataFunction('menuData', () => ({
  menuConfig: {
    logo: { img: '/logo.png', alt: 'My company' },
    sections: [
      { display: 'Home', link: '/home', icon: '/home.png', items: [{ display: 'More', link: '/home/more' }] },
    ],
    gutter: { overrideTemplateId: 'my-gutter' },
  },
  unregisterFunc: () => {},   // optional
}));
```

```html
<two-tier-menu registry-name="appDataRegistry" data-register-func-name="menuData"></two-tier-menu>
```
