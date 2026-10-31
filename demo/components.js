// A page can define a tag only one time, so each component has a light DOM tag and a shadow DOM tag.
// The menu makes menu-item, menu-logo, and menu-gutter elements itself, so those tags are the light ones.
import {
  BaseComponent, OpenShadowComponent, DataComponent,
  DateTimePicker, ShadowDateTimePicker,
  MenuGutter, ShadowMenuGutter,
  MenuItem, ShadowMenuItem,
  MenuLogo, ShadowMenuLogo,
  TwoTierMenu, ShadowTwoTierMenu,
} from '../src/index.js';

// Examples of what an application writes with the base classes
class GalleryBase extends BaseComponent {
  connectedCallback() {
    super.connectedCallback();
    this.render();
  }
  render() {
    this.root.innerHTML = this.template;
    this.root.appendChild(this.stringToElement(this.styleTemplate));
  }
}

class GalleryShadow extends OpenShadowComponent {
  connectedCallback() {
    super.connectedCallback();
    this.render();
  }
  render() {
    this.root.innerHTML = this.template;
    this.root.appendChild(this.stringToElement(this.styleTemplate));
  }
}

class GalleryObserved extends BaseComponent {
  static changeAttributes = ['shown-text'];
  postObservedAttributeChange() {
    this.textContent = `shown-text is: ${this.shownText}`;
  }
}

class GalleryData extends DataComponent {
  connectedCallback() {
    super.connectedCallback();
    this.doDataRegistration();
  }
  postDataRegistration() {
    this.textContent = `Registered as ${this.instanceId}: ${this.registerResult.message}`;
  }
}

const definitions = {
  'date-time-picker': DateTimePicker,
  'shadow-date-time-picker': ShadowDateTimePicker,
  'menu-gutter': MenuGutter,
  'shadow-menu-gutter': ShadowMenuGutter,
  'menu-item': MenuItem,
  'shadow-menu-item': ShadowMenuItem,
  'menu-logo': MenuLogo,
  'shadow-menu-logo': ShadowMenuLogo,
  'two-tier-menu': TwoTierMenu,
  'shadow-two-tier-menu': ShadowTwoTierMenu,
  'gallery-base': GalleryBase,
  'gallery-shadow': GalleryShadow,
  'gallery-observed': GalleryObserved,
  'gallery-data': GalleryData,
};

export function defineComponents() {
  for (const [tag, componentClass] of Object.entries(definitions)) {
    customElements.define(tag, componentClass);
  }
}
