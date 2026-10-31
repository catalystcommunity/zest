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
