// Uses the declarations as an application does. tsc checks it; nothing runs it.
import MenuGutter, { ShadowMenuGutter } from '@catalystcommunity/menu-gutter';

customElements.define('menu-gutter', MenuGutter);
customElements.define('shadow-menu-gutter', ShadowMenuGutter);
const gutter = new MenuGutter();
gutter.template = '<button type="button">Sign out</button>';
gutter.render();
