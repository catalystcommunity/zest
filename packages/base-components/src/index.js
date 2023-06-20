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
        return document.getElementById(templateId).innerHTML || '';
    } else {
        return null
    }
}
// For converting to and from attributes to attributes, as the only helper we rely on
function camelize(s) { return s.replace(/-./g, x=>x[1].toUpperCase()) }
function kebabize(s) { return s.replace(/[A-Z]+(?![a-z])|[A-Z]/g, (x, ofs) => (ofs ? "-" : "") + x.toLowerCase()) }

// Give us some of the basic functionality to reduce boilerplate
class BaseComponent extends HTMLElement {
    // Attributes that we observe
    changeAttributes;
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

    // Keep in mind that the constructor doesn't have access to attributes until DOM connection
    // most functionality should start in connectedCallback
    constructor() {
        super();
        this.changeAttributes = [];
        this.template = `<div class="defbasecomp">Default BaseComponent Template</div>`;
        this.styleTemplate = `.defbasecomp {display:none;}`;
        this.defaultTemplateId = 'defaultTemplateId';
        this.defaultStyleTemplateId = 'defaultStyleTemplateId';
    }
    // changeAttributes must be setup in whatever child constructor, or attributeChangedCallback will never get called
    static get observedAttributes() {
        return this.changeAttributes;
    }
    // Called any time one of the _observed_ attributes are changed
    // We would change the name, but this was set by the browser API
    attributeChangedCallback(property, oldValue, newValue) {
        if (oldValue === newValue) return;
        this[property] = newValue;
        this.postObservedAttributeChange();
    }
    // This should be overridden where we care about behavior after a change
    postObservedAttributeChange() { }
    // Called only once and can be overloaded
    connectedCallback() {
        // The precedence for components should be using an override template id if it is present
        // and the HTML attribute overrides a setting in JS on the class
        // then a default template id if it is present
        // then the template string if neither of those work

        // first get the override attributes from HTML into the JS world
        this.convertKebabAttributes(['override-template-id', 'override-style-template-id']);
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
    // Set attributes from kebab-case to camelCase properties
    convertKebabAttributes(attributes=[]) {
        for(let i = 0; i < attributes.length; i++) {
            let attrVal = this.getAttribute(attributes[i]);
            if (attrVal) {
                this[camelize(attributes[i])] = attrVal
            }
        }
    }
    // Set properties from camelCase to kebab-case properties
    convertCamelProperties(properties=[]) {
        for(let i = 0; i < properties.length; i++) {
            let propVal = this[properties[i]];
            if (propVal) {
                this.setAttribute(kebabize(attributes[i]), propVal)
            }
        }
    }
    // Something needs to generate the DOM tree of the component, so this is the suggested naming
    // since it follows a lot of actual frameworks it should be easiest to override this and keep compatible
    render() {
    }
}

// A simple addition to make the BaseComponent an open shadow root component with the same functionality
class OpenShadowComponent extends BaseComponent {
    shadow;
    constructor() {
        super();
    }
    connectedCallback(){
        super.connectedCallback();
        this.shadow = this.attachShadow({ mode: 'open' });
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
            console.log(this.registryName)
            console.log(ZestGlobalObject)
            throw new Error('Component Data Registry not found');
        }
        this.#registry = ZestGlobalObject[this.registryName];
        // If this isn't a registration function in that registry, fail miserably
        if (this.#registry[this.dataRegisterFuncName] === undefined) {
            throw new Error('Component Data Registry Function not found');
        }
        this.#dataRegisterFunc = this.#registry[this.dataRegisterFuncName];
        // Don't register until connected, as components are only there for display, not fetching/processing
        this.registerResult = this.#dataRegisterFunc(this.instanceId, this.registerData)
        if (this.registerResult && this.registerResult.unregisterFunc) {
            this.unregisterFunc = this.registerResult.unregisterFunc;
        }
        this.postDataRegistration()
    }
    // This should be overridden where we care about behavior after a change
    postDataRegistration() { }
    // Even if it never registered data, now cleanup is a no-op
    disconnectedCallback() {
        this.unregisterFunc(this.instanceId, this.unregisterData)
    }
}

// A simple addition to make the DataComponent an open shadow root component with the same functionality
class OpenShadowDataComponent extends DataComponent {
    shadow;
    constructor() {
        super();
    }
    connectedCallback(){
        super.connectedCallback();
        this.shadow = this.attachShadow({ mode: 'open' });
    }
}

export { ZestGlobalObject, BaseComponent, OpenShadowComponent, DataComponent, OpenShadowDataComponent }
