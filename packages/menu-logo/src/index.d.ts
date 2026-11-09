// Type declarations for @catalystcommunity/menu-logo. The source is JavaScript; keep this
// file in step with src/index.js.
import { BaseComponent } from '@catalystcommunity/base-components';

/** The logo at the top of a menu. Attributes: `logo`, `alt`, `logo-text`, `href`. */
export default class MenuLogo extends BaseComponent {
    static changeAttributes: string[];
    /** The URL of the logo image. */
    logo: string | null;
    logoText: string | null;
    /** The alternative text of the image. The default is "Logo image". */
    alt: string | null;
    href: string | null;
    render(): void;
}

export declare class ShadowMenuLogo extends MenuLogo {
    shadow: ShadowRoot;
}

export { MenuLogo };
