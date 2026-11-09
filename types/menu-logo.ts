// Uses the declarations as an application does. tsc checks it; nothing runs it.
import MenuLogo from '@catalystcommunity/menu-logo';

customElements.define('menu-logo', MenuLogo);
const logo = new MenuLogo();
logo.logo = '/logo.png';
logo.alt = 'My company';
logo.logoText = 'Zest';
logo.href = '/';
