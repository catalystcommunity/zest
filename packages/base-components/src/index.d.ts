// Type declarations for @catalystcommunity/base-components. The source is JavaScript; keep this
// file in step with src/*.js. __tests__/types.spec.js checks that each export has a declaration.

/** The global object for registries: `AppGlobal` if it exists, else `window`. */
export declare const ZestGlobalObject: any;

/** A removal function. Give it to `BaseComponent.own()`. */
export type Removal = () => void;

/** One entry of `static properties`. */
export interface PropertyDeclaration {
    type?: StringConstructor | NumberConstructor | BooleanConstructor | ArrayConstructor | ObjectConstructor | FunctionConstructor;
    /** A value, or a function that makes a value for each instance. */
    default?: unknown;
    /** The attribute name. The default is the property name in kebab-case. `false` gives no attribute. */
    attribute?: string | false;
    /** A property change also sets the attribute. */
    reflect?: boolean;
    /** `false`: a change does not call `invalidate()`. */
    render?: boolean;
}

export type PropertyDeclarations = Record<string, PropertyDeclaration>;

export declare class BaseComponent extends HTMLElement {
    /** The default CSS of the component. The class adds it in `@layer zest`. */
    static styles: string;
    /** Adds CSS to each instance of this class, also the instances that are already on the page. */
    static addStyles(css: string): void;
    /** Attributes to observe. Declare as a static field. */
    static changeAttributes: string[];
    /** Typed properties, each with an attribute unless `attribute: false`. */
    static properties: PropertyDeclarations;
    /** `'microtask'` renders after the current work. `'frame'` renders in the next animation frame. */
    static renderTiming: 'microtask' | 'frame';
    static readonly observedAttributes: string[];

    defaultTemplateId: string;
    overrideTemplateId?: string;
    template: string;
    defaultStyleTemplateId: string;
    overrideStyleTemplateId?: string;
    styleTemplate: string | null;
    /** The shadow root, or the element itself in the light DOM. */
    root: HTMLElement | ShadowRoot;

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    readProperty(name: string): unknown;
    writeProperty(name: string, value: unknown): void;
    /** Called after a declared property changes, from the property or from its attribute. */
    propertyChanged(name: string, oldValue: unknown, newValue: unknown): void;
    postObservedAttributeChange(): void;
    /** True while the element is on the page. */
    isActive(): boolean;
    /** Keeps a removal function until the element disconnects. Throws if the element is not connected. */
    own<T extends Removal>(remove: T): T;
    /** Adds an event listener that the element removes when it disconnects. */
    listen<K extends keyof HTMLElementEventMap>(target: EventTarget, eventName: K, handler: (event: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): Removal;
    listen(target: EventTarget, eventName: string, handler: (event: any) => void, options?: boolean | AddEventListenerOptions): Removal;
    /** Sends a `CustomEvent` that bubbles and is composed. Returns false if a listener called `preventDefault()`. */
    emit<T = unknown>(name: string, detail?: T, options?: {cancelable?: boolean}): boolean;
    /** Renders one time after the current work, however many times this is called. */
    invalidate(): void;
    applyStyles(container?: Node): void;
    convertKebabAttributes(attributes?: string[]): void;
    convertCamelProperties(properties?: string[]): void;
    stringToElement(html: string): DocumentFragment;
    render(): void;
}

export declare class OpenShadowComponent extends BaseComponent {
    shadow: ShadowRoot;
}

/** A registry function: `(instanceId, registerData, isActive) => result`. */
export type DataRegisterFunc = (instanceId: string, registerData: unknown, isActive: () => boolean) => {unregisterFunc?: ((instanceId: string, unregisterData: unknown) => void) | string} | void;

export declare class DataComponent extends BaseComponent {
    instanceId: string;
    registryName: string;
    dataRegisterFuncName: string;
    registerData: unknown;
    registerResult: unknown;
    unregisterFunc: ((instanceId: string, unregisterData: unknown) => void) | string;
    unregisterData: unknown;
    doDataRegistration(): void;
    postDataRegistration(): void;
}

export declare class OpenShadowDataComponent extends DataComponent {
    shadow: ShadowRoot;
}

/** Calls `thing.cleanup()` if it exists. */
export declare function CheckCleanupCall(thing: unknown): void;

export declare function scheduleRender(component: object, render: () => void): void;
export declare function isRenderScheduled(component: object): boolean;
/** Does the waiting renders now. Returns the count of renders. */
export declare function flushRenders(): number;

/** The tag of the class. If the class has no tag, this defines it with the preferred tag. */
export declare function tagFor(componentClass: CustomElementConstructor, preferredTag: string): string;
export declare function createElementOf<T extends HTMLElement = HTMLElement>(componentClass: CustomElementConstructor, preferredTag: string, attributes?: Record<string, string | number | boolean | null | undefined>): T;
/** Defines each tag of the map that is not defined yet. */
export declare function defineElements(definitions: Record<string, CustomElementConstructor>): void;

export interface RovingFocusOptions {
    /** A CSS selector, or a function that gives the items in order. */
    items: string | (() => HTMLElement[]);
    orientation?: 'horizontal' | 'vertical' | 'both';
    wrap?: boolean;
    skipDisabled?: boolean;
    typeahead?: boolean;
    onMove?: ((item: HTMLElement, event: Event | null) => void) | null;
    /** Return false to stop the key. */
    onKey?: ((event: KeyboardEvent, item: HTMLElement) => boolean | void) | null;
}

export declare class RovingFocus {
    constructor(container: HTMLElement | ShadowRoot, options: RovingFocusOptions);
    readonly items: HTMLElement[];
    readonly current: HTMLElement | null;
    /** Adds the listeners. Give the result to `own()`. */
    attach(): Removal;
    update(current?: HTMLElement | null): void;
    focus(item: HTMLElement, event?: Event | null): void;
}

export declare function isRtl(element: Element): boolean;
export declare function isDisabled(element: Element): boolean;

export type PopupPlacement = `${'top' | 'bottom' | 'left' | 'right'}-${'start' | 'end'}` | 'top' | 'bottom' | 'left' | 'right';
/** Puts a popup next to its anchor, in the window. Returns the side that it used. */
export declare function placePopup(popup: HTMLElement, anchor: Element, options?: {placement?: PopupPlacement | string; offset?: number; margin?: number}): string;
/** Puts a popup at a point, for example a context menu at the pointer. Returns an anchor at the point. */
export declare function placePopupAt(popup: HTMLElement, x: number, y: number, options?: {margin?: number}): {getBoundingClientRect(): Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>};

export declare function observeResize(element: Element, callback: (entry: ResizeObserverEntry) => void, options?: {box?: ResizeObserverBoxOptions}): Removal;
export declare function observeVisibility(element: Element, callback: (entry: IntersectionObserverEntry) => void, options?: {rootMargin?: string; threshold?: number | number[]}): Removal;

/** CSS custom properties `--_<role>` for a widget, with the fallback chain of its family. */
export declare function tokenAliases(widget: string, family?: string): string;
/** CSS declarations that hide an element and keep it for a screen reader. */
export declare const visuallyHidden: string;
