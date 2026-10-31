import { describe, it, expect, afterEach } from 'vitest';
import {MenuItem, ShadowMenuItem} from '../src';

customElements.define('menu-item', MenuItem);
customElements.define('shadow-menu-item', ShadowMenuItem);

describe('MenuItem', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    function makeItem(attributes, tag = 'menu-item') {
        const comp = document.createElement(tag);
        for (const [name, value] of Object.entries(attributes)) {
            comp.setAttribute(name, value);
        }
        document.body.appendChild(comp);
        return comp;
    }

    it('treats the display value as text, not as HTML', () => {
        const comp = makeItem({display: '<img src=x onerror="alert(1)">'});
        expect(comp.querySelector('img')).toBeNull();
        expect(comp.querySelector('.display').textContent).toEqual('<img src=x onerror="alert(1)">');
    });

    it('does not show the word null in the alt text with no display', () => {
        const comp = makeItem({icon: 'foo.png'});
        expect(comp.querySelector('img').alt).not.toMatch(/null/);
    });

    it('renders again when an attribute changes after it connects', () => {
        const comp = makeItem({display: 'Before'});
        comp.setAttribute('display', 'After');
        expect(comp.querySelector('.display').textContent).toEqual('After');
        comp.setAttribute('href', '/somewhere');
        expect(comp.querySelector('a').getAttribute('href')).toEqual('/somewhere');
        comp.removeAttribute('href');
        expect(comp.querySelector('a')).toBeNull();
    });

    it('renders into the shadow root for the shadow class', () => {
        const comp = makeItem({display: 'Shadowed', href: '/link'}, 'shadow-menu-item');
        expect(comp.querySelector('a')).toBeNull();
        expect(comp.shadowRoot.querySelector('a').getAttribute('href')).toEqual('/link');
    });
});
