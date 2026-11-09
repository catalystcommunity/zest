// Type declarations for @catalystcommunity/menu-gutter. The source is JavaScript; keep this
// file in step with src/index.js.
import { BaseComponent } from '@catalystcommunity/base-components';

/** A container for items at the bottom of a menu. Set `template` or a template id for its content. */
export default class MenuGutter extends BaseComponent {
    render(): void;
}

export declare class ShadowMenuGutter extends MenuGutter {
    shadow: ShadowRoot;
}

export { MenuGutter };
