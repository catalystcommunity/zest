import { scheduleRender } from './scheduler.js';

// We want to separate ourselves from "window" or whatever, so keep the "AppGlobal" object
// at the execution context level. If there's a closure, now we have an organization point
// that anyone can use to isolate things how they want. Attach things by name to this
// from anywhere and be happy, otherwise we default back to "window"
let ZestGlobalObject
try {
    ZestGlobalObject = AppGlobal
}catch(e) {
    ZestGlobalObject = window
}


// Should only be used for default IDs, not for anything sensitive
function generate_id(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

// This should just safely make sure the template exists and retrieve it
function getTemplate(templateId) {
    if (templateId && document.getElementById(templateId)) {
        // console.log(document.getElementById(templateId).innerHTML);
        return document.getElementById(templateId).innerHTML || '';
    } else {
        return null
    }
}
// For converting to and from attributes to attributes, as the only helper we rely on
function camelize(s) { return s.replace(/-./g, x=>x[1].toUpperCase()) }
function kebabize(s) { return s.replace(/[A-Z]+(?![a-z])|[A-Z]/g, (x, ofs) => (ofs ? "-" : "") + x.toLowerCase()) }

// A function to simplify cleanup since Javascript doesn't have destructors. It will
// simply check if a cleanup function exists, and call it if there is.
function CheckCleanupCall(thing){
    if (thing
        && (typeof thing === "function" || typeof thing === "object") 
        && thing['cleanup'] 
        && typeof thing['cleanup'] === "function") {

        thing.cleanup();
    }
}

// One stylesheet for each class that declares styles, which each instance shares
const styleEntries = new WeakMap();

function styleEntry(componentClass) {
    let owner = componentClass;
    while (!Object.hasOwn(owner, 'styles')) { owner = Object.getPrototypeOf(owner); }
    if (!styleEntries.has(owner)) {
        styleEntries.set(owner, {owner, added: '', sheet: null});
    }
    return styleEntries.get(owner);
}

// The defaults are in a layer, so any page style or added style without a layer wins over them
function styleText(entry) {
    const defaults = entry.owner.styles ? `@layer zest {\n${entry.owner.styles}\n}\n` : '';
    return defaults + entry.added;
}

function canAdopt(target) {
    return 'adoptedStyleSheets' in target && typeof CSSStyleSheet?.prototype?.replaceSync === 'function';
}

// Typed properties. `static properties = {value: {type: Number, default: 0}}` makes a property and
// an attribute that agree. A change of either calls propertyChanged() and invalidate().
const converters = {
    String: {from: (text) => text, to: (value) => String(value)},
    Number: {from: (text) => (text === '' ? null : Number(text)), to: (value) => String(value)},
    Boolean: {from: (text) => text !== 'false', to: () => ''},
    Array: {from: (text) => JSON.parse(text), to: (value) => JSON.stringify(value)},
    Object: {from: (text) => JSON.parse(text), to: (value) => JSON.stringify(value)},
};

function converterOf(declaration) {
    return converters[declaration.type?.name ?? 'String'] ?? converters.String;
}

// The declarations of a class and of each class that it extends, the nearest first
const declaredCache = new WeakMap();
function declaredProperties(componentClass) {
    if (declaredCache.has(componentClass)) { return declaredCache.get(componentClass); }
    const chain = [];
    for (let at = componentClass; at && at !== HTMLElement; at = Object.getPrototypeOf(at)) {
        if (Object.hasOwn(at, 'properties')) { chain.unshift(at.properties); }
    }
    const merged = {};
    for (const properties of chain) {
        for (const [name, declaration] of Object.entries(properties)) {
            const attribute = declaration.attribute === false ? null : (declaration.attribute ?? kebabize(name));
            merged[name] = {...declaration, name, attribute};
        }
    }
    const byAttribute = new Map(Object.values(merged).filter(item => item.attribute).map(item => [item.attribute, item]));
    const result = {byName: merged, byAttribute, names: Object.keys(merged)};
    declaredCache.set(componentClass, result);
    return result;
}

const installed = new WeakSet();
function installProperties(componentClass) {
    if (installed.has(componentClass)) { return; }
    installed.add(componentClass);
    for (const declaration of Object.values(declaredProperties(componentClass).byName)) {
        if (Object.getOwnPropertyDescriptor(componentClass.prototype, declaration.name)) { continue; }
        Object.defineProperty(componentClass.prototype, declaration.name, {
            configurable: true,
            enumerable: true,
            get() { return this.readProperty(declaration.name); },
            set(value) { this.writeProperty(declaration.name, value); },
        });
    }
}

function defaultOf(declaration) {
    const value = declaration.default;
    if (value === undefined && declaration.type === Boolean) { return false; }
    return typeof value === 'function' && declaration.type !== Function ? value() : value;
}

// Give us some of the basic functionality to reduce boilerplate
class BaseComponent extends HTMLElement {
    // The default CSS of the component as text. A child class declares it as a static field.
    static styles = '';
    // Adds CSS to each instance of this class, also the instances that are already on the page
    static addStyles(css) {
        const entry = styleEntry(this);
        entry.added += `${css}\n`;
        entry.sheet?.replaceSync(styleText(entry));
    }
    // Attributes that we observe. The browser reads this one time, when the element is defined,
    // so a child class must declare it as a static field: static changeAttributes = ['some-attr'];
    static changeAttributes = [];
    // Typed properties, each with an attribute unless `attribute: false`:
    // static properties = {value: {type: Number, default: 0}, open: {type: Boolean, reflect: true}};
    // Do not also declare a class field with the same name. It would hide the property.
    static properties = {};
    // 'microtask' renders after the current work. 'frame' renders one time in the next animation
    // frame, so that a storm of changes paints at the rate of the screen.
    static renderTiming = 'microtask';
    // Default template id, should be set in the constructor of child components
    defaultTemplateId;
    // Override Id of the component template to use, if provided, otherwise defaulted
    overrideTemplateId;
    // The actual template string, which all components should provide a default for
    template;
    // Default style template id, should be set in the constructor of the child components
    defaultStyleTemplateId;
    // Override Id of the component style template to use, if provided
    overrideStyleTemplateId;
    // The actual style template string, which all components should provide a default for
    styleTemplate;
    // It is helpful to have a reference to either the shadow root or the self for rendering
    // consistently between shadow or nonshadow instances without complex reflection
    root;
    // The removal function of each thing that this element owns. disconnectedCallback calls them all.
    #owned = [];
    #invalidated = false;
    #values = new Map();
    #reflecting = false;
    #early = [];

    // Keep in mind that the constructor doesn't have access to attributes until DOM connection
    // most functionality should start in connectedCallback
    constructor() {
        super();
        this.template = `<div class="defbasecomp">Default BaseComponent Template</div>`;
        this.styleTemplate = this.constructor.styles ? null : `<style>.defbasecomp {display:none;}</style>`;
        this.defaultTemplateId = 'defaultTemplateId';
        this.defaultStyleTemplateId = 'defaultStyleTemplateId';
        this.root = this;
        installProperties(this.constructor);
        // A value that was set before the tag was defined is an own field, which hides the property.
        // The fields of the child class do not exist yet, so the change is told at the first connect.
        for (const name of declaredProperties(this.constructor).names) {
            if (Object.hasOwn(this, name)) {
                const value = this[name];
                delete this[name];
                this.#values.set(name, value);
                this.#early.push(name);
            }
        }
    }
    // changeAttributes must be declared as a static field on the child class, or attributeChangedCallback will never get called
    static get observedAttributes() {
        installProperties(this);
        return [...new Set([...this.changeAttributes, ...declaredProperties(this).byAttribute.keys()])];
    }
    // Called any time one of the _observed_ attributes are changed
    // We would change the name, but this was set by the browser API
    attributeChangedCallback(property, oldValue, newValue) {
        if (oldValue === newValue) return;
        const declaration = declaredProperties(this.constructor).byAttribute.get(property);
        if (declaration) {
            if (this.#reflecting) { return; }
            let value;
            try {
                value = newValue === null ? defaultOf(declaration) : converterOf(declaration).from(newValue);
            } catch (e) {
                // The browser calls this, so a throw would not reach the code that set the attribute
                const error = new Error(`The ${property} attribute of ${this.localName} is not a valid ${declaration.type?.name}: ${newValue}`);
                if (typeof reportError === 'function') { reportError(error); } else { console.error(error); }
                return;
            }
            this.#store(declaration, value, false);
            return;
        }
        this[camelize(property)] = newValue;
        this.postObservedAttributeChange();
    }
    // The value of a declared property
    readProperty(name) {
        if (this.#values.has(name)) { return this.#values.get(name); }
        const declaration = declaredProperties(this.constructor).byName[name];
        const value = defaultOf(declaration);
        // An array or an object default belongs to this instance, so a change to it must stay
        if (value && typeof value === 'object') { this.#values.set(name, value); }
        return value;
    }
    writeProperty(name, value) {
        const declaration = declaredProperties(this.constructor).byName[name];
        if (declaration.type === Boolean) { value = Boolean(value); }
        if (declaration.type === Number && value !== null && value !== undefined) { value = Number(value); }
        this.#store(declaration, value, true);
    }
    #store(declaration, value, reflect) {
        const old = this.readProperty(declaration.name);
        if (Object.is(old, value) && this.#values.has(declaration.name)) { return; }
        this.#values.set(declaration.name, value);
        if (reflect && declaration.reflect && declaration.attribute) {
            this.#reflecting = true;
            try {
                if (value === null || value === undefined || value === false) {
                    this.removeAttribute(declaration.attribute);
                } else {
                    this.setAttribute(declaration.attribute, converterOf(declaration).to(value));
                }
            } finally {
                this.#reflecting = false;
            }
        }
        if (Object.is(old, value)) { return; }
        this.propertyChanged(declaration.name, old, value);
        if (declaration.render !== false) { this.invalidate(); }
    }
    #tellEarlyValues() {
        const names = this.#early;
        this.#early = [];
        for (const name of names) {
            const declaration = declaredProperties(this.constructor).byName[name];
            const value = this.#values.get(name);
            this.#values.delete(name);
            this.#store(declaration, value, true);
        }
    }
    // Called after a declared property changes, from the property or from its attribute
    propertyChanged(name, oldValue, newValue) { }
    // This should be overridden where we care about behavior after a change
    postObservedAttributeChange() { }
    // Called every time the element is connected, which can be more than one time, and can be overloaded
    connectedCallback() {
        // The precedence for components should be using an override template id if it is present
        // and the HTML attribute overrides a setting in JS on the class
        // then a default template id if it is present
        // then the template string if neither of those work

        // A second connect with no disconnect between them must not keep two of each subscription
        this.#release();
        if (this.#early.length) { this.#tellEarlyValues(); }
        // first get the override attributes from HTML into the JS world
        if (this.hasAttributes()) {
            this.convertKebabAttributes(['override-template-id', 'override-style-template-id']);
        }
        // This gets the template and styles, and if they aren't present they will be left alone
        let template = null;
        if (template === null && this.overrideTemplateId) {
            template = getTemplate(this.overrideTemplateId);
        }
        if (template === null && this.defaultTemplateId){
            template = getTemplate(this.defaultTemplateId);
        }
        if (template !== null) {
            this.template = template
        }
        // Now same thing for styles
        let styleTemplate = null;
        if (styleTemplate === null && this.overrideStyleTemplateId) {
            styleTemplate = getTemplate(this.overrideStyleTemplateId);
        }
        if (styleTemplate === null && this.defaultStyleTemplateId){
            styleTemplate = getTemplate(this.defaultStyleTemplateId);
        }
        if (styleTemplate !== null) {
            this.styleTemplate = styleTemplate
        }
        // Normally one would call this.render() here, but we leave it out for components to call in their own
    }
    // Removes everything that this element owns. This is the destructor of the element.
    disconnectedCallback() {
        this.#release();
    }
    // True while the element is on the page. A subscriber with an isActive check calls this.
    isActive() {
        return this.isConnected;
    }
    // Keeps a removal function until the element disconnects: this.own(store.subscribe(...))
    // Call it in connectedCallback. Before the element connects, nothing would remove it.
    own(remove) {
        if (typeof remove !== 'function') {
            throw new Error(`own() needs a removal function, not: ${remove}`);
        }
        if (!this.isConnected) {
            throw new Error('own() was called when the element was not connected. Call it in connectedCallback.');
        }
        this.#owned.push(remove);
        return remove;
    }
    // Adds an event listener that the element removes when it disconnects
    listen(target, eventName, handler, options) {
        target.addEventListener(eventName, handler, options);
        return this.own(() => target.removeEventListener(eventName, handler, options));
    }
    // The last thing owned is the first removed. Each removal runs, also when one before it throws.
    #release() {
        if (!this.#owned.length) { return; }
        const owned = this.#owned;
        this.#owned = [];
        const errors = [];
        for (const remove of owned.reverse()) {
            try { remove(); } catch (e) { errors.push(e); }
        }
        if (errors.length === 1) { throw errors[0]; }
        if (errors.length) { throw new AggregateError(errors, 'More than one removal failed'); }
    }
    // Sends an event that a parent can hear, also from inside a shadow root
    // With {cancelable: true}, a listener can call preventDefault(), and the result is false
    emit(name, detail, {cancelable = false} = {}) {
        return this.dispatchEvent(new CustomEvent(name, {detail, bubbles: true, composed: true, cancelable}));
    }
    // Renders one time after the current work, however many times this is called
    invalidate() {
        if (this.#invalidated) { return; }
        this.#invalidated = true;
        const paint = () => {
            this.#invalidated = false;
            if (this.isConnected) { this.render(); }
        };
        if (this.constructor.renderTiming === 'frame') {
            scheduleRender(this, paint);
        } else {
            queueMicrotask(paint);
        }
    }
    // An instance style template replaces the defaults of the class. Call this from render().
    // A browser with no adopted stylesheets gets a style element in the container.
    applyStyles(container = this.root) {
        if (this.styleTemplate) {
            container.appendChild(this.stringToElement(`${this.styleTemplate}`));
            return;
        }
        const entry = styleEntry(this.constructor);
        const text = styleText(entry);
        if (!text) { return; }
        const target = this.root.getRootNode();
        if (canAdopt(target)) {
            try {
                if (!entry.sheet) {
                    entry.sheet = new CSSStyleSheet();
                    entry.sheet.replaceSync(text);
                }
                if (!target.adoptedStyleSheets.includes(entry.sheet)) {
                    target.adoptedStyleSheets = [...target.adoptedStyleSheets, entry.sheet];
                }
                return;
            } catch (e) {
                // A sheet can only join the document that made it, so an element in a frame continues below
                if (e.name !== 'NotAllowedError') { throw e; }
            }
        }
        const style = document.createElement('style');
        style.textContent = text;
        container.appendChild(style);
    }
    // Set attributes from kebab-case to camelCase properties
    convertKebabAttributes(attributes=[]) {
        for(let i = 0; i < attributes.length; i++) {
            let attrVal = this.getAttribute(attributes[i]);
            // A boolean attribute has an empty value, so only a missing attribute is skipped
            if (attrVal !== null) {
                this[camelize(attributes[i])] = attrVal
            }
        }
    }
    // Set properties from camelCase to kebab-case attributes
    convertCamelProperties(properties=[]) {
        for(let i = 0; i < properties.length; i++) {
            let propVal = this[properties[i]];
            if (propVal !== undefined && propVal !== null && propVal !== false) {
                this.setAttribute(kebabize(properties[i]), propVal)
            }
        }
    }
    // Often we want to be able to append an HTML string as if it were elements. This helper converts the string.
    stringToElement(html) {
        var template = document.createElement('template');
        html = html.trim(); // Never return a text node of whitespace as the result
        template.innerHTML = html;
        return template.content;
    }
    // Something needs to generate the DOM tree of the component, so this is the suggested naming
    // since it follows a lot of actual frameworks it should be easiest to override this and keep compatible
    render() {
    }
}

// A simple addition to make the BaseComponent an open shadow root component with the same functionality
// This is also only really useful if you want to skip extending the BaseComponent
class OpenShadowComponent extends BaseComponent {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.root = this.shadow;
    }
    connectedCallback(){
        super.connectedCallback();
    }
}

// For Components that are not simple display something from attributes
// For instance if I need to get a set of data, I need a registry I can call for my data or updates to it
// This is the base of that need
// This keeps the concern of "where do I get data" separate from the component's jobs and
// allows interop with whatever we want to use on a per-component-instance basis
class DataComponent extends BaseComponent {
    // Randomly generated ID for the component, unless specified in attributes
    instanceId;
    // The name of the data func registry, child components should have a default name
    registryName;
    // When we get the registry successfully, store it here so we don't keep checking things
    #registry;
    // The name of the function in the registry to call
    // This is separate from the registry so we can have multiple registries or data functions
    // and only have to override one
    // Child components should have a default name for the dataRegisterFuncName
    dataRegisterFuncName;
    // Save the function internally
    #dataRegisterFunc;
    // This should be any data used to register the component except the ID
    // Note that depending on your component's API, you could pass callbacks to this
    registerData;
    // The results from data registration, the only requirement of which is the property "unregisterFunc"
    // if present is the unregister function called by the disconnectedCallback
    registerResult;
    // If the dataRegisterFunc returns an unregisterFunc, we save it here
    // It isn't private because we want to allow different lifecycle controls for some scenarios
    unregisterFunc;
    // In the case that the unregistering requires data, use this.
    unregisterData;

    constructor() {
        super();
        // Always have a default no-op unregistration
        this.unregisterFunc = function() {}
        // Make an ID, which will be overridden in connectedCallback if provided, or can be overridden as a property beforehand
        this.instanceId = generate_id(12);
    }
    connectedCallback(){
        super.connectedCallback();
        this.convertKebabAttributes(['instance-id', 'data-register-func-name', 'registry-name', 'register-data', 'unregister-func', 'unregister-data']);
    }
    // This is a separate function not called in this so components can choose constructor or connected 
    // execution as appropriate, or skip it entirely and implement their own thing
    doDataRegistration(){
        // If there's no registry, fail miserably
        if (ZestGlobalObject === undefined || ZestGlobalObject[this.registryName] === undefined) {
            throw new Error(`Component Data Registry not found: ${this.registryName}`);
        }
        this.#registry = ZestGlobalObject[this.registryName];
        // If this isn't a registration function in that registry, fail miserably
        if (this.#registry[this.dataRegisterFuncName] === undefined) {
            throw new Error(`Component Data Registry Function not found: ${this.dataRegisterFuncName}`);
        }
        this.#dataRegisterFunc = this.#registry[this.dataRegisterFuncName];
        // Don't register until connected, as components are only there for display, not fetching/processing
        // The registry can call isActive before it sends data, and drop the component if it is not true
        this.registerResult = this.#dataRegisterFunc(this.instanceId, this.registerData, () => this.isActive())
        if (this.registerResult && this.registerResult.unregisterFunc) {
            this.unregisterFunc = this.registerResult.unregisterFunc;
        }
        // The unregister-func attribute is the name of a function in the registry
        if (typeof this.unregisterFunc === 'string') {
            const unregisterName = this.unregisterFunc;
            if (typeof this.#registry[unregisterName] !== 'function') {
                throw new Error(`Component Data Registry Function not found: ${unregisterName}`);
            }
            this.unregisterFunc = this.#registry[unregisterName];
        }
        this.postDataRegistration()
    }
    // This should be overridden where we care about behavior after a change
    postDataRegistration() { }
    // Even if it never registered data, now cleanup is a no-op
    disconnectedCallback() {
        try {
            super.disconnectedCallback();
        } finally {
            const unregisterFunc = this.unregisterFunc;
            // Each registration gets one unregistration. A reconnect registers again.
            this.unregisterFunc = function() {}
            if (typeof unregisterFunc === 'function') {
                unregisterFunc(this.instanceId, this.unregisterData)
            }
        }
    }
}

// A simple addition to make the DataComponent an open shadow root component with the same functionality
class OpenShadowDataComponent extends DataComponent {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.root = this.shadow;
    }
    connectedCallback(){
        super.connectedCallback();
    }
}

export { ZestGlobalObject, BaseComponent, OpenShadowComponent, DataComponent, OpenShadowDataComponent, CheckCleanupCall }
export { scheduleRender, isRenderScheduled, flushRenders } from './scheduler.js';
export { tagFor, createElementOf, defineElements } from './elements.js';
export { RovingFocus, isRtl, isDisabled } from './focus.js';
export { placePopup, placePopupAt } from './popup.js';
export { observeResize, observeVisibility } from './observe.js';
export { tokenAliases, visuallyHidden } from './tokens.js';
