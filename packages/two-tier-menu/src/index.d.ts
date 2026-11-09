// Type declarations for @catalystcommunity/two-tier-menu. The source is JavaScript; keep this
// file in step with src/index.js.
import { DataComponent } from '@catalystcommunity/base-components';

export interface TwoTierMenuItem {
    display?: string;
    link?: string;
    /** The URL of an icon image. */
    icon?: string;
}

export interface TwoTierMenuSection extends TwoTierMenuItem {
    items?: TwoTierMenuItem[];
}

export interface TwoTierMenuConfig {
    logo?: {img?: string; alt?: string; text?: string};
    /** The accessible name of the navigation. The default is "Menu". */
    label?: string;
    sections?: TwoTierMenuSection[];
    gutter?: {overrideTemplateId?: string; overrideStyleTemplateId?: string};
}

/** What the registry function returns. */
export interface TwoTierMenuRegisterResult {
    menuConfig?: TwoTierMenuConfig;
    unregisterFunc?: ((instanceId: string, unregisterData: unknown) => void) | string;
}

/**
 * A menu of sections and items. It gets `menuConfig` from a data registry
 * (attributes `registry-name` and `data-register-func-name`). It makes `menu-logo`,
 * `menu-item`, and `menu-gutter` elements, so define those tags too.
 */
export default class TwoTierMenu extends DataComponent {
    menuConfig: TwoTierMenuConfig;
    /** The `menu-gutter` element after a render with a gutter, else an empty object. */
    gutter: HTMLElement | Record<string, never>;
    setItemAttributes(element: Element, item: TwoTierMenuItem): void;
    render(): void;
}

export declare class ShadowTwoTierMenu extends TwoTierMenu {
    shadow: ShadowRoot;
}

export { TwoTierMenu };
