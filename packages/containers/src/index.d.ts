// Type declarations for @catalystcommunity/containers. The source is JavaScript; keep this file in
// step with src/*.js. __tests__/types.spec.js checks that each export has a declaration.
import { OpenShadowComponent } from '@catalystcommunity/base-components';

/** The base of each container. It is not exported at runtime. */
declare class ShadowContainer extends OpenShadowComponent {
    /** The HTML of the shadow root. The class builds it one time, at the first connect. */
    static shadowHtml: string;
    /** Called one time, after the shadow root is built. */
    built(): void;
    /** Called on each connect. */
    connected(): void;
    /** The first element in the shadow root that matches the selector. */
    shadowPart<E extends Element = HTMLElement>(selector: string): E | null;
    /** The text of a label: from the `labels` property, then from the static `labels` of the class, then the name. */
    text(name: string): string;
}

export declare class GroupBox extends ShadowContainer {
    label: string;
    collapsible: boolean;
    collapsed: boolean;
    /** The title is a check box. When it is clear, the content is inert. */
    checkable: boolean;
    checked: boolean;
}

export declare class TabPage extends ShadowContainer {
    label: string;
    closable: boolean;
    disabled: boolean;
}

/** A page by its index, its `id`, or the element. */
export type TabTarget = number | string | TabPage;

export interface TabViewLabels {
    closeHint: string;
}

export declare class TabView extends ShadowContainer {
    static labels: TabViewLabels;
    /** The index of the selected page. */
    selected: number;
    placement: 'top' | 'bottom' | 'start' | 'end' | (string & {});
    /** With `'manual'`, the arrow keys move the focus only. */
    activation: 'automatic' | 'manual' | (string & {});
    /** The name of the tab list. */
    label: string;
    labels?: Partial<TabViewLabels>;
    readonly pages: TabPage[];
    readonly selectedPage: TabPage | null;
    /** A page calls this when its label or state changes. */
    pagesChanged(): void;
    /** Sends no event. */
    select(target: TabTarget): void;
    /** Removes the page. Sends no event. */
    closePage(target: TabTarget): void;
}

export interface SplitViewLabels {
    /** `{pane}` is the name of the pane. */
    resize: string;
    /** `{number}` is the pane number. */
    pane: string;
}

export declare class SplitView extends ShadowContainer {
    static labels: SplitViewLabels;
    orientation: 'horizontal' | 'vertical' | (string & {});
    /** Relative sizes, as for `fr` units. After the user moves a divider, sizes in CSS pixels. */
    sizes: number[];
    labels?: Partial<SplitViewLabels>;
    readonly panes: Element[];
    /** The indexes of the collapsed panes, in order. */
    readonly collapsedPanes: number[];
    collapse(index: number): void;
    expand(index: number): void;
    toggle(index: number): void;
}

export declare class AccordionSection extends ShadowContainer {
    label: string;
    open: boolean;
    /** The heading level. The default is 3. */
    level: number;
    disabled: boolean;
    focusHeader(): void;
}

export declare class AccordionView extends ShadowContainer {
    /** More than one section can be open. */
    multiple: boolean;
    readonly sections: AccordionSection[];
}

export declare class ScrollArea extends ShadowContainer {
    static labels: {region: string};
    /** The name of the region. */
    label: string;
    labels?: Partial<{region: string}>;
    /** The element that scrolls. */
    readonly viewport: HTMLElement | null;
}

export declare class StatusBar extends ShadowContainer {
    static labels: {bar: string};
    label: string;
    labels?: Partial<{bar: string}>;
}

export declare class StatusPane extends ShadowContainer {
    /** A CSS length. */
    width: string;
    /** The pane takes the space that is left. */
    stretch: boolean;
    /** A screen reader tells each change. */
    live: boolean;
}

export declare class FormLayout extends ShadowContainer {
    narrow: string;
}

export declare class BoxLayout extends ShadowContainer {
    direction: 'row' | 'column' | (string & {});
    /** `'none'`, `'related'`, `'unrelated'`, or a CSS length. */
    gap: string;
    /** An `align-items` value. */
    align: string;
    /** A `justify-content` value. */
    justify: string;
    wrap: boolean;
}

export type DialogKind = 'info' | 'warning' | 'error' | 'question';

export interface DialogWindowLabels {
    close: string;
    info: string;
    warning: string;
    error: string;
    question: string;
}

export type DialogCloseReason = 'button' | 'close-button' | 'escape' | 'code';

/**
 * A window over the page, from a native dialog. A button in the `buttons` slot, or a button with
 * `data-close`, closes it. A slot button with `data-keep-open` does not close it. `data-default`
 * marks the button that Enter clicks. `data-danger` gives a button the look of an action that the
 * user cannot undo.
 */
export declare class DialogWindow extends ShadowContainer {
    static labels: DialogWindowLabels;
    /** The title. */
    label: string;
    kind: DialogKind | '' | (string & {});
    /** No close button in the title bar. */
    noClose: boolean;
    open: boolean;
    labels?: Partial<DialogWindowLabels>;
    readonly returnValue: string;
    /** Opens as a modal. The result is the value of the button that closed it, or `'cancel'`. */
    showModal(): Promise<string>;
    /** Opens, and the rest of the page stays usable. The result is as for `showModal()`. */
    show(): Promise<string>;
    /** Closes as the user does: it first sends `dialog-window-before-close`. Returns true if the dialog closed. */
    requestClose(value?: string, options?: {reason?: DialogCloseReason; button?: Element | null}): boolean;
    /** Closes at once. Sends no `dialog-window-before-close`. */
    close(value?: string): void;
}

export interface MessageButton {
    label: string;
    /** The default is the label in lowercase. */
    value?: string;
    /** Enter clicks this button. */
    default?: boolean;
    /** The look of an action that the user cannot undo, with a warning sign before the text. */
    danger?: boolean;
}

interface DialogFunctionOptions {
    title?: string;
    /** The dialog is added here. The default is `document.body`. */
    parent?: Element;
    labels?: Partial<DialogWindowLabels>;
}

export interface ShowMessageOptions extends DialogFunctionOptions {
    text?: string;
    /** A string gives a button with that label. The first string button is the default. */
    buttons?: Array<string | MessageButton>;
    kind?: DialogKind | '';
}

export interface AskConfirmOptions extends DialogFunctionOptions {
    text?: string;
    okLabel?: string;
    cancelLabel?: string;
    kind?: DialogKind | '';
    /** The OK button has the danger look. */
    danger?: boolean;
}

export interface AskTextOptions extends DialogFunctionOptions {
    /** The label of the field. */
    label?: string;
    value?: string;
    okLabel?: string;
    cancelLabel?: string;
    /** OK is disabled while the field is empty. */
    required?: boolean;
    /** The type of the input. */
    type?: string;
}

/** The value of the button, or `'cancel'`. */
export declare function showMessage(options?: ShowMessageOptions): Promise<string>;
/** True for OK. */
export declare function askConfirm(options?: AskConfirmOptions): Promise<boolean>;
/** The text, or null after Cancel. */
export declare function askText(options?: AskTextOptions): Promise<string | null>;

export interface FloatingWindowLabels {
    handle: string;
    minimize: string;
    maximize: string;
    restore: string;
    close: string;
    moveHint: string;
    sizeHint: string;
}

export type WindowState = 'normal' | 'minimized' | 'maximized';

export interface WindowGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

export declare class FloatingWindow extends ShadowContainer {
    static labels: FloatingWindowLabels;
    label: string;
    /** CSS pixels, in the area. */
    x: number;
    y: number;
    width: number;
    height: number;
    state: WindowState | (string & {});
    active: boolean;
    labels?: Partial<FloatingWindowLabels>;
    /** The parent window area, or null. */
    readonly area: WindowArea | null;
    /** The keyboard or click mode of the handle, or null. */
    readonly mode: 'move' | 'size' | null;
    /** Removes the window. Sends no event. */
    close(): void;
    /** Moves and sizes the window, and keeps it in the area. */
    setGeometry(geometry?: Partial<WindowGeometry>): void;
}

export declare class WindowArea extends ShadowContainer {
    label: string;
    readonly windows: FloatingWindow[];
    readonly activeWindow: FloatingWindow | null;
    /** Puts the window on top and makes it active. */
    activate(window: FloatingWindow): void;
    focusTop(): void;
    /** Puts the minimized windows in a row at the bottom. */
    arrange(): void;
    cascade(): void;
    tile(): void;
}

export type ContainerTags = {
    'group-box': typeof GroupBox;
    'tab-view': typeof TabView;
    'tab-page': typeof TabPage;
    'split-view': typeof SplitView;
    'accordion-view': typeof AccordionView;
    'accordion-section': typeof AccordionSection;
    'scroll-area': typeof ScrollArea;
    'status-bar': typeof StatusBar;
    'status-pane': typeof StatusPane;
    'form-layout': typeof FormLayout;
    'box-layout': typeof BoxLayout;
    'dialog-window': typeof DialogWindow;
    'window-area': typeof WindowArea;
    'floating-window': typeof FloatingWindow;
};

/** The default tag of each container. */
export declare const containerTags: ContainerTags;
/** Defines each tag that is not defined yet. The default is `containerTags`. */
export declare function defineContainers(tags?: Record<string, CustomElementConstructor>): void;

export interface GroupBoxCheckDetail { checked: boolean; }
export interface GroupBoxToggleDetail { collapsed: boolean; }
export interface TabViewSelectDetail { index: number; id: string; label: string; page: TabPage; }
/** Cancelable. */
export interface TabViewCloseDetail { index: number; id: string; label: string; page: TabPage; }
export interface SplitViewResizeDetail { sizes: number[]; collapsed: number[]; }
export interface AccordionSectionToggleDetail { open: boolean; }
export interface DialogWindowCloseDetail { value: string; }
/** Cancelable. `preventDefault()` keeps the dialog open. */
export interface DialogWindowBeforeCloseDetail {
    value: string;
    reason: DialogCloseReason;
    /** The button that the user clicked, or null. */
    button: Element | null;
}
export interface FloatingWindowStateDetail { state: WindowState; }
/** Cancelable. */
export interface FloatingWindowCloseDetail { label: string; }
export interface WindowAreaActivateDetail { window: FloatingWindow; label: string; }

declare global {
    interface HTMLElementTagNameMap {
        'group-box': GroupBox;
        'tab-view': TabView;
        'tab-page': TabPage;
        'split-view': SplitView;
        'accordion-view': AccordionView;
        'accordion-section': AccordionSection;
        'scroll-area': ScrollArea;
        'status-bar': StatusBar;
        'status-pane': StatusPane;
        'form-layout': FormLayout;
        'box-layout': BoxLayout;
        'dialog-window': DialogWindow;
        'window-area': WindowArea;
        'floating-window': FloatingWindow;
    }
    interface HTMLElementEventMap {
        'group-box-check': CustomEvent<GroupBoxCheckDetail>;
        'group-box-toggle': CustomEvent<GroupBoxToggleDetail>;
        'tab-view-select': CustomEvent<TabViewSelectDetail>;
        'tab-view-close': CustomEvent<TabViewCloseDetail>;
        'split-view-resize': CustomEvent<SplitViewResizeDetail>;
        'accordion-section-toggle': CustomEvent<AccordionSectionToggleDetail>;
        'dialog-window-close': CustomEvent<DialogWindowCloseDetail>;
        'dialog-window-before-close': CustomEvent<DialogWindowBeforeCloseDetail>;
        'floating-window-move': CustomEvent<WindowGeometry>;
        'floating-window-resize': CustomEvent<WindowGeometry>;
        'floating-window-state': CustomEvent<FloatingWindowStateDetail>;
        'floating-window-close': CustomEvent<FloatingWindowCloseDetail>;
        'window-area-activate': CustomEvent<WindowAreaActivateDetail>;
    }
}
