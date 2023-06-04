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
        throw new Error(`Requested to get a templateId that does not exist: {templateId}`);
    }
}

// Give us some of the basic functionality to reduce boilerplate
class BaseComponent extends HTMLElement {
    // Attributes that we observe
    changeAttributes;
    // Override Id of the component template to use, if provided, otherwise defaulted
    overrideTemplateId;
    // The actual template string
    template;
    // Override Id of the component style template to use, if provided
    overrideStyleTemplateId;
    // The actual style template string
    styleTemplate;

    // Keep in mind that the constructor doesn't have access to attributes until DOM connection
    // most functionality should start in connectedCallback
    constructor() {
        super();
        this.changeAttributes = [];
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
    // Called only once 
    connectedCallback() {
        // This gets the template and styles, and if they aren't present they will be left alone
        let templateId = 'defaultTemplateId';
        if (this.overrideTemplateId) {
            templateId = this.overrideTemplateId;
        }
        let styleTemplateId = 'defaultStyleTemplateId'
        if (this.overrideStyleTemplateId) {
            styleTemplateId = this.overrideStyleTemplateId;
        }
        // Now we have the IDs to try, so attempt them
        try {
            this.template = getTemplate(templateId);
        } catch(error) {
            if (error != `Requested to get a templateId that does not exist: {templateId}`) {
                throw(error)
            }
        }
        try {
            this.styleTemplate = getTemplate(styleTemplateId);
        } catch(error) {
            if (error != `Requested to get a templateId that does not exist: {templateId}`) {
                throw(error)
            }
        }
        // Normally one would call this.render() here, but we leave it out for components to call in their own
    }
    render() {
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
    // The name of the data func registry
    registryName;
    // When we get the registry successfully, store it here so we don't keep checking things
    #registry;
    // The name of the function in the registry to call
    // This is separate from the registry so we can have multiple registries or data functions
    // and only have to override one
    // Components should have default names for the dataRegisterFuncName
    dataRegisterFuncName;
    // Save the function internally
    #dataRegisterFunc;
    // This should be any data used to register the component except the ID
    // Note that depending on your component's API, you could pass callbacks to this
    registerData;
    // If the dataRegisterFunc returns an unregisterFunc, we save it here
    // It isn't private because we want to allow different lifecycle controls for some scenarios
    unregisterFunc;
    // In the case that the unregistering requires data, use this.
    unregisterData;

    constructor() {
        super();
        // Always have a default no-op unregistration
        this.unregisterFunc = function() {}
        // If this isn't a browser or there's no registry, fail miserably
        if (window === undefined || window[this.registryName] === undefined) {
            throw new Error('Component Data Registry not found');
        }
        this.#registry = window[this.registryName];
        // If this isn't a registration function in that registry, fail miserably
        if (this.#registry[this.dataRegisterFuncName] === undefined) {
            throw new Error('Component Data Registry Function not found');
        }
        this.#dataRegisterFunc = this.#registry[this.dataRegisterFuncName];
        // Don't register until connected, as components are only there for display, not fetching/processing

        // Make an ID, which will be overridden in connectedCallback if provided, or can be overridden as a property beforehand
        this.instanceId = generate_id(12);
    }
    connectedCallback(){
        super.connectedCallback();
        let unregisterFunc = this.#dataRegisterFunc(this.instanceId, this.registerData)
        if (unregisterFunc) {
            this.unregisterFunc = unregisterFunc;
        }
    }
    disconnectedCallback() {
        this.unregisterFunc(this.instanceId, this.unregisterData)
    }
}

// At the moment we don't see a reason to have shadow components that aren't DataComponents
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

export { BaseComponent, DataComponent, OpenShadowDataComponent }
