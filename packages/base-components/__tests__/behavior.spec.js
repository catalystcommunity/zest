import { describe, it, expect, vi, afterEach } from 'vitest';
import {BaseComponent, DataComponent, OpenShadowComponent, OpenShadowDataComponent, CheckCleanupCall} from '../src';

class ObservingComponent extends BaseComponent {
    static changeAttributes = ['some-setting'];
    changes = 0;
    postObservedAttributeChange() { this.changes++; }
}
customElements.define('observing-component', ObservingComponent);

class ConvertingComponent extends BaseComponent {}
customElements.define('converting-component', ConvertingComponent);

class ShadowComponent extends OpenShadowComponent {}
customElements.define('shadow-component', ShadowComponent);

class RegisteringComponent extends DataComponent {
    connectedCallback() {
        super.connectedCallback();
        this.doDataRegistration();
    }
}
customElements.define('registering-component', RegisteringComponent);

class ShadowRegisteringComponent extends OpenShadowDataComponent {}
customElements.define('shadow-registering-component', ShadowRegisteringComponent);

describe('observed attributes', () => {
    it('reports the attributes that the child class declares', () => {
        expect(ObservingComponent.observedAttributes).toEqual(['some-setting']);
        expect(BaseComponent.observedAttributes).toEqual([]);
    });

    it('sets the camelCase property when an observed attribute changes', () => {
        const comp = document.createElement('observing-component');
        comp.setAttribute('some-setting', 'first');
        expect(comp.someSetting).toEqual('first');
        expect(comp.changes).toEqual(1);
    });

    it('does not call the hook when the value is the same', () => {
        const comp = document.createElement('observing-component');
        comp.setAttribute('some-setting', 'first');
        comp.setAttribute('some-setting', 'first');
        expect(comp.changes).toEqual(1);
    });
});

describe('attribute conversion', () => {
    it('keeps a boolean attribute, which has an empty value', () => {
        const comp = document.createElement('converting-component');
        comp.setAttribute('is-enabled', '');
        comp.convertKebabAttributes(['is-enabled', 'not-present']);
        expect(comp.isEnabled).toEqual('');
        expect(comp.notPresent).toBeUndefined();
    });

    it('writes a zero property as an attribute, but not an unset one', () => {
        const comp = document.createElement('converting-component');
        comp.someCount = 0;
        comp.convertCamelProperties(['someCount', 'notSet']);
        expect(comp.getAttribute('some-count')).toEqual('0');
        expect(comp.hasAttribute('not-set')).toEqual(false);
    });
});

describe('open shadow components', () => {
    it('uses the shadow root as the root', () => {
        const comp = document.createElement('shadow-component');
        expect(comp.root).toBe(comp.shadowRoot);
        const data = document.createElement('shadow-registering-component');
        expect(data.root).toBe(data.shadowRoot);
    });
});

describe('CheckCleanupCall', () => {
    it('calls cleanup when it exists', () => {
        const cleanup = vi.fn();
        CheckCleanupCall({cleanup});
        expect(cleanup).toHaveBeenCalledOnce();
    });

    it('does not fail on null or on a thing with no cleanup', () => {
        expect(() => CheckCleanupCall(null)).not.toThrow();
        expect(() => CheckCleanupCall(undefined)).not.toThrow();
        expect(() => CheckCleanupCall({})).not.toThrow();
        expect(() => CheckCleanupCall('text')).not.toThrow();
    });
});

describe('DataComponent registration', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        delete window.behaviorRegistry;
    });

    function makeComponent(attributes) {
        const comp = document.createElement('registering-component');
        for (const [name, value] of Object.entries(attributes)) {
            comp.setAttribute(name, value);
        }
        return comp;
    }

    it('names the missing registry and logs nothing', () => {
        const log = vi.spyOn(console, 'log');
        const comp = makeComponent({'registry-name': 'noSuchRegistry', 'data-register-func-name': 'func'});
        expect(() => comp.connectedCallback()).toThrow(/noSuchRegistry/);
        expect(log).not.toHaveBeenCalled();
        log.mockRestore();
    });

    it('names the missing function', () => {
        window.behaviorRegistry = {};
        const comp = makeComponent({'registry-name': 'behaviorRegistry', 'data-register-func-name': 'noSuchFunc'});
        expect(() => comp.connectedCallback()).toThrow(/noSuchFunc/);
    });

    it('finds an unregister function from the unregister-func attribute', () => {
        const unregister = vi.fn();
        window.behaviorRegistry = {register: () => ({}), unregister};
        const comp = makeComponent({
            'registry-name': 'behaviorRegistry',
            'data-register-func-name': 'register',
            'unregister-func': 'unregister',
            'unregister-data': 'bye',
            'instance-id': 'theid',
        });
        document.body.appendChild(comp);
        comp.remove();
        expect(unregister).toHaveBeenCalledWith('theid', 'bye');
    });

    it('refuses an unregister-func attribute that names nothing', () => {
        window.behaviorRegistry = {register: () => ({})};
        const comp = makeComponent({
            'registry-name': 'behaviorRegistry',
            'data-register-func-name': 'register',
            'unregister-func': 'noSuchUnregister',
        });
        expect(() => comp.connectedCallback()).toThrow(/noSuchUnregister/);
    });

    it('unregisters one time when it is removed, and again after it reconnects', () => {
        const unregister = vi.fn();
        window.behaviorRegistry = {register: () => ({unregisterFunc: unregister})};
        const comp = makeComponent({'registry-name': 'behaviorRegistry', 'data-register-func-name': 'register'});
        document.body.appendChild(comp);
        comp.remove();
        expect(unregister).toHaveBeenCalledTimes(1);
        comp.disconnectedCallback();
        expect(unregister).toHaveBeenCalledTimes(1);
        document.body.appendChild(comp);
        comp.remove();
        expect(unregister).toHaveBeenCalledTimes(2);
    });
});

describe('styles', () => {
    class StyledComponent extends BaseComponent {
        static styles = '.styled {color: red;}';
        render() { this.root.innerHTML = '<p class="styled"></p>'; this.applyStyles(); }
        connectedCallback() { super.connectedCallback(); this.render(); }
    }
    customElements.define('styled-component', StyledComponent);

    class PlainComponent extends BaseComponent {
        render() { this.root.innerHTML = '<p></p>'; this.applyStyles(); }
    }
    customElements.define('plain-component', PlainComponent);

    function withFakeAdoption(run) {
        // jsdom has no adopted stylesheets, so this is the shape of the browser API
        const replaceSync = vi.fn();
        class FakeSheet { replaceSync(text) { replaceSync(text); } }
        vi.stubGlobal('CSSStyleSheet', FakeSheet);
        document.adoptedStyleSheets = [];
        try {
            run(replaceSync);
        } finally {
            delete document.adoptedStyleSheets;
            vi.unstubAllGlobals();
            document.body.innerHTML = '';
        }
    }

    it('wraps the defaults in the zest layer when it falls back to a style element', () => {
        const comp = document.createElement('styled-component');
        document.body.appendChild(comp);
        expect(comp.querySelector('style').textContent).toMatch(/@layer zest \{\s+\.styled \{color: red;\}\s+\}/);
        comp.remove();
    });

    it('has no style template of its own, so an instance template is the only thing that replaces the defaults', () => {
        expect(document.createElement('styled-component').styleTemplate).toBeNull();
        expect(new (customElements.get('plain-component'))().styleTemplate).toMatch(/defbasecomp/);
    });

    it('uses an override template in place of the defaults', () => {
        const template = document.createElement('template');
        template.id = 'style-override-test';
        template.innerHTML = '<style>.mine {color: blue;}</style>';
        document.body.appendChild(template);
        const comp = document.createElement('styled-component');
        comp.setAttribute('override-style-template-id', 'style-override-test');
        document.body.appendChild(comp);
        expect(comp.querySelector('style').textContent).toMatch(/\.mine/);
        expect(comp.querySelector('style').textContent).not.toMatch(/\.styled/);
        comp.remove();
        template.remove();
    });

    it('adopts one sheet for all instances, and adds it one time', () => {
        class SharedComponent extends StyledComponent { static styles = '.shared {}'; }
        customElements.define('shared-component', SharedComponent);
        withFakeAdoption((replaceSync) => {
            document.body.append(document.createElement('shared-component'), document.createElement('shared-component'));
            expect(document.adoptedStyleSheets).toHaveLength(1);
            expect(replaceSync).toHaveBeenCalledTimes(1);
            expect(document.querySelector('shared-component style')).toBeNull();
        });
    });

    it('adds styles after the layer, also to a sheet that is already in use', () => {
        class AddingComponent extends StyledComponent { static styles = '.adding {}'; }
        customElements.define('adding-component', AddingComponent);
        withFakeAdoption((replaceSync) => {
            document.body.appendChild(document.createElement('adding-component'));
            AddingComponent.addStyles('.added {}');
            const text = replaceSync.mock.calls.at(-1)[0];
            expect(text).toMatch(/\}\n\.added \{\}\n$/);
        });
    });

    it('shares the sheet with a child class that declares no styles', () => {
        class Parent extends StyledComponent { static styles = '.parent {}'; }
        class Child extends Parent {}
        customElements.define('parent-style-component', Parent);
        customElements.define('child-style-component', Child);
        withFakeAdoption(() => {
            document.body.append(document.createElement('parent-style-component'), document.createElement('child-style-component'));
            expect(document.adoptedStyleSheets).toHaveLength(1);
        });
    });

    it('falls back to a style element when the sheet belongs to another document', () => {
        class ForeignComponent extends StyledComponent { static styles = '.foreign {}'; }
        customElements.define('foreign-component', ForeignComponent);
        withFakeAdoption(() => {
            const refuse = () => { throw new DOMException('no', 'NotAllowedError'); };
            Object.defineProperty(document, 'adoptedStyleSheets', {configurable: true, get: () => [], set: refuse});
            const comp = document.createElement('foreign-component');
            document.body.appendChild(comp);
            expect(comp.querySelector('style').textContent).toMatch(/\.foreign/);
        });
    });

    it('does nothing for a class with no styles', () => {
        const comp = new (customElements.get('plain-component'))();
        comp.styleTemplate = null;
        comp.render();
        expect(comp.querySelector('style')).toBeNull();
    });
});

describe('the lifetime of an element', () => {
    it('is aborted when disconnected, and new when it connects again', () => {
        const comp = document.createElement('converting-component');
        expect(comp.lifetime.aborted).toBe(true);
        document.body.appendChild(comp);
        const first = comp.lifetime;
        expect(first.aborted).toBe(false);
        comp.remove();
        expect(first.aborted).toBe(true);
        document.body.appendChild(comp);
        expect(comp.lifetime.aborted).toBe(false);
        expect(comp.lifetime).not.toBe(first);
        comp.remove();
    });

    it('also ends for a data component', () => {
        const registry = {register: () => ({})};
        window.lifetimeRegistry = registry;
        const comp = document.createElement('registering-component');
        comp.setAttribute('registry-name', 'lifetimeRegistry');
        comp.setAttribute('data-register-func-name', 'register');
        document.body.appendChild(comp);
        const {lifetime} = comp;
        comp.remove();
        expect(lifetime.aborted).toBe(true);
        delete window.lifetimeRegistry;
    });
});

describe('emit and invalidate', () => {
    it('sends an event that leaves a shadow root', () => {
        const comp = document.createElement('shadow-component');
        document.body.appendChild(comp);
        const child = document.createElement('converting-component');
        comp.root.appendChild(child);
        const heard = vi.fn();
        document.addEventListener('zest-test', heard, {once: true});
        child.emit('zest-test', {id: 1});
        expect(heard.mock.calls[0][0].detail).toEqual({id: 1});
        comp.remove();
    });

    it('renders one time for many calls, and not after it disconnects', async () => {
        const comp = document.createElement('converting-component');
        comp.render = vi.fn();
        document.body.appendChild(comp);
        comp.invalidate();
        comp.invalidate();
        expect(comp.render).not.toHaveBeenCalled();
        await Promise.resolve();
        expect(comp.render).toHaveBeenCalledTimes(1);
        comp.invalidate();
        comp.remove();
        await Promise.resolve();
        expect(comp.render).toHaveBeenCalledTimes(1);
    });
});
