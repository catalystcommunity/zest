import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    BaseComponent, OpenShadowComponent, flushRenders, isRenderScheduled, tagFor, createElementOf, defineElements,
    RovingFocus, placePopup, tokenAliases, observeResize, observeVisibility,
} from '../src';

class TypedComponent extends BaseComponent {
    static properties = {
        value: {type: Number, default: 0},
        open: {type: Boolean, reflect: true},
        label: {type: String, default: 'none'},
        items: {type: Array, default: () => []},
        config: {type: Object, attribute: false},
        quiet: {type: String, render: false},
    };
    changes = [];
    renders = 0;
    propertyChanged(name, oldValue, newValue) { this.changes.push([name, oldValue, newValue]); }
    render() { this.renders++; }
}
customElements.define('typed-component', TypedComponent);

class ChildTyped extends TypedComponent {
    static properties = {extra: {type: Number, default: 5}};
}
customElements.define('child-typed', ChildTyped);

class FrameComponent extends BaseComponent {
    static renderTiming = 'frame';
    renders = 0;
    order = null;
    render() { this.renders++; this.order?.push(this.id); }
}
customElements.define('frame-component', FrameComponent);

class ShadowFrame extends OpenShadowComponent {
    static renderTiming = 'frame';
    render() { this.order?.push(this.id); }
}
customElements.define('shadow-frame', ShadowFrame);

afterEach(() => {
    document.body.replaceChildren();
    flushRenders();
});

describe('typed properties', () => {
    it('has defaults, and reads each type from its attribute', () => {
        const element = document.createElement('typed-component');
        expect(element.value).toBe(0);
        expect(element.open).toBe(false);
        expect(element.label).toBe('none');
        element.setAttribute('value', '42');
        element.setAttribute('open', '');
        element.setAttribute('items', '[1,2]');
        expect(element.value).toBe(42);
        expect(element.open).toBe(true);
        expect(element.items).toEqual([1, 2]);
        element.setAttribute('open', 'false');
        expect(element.open).toBe(false);
        element.removeAttribute('value');
        expect(element.value).toBe(0);
    });

    it('observes the attribute of each property, and not the ones with attribute: false', () => {
        expect(TypedComponent.observedAttributes).toEqual(expect.arrayContaining(['value', 'open', 'label', 'items', 'quiet']));
        expect(TypedComponent.observedAttributes).not.toContain('config');
        expect(ChildTyped.observedAttributes).toEqual(expect.arrayContaining(['value', 'extra']));
        expect(document.createElement('child-typed').extra).toBe(5);
    });

    it('reflects only a property that asks for it, and does not hear its own reflection', () => {
        const element = document.createElement('typed-component');
        element.open = true;
        expect(element.getAttribute('open')).toBe('');
        element.open = false;
        expect(element.hasAttribute('open')).toBe(false);
        element.value = 3;
        expect(element.hasAttribute('value')).toBe(false);
        expect(element.changes).toEqual([['open', false, true], ['open', true, false], ['value', 0, 3]]);
    });

    it('calls propertyChanged only for a real change, and renders one time for many changes', async () => {
        const element = document.body.appendChild(document.createElement('typed-component'));
        element.value = 1;
        element.value = 1;
        element.label = 'a';
        element.label = 'b';
        expect(element.changes.map(change => change[0])).toEqual(['value', 'label', 'label']);
        await Promise.resolve();
        expect(element.renders).toBe(1);
    });

    it('does not render for a property with render: false', async () => {
        const element = document.body.appendChild(document.createElement('typed-component'));
        element.quiet = 'x';
        await Promise.resolve();
        expect(element.renders).toBe(0);
        expect(element.changes).toEqual([['quiet', undefined, 'x']]);
    });

    it('gives each instance its own array default', () => {
        const a = document.createElement('typed-component');
        const b = document.createElement('typed-component');
        a.items.push(1);
        expect(a.items).toEqual([1]);
        expect(b.items).toEqual([]);
    });

    it('converts a property value to the type', () => {
        const element = document.createElement('typed-component');
        element.value = '7';
        element.open = 'yes';
        expect(element.value).toBe(7);
        expect(element.open).toBe(true);
    });

    it('keeps a value that was set before the tag was defined', () => {
        const element = document.createElement('late-typed');
        element.value = 9;
        class LateTyped extends BaseComponent {
            static properties = {value: {type: Number, default: 0}};
        }
        customElements.define('late-typed', LateTyped);
        customElements.upgrade(element);
        expect(element.value).toBe(9);
        expect(Object.hasOwn(element, 'value')).toBe(false);
    });

    it('tells an early value at the first connect, when the fields of the child class exist', () => {
        const element = document.createElement('later-typed');
        element.open = true;
        class LaterTyped extends BaseComponent {
            static properties = {open: {type: Boolean, reflect: true}};
            #seen = [];
            get seen() { return this.#seen; }
            propertyChanged(name, oldValue, newValue) { this.#seen.push([name, oldValue, newValue]); }
        }
        customElements.define('later-typed', LaterTyped);
        customElements.upgrade(element);
        expect(element.open).toBe(true);
        expect(element.seen).toEqual([]);
        document.body.append(element);
        expect(element.seen).toEqual([['open', false, true]]);
        expect(element.hasAttribute('open')).toBe(true);
        element.remove();
        document.body.append(element);
        expect(element.seen).toHaveLength(1);
    });

    it('reports an attribute that is not valid, and keeps the value', () => {
        const reported = vi.fn();
        vi.stubGlobal('reportError', reported);
        const element = document.createElement('typed-component');
        element.items = [3];
        element.setAttribute('items', 'not json');
        expect(element.items).toEqual([3]);
        expect(reported).toHaveBeenCalledWith(expect.objectContaining({message: 'The items attribute of typed-component is not a valid Array: not json'}));
        vi.unstubAllGlobals();
    });
});

describe('frame renders', () => {
    it('renders one time in the next frame for many calls', () => {
        const element = document.body.appendChild(document.createElement('frame-component'));
        for (let i = 0; i < 1000; i++) { element.invalidate(); }
        expect(element.renders).toBe(0);
        expect(isRenderScheduled(element)).toBe(true);
        expect(flushRenders()).toBe(1);
        expect(element.renders).toBe(1);
    });

    it('renders a parent before its children, also across a shadow root', () => {
        const order = [];
        const parent = document.body.appendChild(Object.assign(document.createElement('shadow-frame'), {id: 'parent', order}));
        const child = Object.assign(document.createElement('frame-component'), {id: 'child', order});
        const grandchild = Object.assign(document.createElement('frame-component'), {id: 'grandchild', order});
        parent.shadowRoot.append(child);
        child.append(grandchild);
        grandchild.invalidate();
        child.invalidate();
        parent.invalidate();
        flushRenders();
        expect(order).toEqual(['parent', 'child', 'grandchild']);
    });

    it('sends a render that asks for another render to the next frame', () => {
        const element = document.body.appendChild(document.createElement('frame-component'));
        element.render = function () { this.renders++; this.invalidate(); };
        element.invalidate();
        flushRenders();
        expect(element.renders).toBe(1);
        flushRenders();
        expect(element.renders).toBe(2);
    });

    it('does not render a disconnected element, and continues after a render throws', () => {
        const reported = vi.fn();
        vi.stubGlobal('reportError', reported);
        const gone = document.body.appendChild(document.createElement('frame-component'));
        const broken = document.body.appendChild(document.createElement('frame-component'));
        const good = document.body.appendChild(document.createElement('frame-component'));
        broken.render = () => { throw new Error('broken'); };
        gone.invalidate();
        broken.invalidate();
        good.invalidate();
        gone.remove();
        flushRenders();
        expect(gone.renders).toBe(0);
        expect(good.renders).toBe(1);
        expect(reported).toHaveBeenCalledWith(expect.objectContaining({message: 'broken'}));
        vi.unstubAllGlobals();
    });
});

describe('tags of classes', () => {
    it('defines a class at the first request, and gives the same tag after that', () => {
        class Leaf extends BaseComponent {}
        expect(customElements.get('zest-leaf')).toBeUndefined();
        expect(tagFor(Leaf, 'zest-leaf')).toBe('zest-leaf');
        expect(customElements.get('zest-leaf')).toBe(Leaf);
        expect(tagFor(Leaf, 'zest-leaf')).toBe('zest-leaf');
    });

    it('gives a new tag to a child class when another class has the tag', () => {
        class Other extends BaseComponent {}
        class Wanted extends BaseComponent {}
        customElements.define('zest-taken', Other);
        const tag = tagFor(Wanted, 'zest-taken');
        expect(tag).toBe('zest-taken-2');
        expect(document.createElement(tag)).toBeInstanceOf(Wanted);
    });

    it('makes an element with attributes, and leaves out false ones', () => {
        class Maker extends BaseComponent {}
        const element = createElementOf(Maker, 'zest-maker', {label: 'A', disabled: true, hidden: false});
        expect(element).toBeInstanceOf(Maker);
        expect(element.getAttribute('label')).toBe('A');
        expect(element.getAttribute('disabled')).toBe('');
        expect(element.hasAttribute('hidden')).toBe(false);
    });

    it('defines a map of tags, and leaves a defined tag alone', () => {
        class First extends BaseComponent {}
        class Second extends BaseComponent {}
        defineElements({'zest-first': First});
        defineElements({'zest-first': Second, 'zest-second': Second});
        expect(customElements.get('zest-first')).toBe(First);
        expect(tagFor(Second, 'anything-else')).toBe('zest-second');
    });
});

describe('roving focus', () => {
    function group(orientation = 'horizontal', options = {}) {
        const container = document.body.appendChild(document.createElement('div'));
        container.innerHTML = '<button>Alpha</button><button aria-disabled="true">Beta</button><button>Gamma</button><button hidden>Hidden</button>';
        const focus = new RovingFocus(container, {items: 'button', orientation, ...options});
        const detach = focus.attach();
        focus.update();
        return {container, focus, detach, buttons: [...container.querySelectorAll('button')]};
    }
    const press = (target, key, init = {}) => target.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, ...init}));

    it('puts one item in the tab order', () => {
        const {buttons} = group();
        expect(buttons.map(button => button.tabIndex)).toEqual([0, -1, -1, -1]);
    });

    it('moves with the arrows of its orientation, wraps, and goes to the ends', () => {
        const {buttons} = group();
        buttons[0].focus();
        press(buttons[0], 'ArrowRight');
        expect(document.activeElement).toBe(buttons[1]);
        press(buttons[1], 'ArrowDown');
        expect(document.activeElement).toBe(buttons[1]);
        press(buttons[1], 'ArrowRight');
        press(buttons[2], 'ArrowRight');
        expect(document.activeElement).toBe(buttons[0]);
        press(buttons[0], 'End');
        expect(document.activeElement).toBe(buttons[2]);
        expect(buttons.map(button => button.tabIndex)).toEqual([-1, -1, 0, -1]);
    });

    it('can skip a disabled item and stop at the ends', () => {
        const {buttons} = group('vertical', {skipDisabled: true, wrap: false});
        buttons[0].focus();
        press(buttons[0], 'ArrowDown');
        expect(document.activeElement).toBe(buttons[2]);
        press(buttons[2], 'ArrowDown');
        expect(document.activeElement).toBe(buttons[2]);
    });

    it('goes to an item by its first letters', () => {
        const {buttons} = group('vertical', {typeahead: true});
        buttons[0].focus();
        press(buttons[0], 'g');
        expect(document.activeElement).toBe(buttons[2]);
    });

    it('leaves a key with a modifier, and a key that a handler stopped', () => {
        const onKey = vi.fn(() => false);
        const {buttons} = group('horizontal', {onKey});
        buttons[0].focus();
        press(buttons[0], 'ArrowRight', {ctrlKey: true});
        expect(onKey).not.toHaveBeenCalled();
        press(buttons[0], 'ArrowRight');
        expect(document.activeElement).toBe(buttons[0]);
    });

    it('removes its listeners', () => {
        const {buttons, detach} = group();
        detach();
        buttons[0].focus();
        press(buttons[0], 'ArrowRight');
        expect(document.activeElement).toBe(buttons[0]);
    });
});

describe('popups and tokens', () => {
    it('puts a popup below its anchor, and above it when there is no room below', () => {
        const anchor = document.body.appendChild(document.createElement('button'));
        const popup = document.body.appendChild(document.createElement('div'));
        const view = document.documentElement;
        vi.spyOn(view, 'clientWidth', 'get').mockReturnValue(800);
        vi.spyOn(view, 'clientHeight', 'get').mockReturnValue(600);
        vi.spyOn(popup, 'getBoundingClientRect').mockReturnValue({width: 100, height: 200});
        vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({left: 10, right: 60, top: 20, bottom: 40, width: 50, height: 20});
        expect(placePopup(popup, anchor)).toBe('bottom');
        expect([popup.style.left, popup.style.top]).toEqual(['10px', '42px']);
        anchor.getBoundingClientRect.mockReturnValue({left: 10, right: 60, top: 500, bottom: 520, width: 50, height: 20});
        expect(placePopup(popup, anchor)).toBe('top');
        expect(popup.style.top).toBe('298px');
    });

    it('makes a popup smaller than the room on its side, so that it does not cover the anchor', () => {
        const anchor = document.body.appendChild(document.createElement('button'));
        const popup = document.body.appendChild(document.createElement('div'));
        vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(800);
        vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(600);
        // The popup is as tall as its max-height lets it be
        vi.spyOn(popup, 'getBoundingClientRect').mockImplementation(() => ({width: 100, height: Math.min(900, parseFloat(popup.style.maxHeight) || 900)}));
        vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({left: 10, right: 60, top: 280, bottom: 300, width: 50, height: 20});
        expect(placePopup(popup, anchor)).toBe('bottom');
        expect(popup.style.maxHeight).toBe('294px');
        expect(popup.style.top).toBe('302px');
        // A smaller limit in the CSS of the popup stays
        popup.style.cssText = '';
        const sheet = document.head.appendChild(document.createElement('style'));
        sheet.textContent = 'div.short { max-height: 120px; }';
        popup.className = 'short';
        placePopup(popup, anchor);
        expect(popup.style.maxHeight).toBe('120px');
        sheet.remove();
    });

    it('gives the widget token first, then the family, then the global token', () => {
        const css = tokenAliases('check-box');
        expect(css).toContain('--_face: var(--zest-check-box-face, var(--zest-control-face, var(--zest-color-face, ButtonFace)));');
        expect(tokenAliases('menu-bar', 'menu')).toContain('var(--zest-menu-face');
    });
});

describe('emit', () => {
    it('can send an event that a listener cancels', () => {
        const element = document.body.appendChild(document.createElement('typed-component'));
        element.addEventListener('zest-ask', e => e.preventDefault());
        expect(element.emit('zest-ask', {}, {cancelable: true})).toBe(false);
        expect(element.emit('zest-ask', {})).toBe(true);
    });
});

describe('shared observers', () => {
    it('uses one observer for many elements, and stops watching an element after its last removal', () => {
        const made = [];
        class FakeObserver {
            constructor(callback) { this.callback = callback; this.targets = new Set(); made.push(this); }
            observe(target, options) {
                if (options?.box === 'device-pixel-content-box') { throw new TypeError('unknown box'); }
                this.targets.add(target);
            }
            unobserve(target) { this.targets.delete(target); }
        }
        vi.stubGlobal('ResizeObserver', FakeObserver);
        const [a, b] = [document.createElement('div'), document.createElement('div')];
        const seen = [];
        const removeA1 = observeResize(a, () => seen.push('a1'), {box: 'border-box'});
        const removeA2 = observeResize(a, () => seen.push('a2'), {box: 'border-box'});
        observeResize(b, () => seen.push('b'), {box: 'border-box'});
        expect(made).toHaveLength(1);
        expect(made[0].targets.size).toBe(2);
        made[0].callback([{target: a}, {target: b}]);
        expect(seen).toEqual(['a1', 'a2', 'b']);
        removeA1();
        expect(made[0].targets.has(a)).toBe(true);
        removeA2();
        expect(made[0].targets.has(a)).toBe(false);
        // A box that the browser does not know falls back to the content box
        observeResize(a, () => {}, {box: 'device-pixel-content-box'});
        expect(made.at(-1).targets.has(a)).toBe(true);
        vi.unstubAllGlobals();
    });

    it('gives a no-op removal when the browser has no observer', () => {
        vi.stubGlobal('IntersectionObserver', undefined);
        expect(observeVisibility(document.createElement('div'), () => {})()).toBeUndefined();
        vi.unstubAllGlobals();
    });
});
