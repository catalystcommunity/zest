import { describe, it, expect, afterEach } from 'vitest';
import {MenuLogo, ShadowMenuLogo} from '../src';

customElements.define('menu-logo', MenuLogo);
customElements.define('shadow-menu-logo', ShadowMenuLogo);

describe('MenuLogo', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    function makeLogo(attributes, tag = 'menu-logo') {
        const comp = document.createElement(tag);
        for (const [name, value] of Object.entries(attributes)) {
            comp.setAttribute(name, value);
        }
        document.body.appendChild(comp);
        return comp;
    }

    it('puts the logoText class on the text', () => {
        const comp = makeLogo({'logo-text': 'Zest'});
        expect(comp.querySelector('span').className).toEqual('logoText');
    });

    it('treats the logo text as text, not as HTML', () => {
        const comp = makeLogo({'logo-text': '<b>Zest</b>'});
        expect(comp.querySelector('b')).toBeNull();
        expect(comp.querySelector('.logoText').textContent).toEqual('<b>Zest</b>');
    });

    it('renders the override styles beside the content', () => {
        const template = document.createElement('template');
        template.id = 'logo-styles';
        template.innerHTML = '<style>span {color: red;}</style>';
        document.body.appendChild(template);
        const comp = makeLogo({'override-style-template-id': 'logo-styles', 'logo-text': 'Zest'});
        expect(comp.querySelector('style').textContent).toMatch(/color: red/);
        expect(comp.querySelector('.logoText')).not.toBeNull();
    });

    it('renders again when an attribute changes after it connects', () => {
        const comp = makeLogo({'logo-text': 'Before'});
        comp.setAttribute('logo-text', 'After');
        expect(comp.querySelector('.logoText').textContent).toEqual('After');
    });

    it('renders into the shadow root for the shadow class', () => {
        const comp = makeLogo({logo: 'foo.png'}, 'shadow-menu-logo');
        expect(comp.querySelector('img')).toBeNull();
        expect(comp.shadowRoot.querySelector('img').alt).toEqual('Logo image');
    });
});
