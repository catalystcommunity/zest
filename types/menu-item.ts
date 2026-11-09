// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { MenuItem, ShadowMenuItem } from '@catalystcommunity/menu-item';

customElements.define('menu-item', MenuItem);
const item = new ShadowMenuItem();
item.href = '/home';
item.display = 'Home';
item.icon = null;
const root: ShadowRoot = item.shadow;
void root;
