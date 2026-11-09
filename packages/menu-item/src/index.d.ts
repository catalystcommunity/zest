// Type declarations for @catalystcommunity/menu-item. The source is JavaScript; keep this
// file in step with src/index.js.
import { BaseComponent } from '@catalystcommunity/base-components';

/** One menu entry. Attributes: `href`, `display`, `icon`. */
export default class MenuItem extends BaseComponent {
    static changeAttributes: string[];
    /** A link. With no link, the item is plain text. */
    href: string | null;
    /** The text. */
    display: string | null;
    /** The URL of an icon image. */
    icon: string | null;
    render(): void;
}

export declare class ShadowMenuItem extends MenuItem {
    shadow: ShadowRoot;
}

export { MenuItem };
