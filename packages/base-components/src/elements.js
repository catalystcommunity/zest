// A parent that makes child components needs their tag. The application can define a class under
// any tag, so the parent asks for the tag of the class. Nothing is defined until a parent asks.

const ourTags = new WeakMap();

function nameOf(componentClass) {
    return customElements.getName?.(componentClass) ?? ourTags.get(componentClass) ?? null;
}

// The tag of the class. If the class has no tag, this defines it with the preferred tag. If another
// class has that tag, a child class of this one gets a new tag, so that both work.
export function tagFor(componentClass, preferredTag) {
    const known = nameOf(componentClass);
    if (known) { return known; }
    if (!customElements.get(preferredTag)) {
        try {
            customElements.define(preferredTag, componentClass);
            ourTags.set(componentClass, preferredTag);
            return preferredTag;
        } catch (e) {
            // The application defined the class with another tag, and this browser cannot tell us that tag
            if (e.name !== 'NotSupportedError') { throw e; }
        }
    }
    let number = 2;
    while (customElements.get(`${preferredTag}-${number}`)) { number++; }
    const tag = `${preferredTag}-${number}`;
    customElements.define(tag, class extends componentClass {});
    ourTags.set(componentClass, tag);
    return tag;
}

// Makes an element of the class, with attributes
export function createElementOf(componentClass, preferredTag, attributes = {}) {
    const element = document.createElement(tagFor(componentClass, preferredTag));
    for (const [name, value] of Object.entries(attributes)) {
        if (value === false || value === null || value === undefined) { continue; }
        element.setAttribute(name, value === true ? '' : value);
    }
    return element;
}

// Defines each tag of a map that is not defined yet, for example {'push-button': PushButton}
export function defineElements(definitions) {
    for (const [tag, componentClass] of Object.entries(definitions)) {
        if (!customElements.get(tag) && !nameOf(componentClass)) {
            customElements.define(tag, componentClass);
            ourTags.set(componentClass, tag);
        }
    }
}
