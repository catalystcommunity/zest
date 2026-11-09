// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { TwoTierMenu, type TwoTierMenuConfig, type TwoTierMenuRegisterResult } from '@catalystcommunity/two-tier-menu';

customElements.define('two-tier-menu', TwoTierMenu);
const menuConfig: TwoTierMenuConfig = {
    logo: {img: '/logo.png', alt: 'My company'},
    sections: [{display: 'Home', link: '/home', icon: '/home.png', items: [{display: 'More', link: '/home/more'}]}],
    gutter: {overrideTemplateId: 'my-gutter'},
};
const menuData = (): TwoTierMenuRegisterResult => ({menuConfig, unregisterFunc: () => {}});
const menu = new TwoTierMenu();
menu.registryName = 'appDataRegistry';
menu.dataRegisterFuncName = 'menuData';
void menuData;
