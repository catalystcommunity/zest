// Type declarations for @catalystcommunity/menus. The source is JavaScript; keep this
// file in step with src/*.js. __tests__/types.spec.js checks that each export has a declaration.
import { BaseComponent, type PopupPlacement, type Removal } from '@catalystcommunity/base-components';
import type { Action, ActionOptions } from '@catalystcommunity/actions';

// Mnemonics

export interface Mnemonic {
    /** The index of the letter in `text`. */
    index: number;
    /** The letter, in lower case. */
    key: string;
}

/** '&File' gives `{text: 'File', mnemonic: {index: 0, key: 'f'}}`. '&&' is one '&'. */
export declare function parseMnemonic(label?: string | null): {text: string; mnemonic: Mnemonic | null};
/** Doubles each '&', so that a label from user data, such as "R&D", has no mnemonic. */
export declare function escapeMnemonic(text?: string | null): string;

// Menu data

/**
 * A plain object for an item. The menu makes one `Action` for the object, and keeps it.
 * The default `id` is the label with no mnemonic marker.
 */
export type MenuActionDefinition = Partial<ActionOptions> & ({id: string} | {label: string}) & {
    /** `false` shows each '&' of the label as text. */
    mnemonic?: false;
};

export interface MenuActionItem {
    action: Action | MenuActionDefinition;
    mnemonic?: false;
}

export interface MenuSeparatorItem {
    separator: true;
}

/** A submenu. In a toolbar, a button that opens a menu. */
export interface MenuSubmenuItem {
    label?: string;
    action?: Action | MenuActionDefinition;
    items: MenuItems;
    /** The path of an image, or a short text such as a symbol. */
    icon?: string;
    disabled?: boolean;
    mnemonic?: false;
}

export type MenuItem = Action | MenuActionItem | MenuSeparatorItem | MenuSubmenuItem | MenuActionDefinition;
/** A false, null, or undefined entry is left out. */
export type MenuItems = readonly (MenuItem | null | undefined | false)[];

/** An entry as the menus read it. `mnemonic` is false when the label shows each '&' as text. */
export type MenuEntry =
    | {type: 'action'; action: Action; mnemonic: boolean}
    | {type: 'separator'}
    | {type: 'submenu'; label: string; icon: unknown; items: MenuItems; action: Action | null; disabled: boolean; mnemonic: boolean};

/** The entries of the data. Separators at the ends or next to each other go away. */
export declare function menuEntries(items?: MenuItems | null): MenuEntry[];
/** Each action in the data, also in submenus. */
export declare function menuActions(items?: MenuItems | null): Action[];

// PopupMenu

export type MenuFocus = 'first' | 'last' | 'none';
export type MenuCloseReason = 'code' | 'select' | 'escape' | 'tab' | 'outside' | 'resize' | 'scroll' | 'toggle' | 'navigate' | 'back' | 'hover' | 'other';

export interface PopupMenuOpenOptions {
    anchor?: Element | null;
    /** A point, for example of the pointer, when there is no anchor. */
    x?: number;
    y?: number;
    placement?: PopupPlacement;
    focus?: MenuFocus;
    /** Gets the focus when the menu closes. The default is the focused element. */
    opener?: HTMLElement | null;
}

/** Set by the owner of a menu. */
export interface PopupMenuController {
    /** A pointer press on this element does not close the menu, for example its button. */
    owner?: Element | null;
    /** Left (-1) or Right (1) in a menu of a menu bar. */
    navigate?(direction: -1 | 1): void;
    closed?(reason: MenuCloseReason): void;
}

export interface MenuSelectDetail {
    id: string;
    action: Action;
}
export interface PopupMenuCloseDetail {
    reason: MenuCloseReason;
}

export declare class PopupMenu extends BaseComponent {
    items: MenuItems;
    label: string;
    /** `mnemonics="false"` shows each '&' of the labels as text, also in the submenus. */
    mnemonics: boolean;
    controller: PopupMenuController | null;
    /** The menu that opened this one as a submenu. */
    parentMenu: PopupMenu | null;
    /** The element with `role="menu"`. */
    readonly menuElement: HTMLDivElement;
    readonly isOpen: boolean;
    /** The top menu of a set of submenus. */
    readonly rootMenu: PopupMenu;
    /** Opens next to an anchor, or at a point. Throws if the menu is not on the page. */
    open(options?: PopupMenuOpenOptions): this;
    /** Closes the menu and its submenus. */
    close(options?: {returnFocus?: boolean; reason?: MenuCloseReason}): void;
}

export declare class ShadowPopupMenu extends PopupMenu {
    shadow: ShadowRoot;
}

// MenuBar

export declare class MenuBar extends BaseComponent {
    items: MenuItems;
    /** The default is "Menu". */
    label: string;
    /** `document`, or the ID of an element. Each shortcut of the menus works while the focus is in it. Attribute `shortcuts-for`. */
    shortcutsFor: string;
    /** Alt alone moves the focus to the bar. Attribute `alt-key`. */
    altKey: boolean;
    /** `mnemonics="false"` shows each '&' as text. Alt and a letter then open no menu. */
    mnemonics: boolean;
    /** The element with `role="menubar"`. */
    readonly menuBarElement: HTMLDivElement;
    /** The shortcuts work while the focus is in the scope. Returns the removal function. */
    bindShortcuts(scope?: EventTarget): Removal;
    /** Moves the focus to the bar. Escape gives it back. */
    focusBar(): void;
    /** Opens the menu at the index, or the one with the label (with no mnemonic marker). */
    openMenu(which?: number | string, focus?: MenuFocus): void;
    closeMenus(): void;
}

export declare class ShadowMenuBar extends MenuBar {
    shadow: ShadowRoot;
}

// MenuButton

/**
 * A button that opens a menu. The children of the element are the face of the button, in place
 * of the icon and the label.
 */
export declare class MenuButton extends BaseComponent {
    /** The default is "Menu". */
    label: string;
    icon: string;
    items: MenuItems;
    /** The main part runs `action`, or the first action of the items. The arrow part opens the menu. */
    split: boolean;
    action: Action | MenuActionDefinition | null;
    /** The name of the arrow part of a split button. Attribute `more-label`. */
    moreLabel: string;
    placement: PopupPlacement;
    disabled: boolean;
    mnemonics: boolean;
    readonly menu: PopupMenu;
    open(focus?: MenuFocus): void;
    close(): void;
    focus(options?: FocusOptions): void;
}

export declare class ShadowMenuButton extends MenuButton {
    shadow: ShadowRoot;
}

// ToolBar

export declare class ToolBar extends BaseComponent {
    items: MenuItems;
    /** The default is "Toolbar". */
    label: string;
    /** Only the icon shows. The label is the name of the button. Attribute `icons-only`. */
    iconsOnly: boolean;
    orientation: 'horizontal' | 'vertical';
    /** The items go on more lines. With no wrap, the items that do not fit go into a "More" menu. */
    wrap: boolean;
    /** Attribute `more-label`. The default is "More". */
    moreLabel: string;
    mnemonics: boolean;
    /** The element with `role="toolbar"`. */
    readonly toolBarElement: HTMLDivElement;
}

export declare class ShadowToolBar extends ToolBar {
    shadow: ShadowRoot;
}

// ToolTip

export declare class ToolTip extends BaseComponent {
    /** The ID of the element that the tooltip is for, in the same root. */
    for: string;
    text: string;
    placement: PopupPlacement;
    /** Milliseconds before the tooltip shows on hover. */
    delay: number;
    /** Gives the text each time that the tooltip shows. */
    textSource: (() => string) | null;
    readonly isShown: boolean;
    /** Shows the tooltip for the element on hover and on keyboard focus. Returns the removal function. */
    attachTo(element: Element): Removal;
    show(): void;
    hide(): void;
}

/** Adds a tooltip to an element. `text` is a text or a function that gives it. Returns the removal function. */
export declare function attachToolTip(element: Element, text: string | (() => string), options?: {placement?: PopupPlacement; delay?: number; container?: Node}): Removal;

// Context menus

export interface ContextMenuOptions {
    /** The name of the menu. The default is "Context menu". */
    label?: string;
    /** Where the menu element goes. The default is the root of the element. */
    container?: Node;
    /** `false` shows each '&' of the labels as text. */
    mnemonics?: boolean;
}

/**
 * A menu that opens with the context menu of the element. `items` is the data, or a function that
 * gets the event and gives the data. With no items, the browser shows its own menu.
 */
export declare function attachContextMenu(element: Element, items: MenuItems | ((event: MouseEvent | KeyboardEvent) => MenuItems | null | undefined), options?: ContextMenuOptions): Removal;

// Notices

export type NoticeKind = 'info' | 'success' | 'warning' | 'error';
export type NoticeCloseReason = 'timeout' | 'dismiss' | 'action' | 'code';

export interface NoticeOptions {
    text: string;
    kind?: NoticeKind;
    /** Milliseconds. The default is 6000, 10000 for a warning, and 0 (stays) for an error. */
    timeout?: number;
    /** A button on the notice. `mnemonic: false` shows each '&' of its label as text. */
    action?: Action | MenuActionDefinition | null;
}

export interface Notice {
    element: HTMLDivElement;
    close(): void;
    closed: Promise<NoticeCloseReason>;
}

export declare class NoticeArea extends BaseComponent {
    /** The most notices that show at one time. */
    max: number;
    /** Attribute `dismiss-label`. */
    dismissLabel: string;
    readonly notices: HTMLDivElement[];
    add(options?: NoticeOptions): Notice;
}

/** Shows a short message in a corner of the window. Give `area` to use a different `NoticeArea`. */
export declare function showNotice(options: string | (NoticeOptions & {area?: NoticeArea | null})): Notice;

/** Defines the default tag of each menu component that has no tag yet. */
export declare function defineMenus(): void;

declare global {
    interface HTMLElementTagNameMap {
        'menu-bar': MenuBar;
        'shadow-menu-bar': ShadowMenuBar;
        'popup-menu': PopupMenu;
        'shadow-popup-menu': ShadowPopupMenu;
        'menu-button': MenuButton;
        'shadow-menu-button': ShadowMenuButton;
        'tool-bar': ToolBar;
        'shadow-tool-bar': ShadowToolBar;
        'tool-tip': ToolTip;
        'notice-area': NoticeArea;
    }
    interface HTMLElementEventMap {
        'popup-menu-open': CustomEvent<Record<string, never>>;
        'popup-menu-close': CustomEvent<PopupMenuCloseDetail>;
        'popup-menu-select': CustomEvent<MenuSelectDetail>;
        'menu-bar-select': CustomEvent<MenuSelectDetail>;
        'menu-button-select': CustomEvent<MenuSelectDetail>;
        'tool-bar-select': CustomEvent<MenuSelectDetail>;
    }
}
