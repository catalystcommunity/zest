import { describe, it, expect, afterEach } from 'vitest';
import {MenuGutter, ShadowMenuGutter} from '../src';

customElements.define('menu-gutter', MenuGutter);
customElements.define('shadow-menu-gutter', ShadowMenuGutter);

describe('MenuGutter', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    function addTemplate(id, html) {
        const template = document.createElement('template');
        template.id = id;
        template.innerHTML = html;
        document.body.appendChild(template);
    }

    it('renders only its styles with no template', () => {
        const comp = document.createElement('menu-gutter');
        document.body.appendChild(comp);
        expect(comp.children.length).toEqual(1);
        expect(comp.firstElementChild.tagName).toEqual('STYLE');
    });

    it('renders the override template from an attribute', () => {
        addTemplate('gutter-content', '<span class="content">Hello</span>');
        const comp = document.createElement('menu-gutter');
        comp.setAttribute('override-template-id', 'gutter-content');
        document.body.appendChild(comp);
        expect(comp.querySelector('.content').textContent).toEqual('Hello');
    });

    it('renders the override template from a property', () => {
        addTemplate('gutter-content', '<span class="content">Hello</span>');
        const comp = document.createElement('menu-gutter');
        comp.overrideTemplateId = 'gutter-content';
        document.body.appendChild(comp);
        expect(comp.querySelector('.content')).not.toBeNull();
    });

    it('renders into the shadow root for the shadow class', () => {
        addTemplate('gutter-content', '<span class="content">Hello</span>');
        const comp = document.createElement('shadow-menu-gutter');
        comp.setAttribute('override-template-id', 'gutter-content');
        document.body.appendChild(comp);
        expect(comp.querySelector('.content')).toBeNull();
        expect(comp.shadowRoot.querySelector('.content')).not.toBeNull();
    });

    it('does not render twice when it reconnects', () => {
        addTemplate('gutter-content', '<span class="content">Hello</span>');
        const comp = document.createElement('menu-gutter');
        comp.setAttribute('override-template-id', 'gutter-content');
        document.body.appendChild(comp);
        comp.remove();
        document.body.appendChild(comp);
        expect(comp.querySelectorAll('.content').length).toEqual(1);
    });
});
