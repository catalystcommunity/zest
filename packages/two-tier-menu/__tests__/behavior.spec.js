import { describe, it, expect, vi, afterEach } from 'vitest';
import {TwoTierMenu, ShadowTwoTierMenu} from '../src';
import {MenuItem} from '@catalystcommunity/menu-item';

customElements.define('two-tier-menu', TwoTierMenu);
customElements.define('shadow-two-tier-menu', ShadowTwoTierMenu);

describe('TwoTierMenu', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        delete window.menuRegistry;
    });

    function makeMenu(result, tag = 'two-tier-menu') {
        window.menuRegistry = {menu: () => result};
        const comp = document.createElement(tag);
        comp.registryName = 'menuRegistry';
        comp.dataRegisterFuncName = 'menu';
        return comp;
    }

    it('can be removed when the registration returns no unregister function', () => {
        const comp = makeMenu({menuConfig: {}});
        document.body.appendChild(comp);
        expect(() => comp.remove()).not.toThrow();
        expect(() => comp.disconnectedCallback()).not.toThrow();
    });

    it('renders an empty menu when the registration returns nothing', () => {
        const comp = makeMenu(undefined);
        expect(() => comp.connectedCallback()).not.toThrow();
        expect(comp.querySelector('.items').children.length).toEqual(0);
    });

    it('does not change the configuration that the registry owns', () => {
        const logo = {};
        const comp = makeMenu({menuConfig: {logo}});
        document.body.appendChild(comp);
        expect(logo).toEqual({});
        expect(comp.querySelector('menu-logo').getAttribute('logo-text')).toEqual('Zest');
    });

    it('logs nothing when the logo has no image', () => {
        const log = vi.spyOn(console, 'log');
        const comp = makeMenu({menuConfig: {logo: {text: 'Text only'}}});
        document.body.appendChild(comp);
        expect(log).not.toHaveBeenCalled();
        log.mockRestore();
    });

    it('sends the gutter overrides as attributes', () => {
        const comp = makeMenu({menuConfig: {gutter: {overrideTemplateId: 'one', overrideStyleTemplateId: 'two'}}});
        document.body.appendChild(comp);
        const gutter = comp.querySelector('menu-gutter');
        expect(gutter.getAttribute('override-template-id')).toEqual('one');
        expect(gutter.getAttribute('override-style-template-id')).toEqual('two');
    });

    it('renders into the shadow root for the shadow class', () => {
        const comp = makeMenu({menuConfig: {sections: [{display: 'One'}]}}, 'shadow-two-tier-menu');
        document.body.appendChild(comp);
        expect(comp.querySelector('.items')).toBeNull();
        expect(comp.shadowRoot.querySelector('.items').children.length).toEqual(1);
    });

    it('does not lose the item data when menu-item is defined after the menu renders', () => {
        const comp = makeMenu({menuConfig: {sections: [{display: 'One', link: '/one', icon: 'one.png'}]}});
        document.body.appendChild(comp);
        expect(customElements.get('menu-item')).toBeUndefined();
        customElements.define('menu-item', MenuItem);
        const item = comp.querySelector('menu-item');
        expect(item.querySelector('.display').textContent).toEqual('One');
        expect(item.querySelector('a').getAttribute('href')).toEqual('/one');
        expect(item.querySelector('img').getAttribute('src')).toEqual('one.png');
    });
});
