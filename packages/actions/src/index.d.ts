// Type declarations for @catalystcommunity/actions. The source is JavaScript; keep this file in
// step with src/index.js. __tests__/types.spec.js checks that each export has a declaration.

/** A shortcut after `parseShortcut`. `key` is in lowercase, for example `'z'`, `'f2'`, or `'arrowdown'`. */
export interface ParsedShortcut {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
    key: string;
}

/** A shortcut as text, for example `'Mod+Shift+Z'`, or as a parsed object. */
export type Shortcut = string | ParsedShortcut;

export interface ShortcutOptions {
    /** `Mod` is Command when true, and Ctrl when false. The default comes from the browser. */
    mac?: boolean;
}

/** Throws if the text has no key, or more than one key that is not a modifier. */
export declare function parseShortcut(text: Shortcut | null | undefined, options?: ShortcutOptions): ParsedShortcut | null;
export declare function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut | null | undefined, options?: ShortcutOptions): boolean;
/** The text for a menu: `'⇧⌘Z'` on a Mac, `'Ctrl+Shift+Z'` on other systems. */
export declare function formatShortcut(shortcut: Shortcut | null | undefined, options?: ShortcutOptions): string;
/** The value for `aria-keyshortcuts`, for example `'Control+Shift+Z'`. */
export declare function ariaShortcut(shortcut: Shortcut | null | undefined, options?: ShortcutOptions): string;

/** The names of the states that `change` can name. */
export type ActionState = 'label' | 'shortcut' | 'icon' | 'description' | 'enabled' | 'checkable' | 'checked';

/** The argument of `run`, and the detail of `trigger`. Extra fields come from `trigger(source, detail)`. */
export interface ActionRunDetail {
    action: Action;
    /** The control that the user used, or null. */
    source: EventTarget | null;
    /** The key event, when a `ShortcutMap` runs the action. */
    event?: KeyboardEvent;
    [key: string]: unknown;
}

export interface ActionChangeDetail {
    action: Action;
    changed: ActionState[];
}

export interface ActionOptions {
    /** Necessary. */
    id: string;
    /** The default is the `id`. */
    label?: string;
    shortcut?: Shortcut | null;
    /** Anything that a control can show, for example a URL or a symbol. */
    icon?: unknown;
    description?: string;
    enabled?: boolean;
    checkable?: boolean;
    checked?: boolean;
    run?: ((detail: ActionRunDetail) => void) | null;
    group?: ActionGroup | null;
}

export interface ActionEventMap {
    change: CustomEvent<ActionChangeDetail>;
    /** Cancelable. `preventDefault()` stops the action. */
    trigger: CustomEvent<ActionRunDetail>;
}

/** One command of the application. It sends `change` when a state changes, and `trigger` before it runs. */
export declare class Action extends EventTarget {
    constructor(options: ActionOptions);
    id: string;
    run: ((detail: ActionRunDetail) => void) | null;
    /** The group, after `ActionGroup.add`. */
    group?: ActionGroup;
    label: string;
    /** A set throws if the shortcut is not correct. */
    shortcut: Shortcut | null;
    icon: unknown;
    description: string;
    enabled: boolean;
    checkable: boolean;
    checked: boolean;
    /** Changes many states, and sends one `change` event. */
    update(changes: Partial<Pick<Action, ActionState>>): void;
    /** Runs the action. Returns false if it is disabled or a `trigger` listener stopped it. */
    trigger(source?: EventTarget | null, detail?: Record<string, unknown>): boolean;

    addEventListener<K extends keyof ActionEventMap>(type: K, listener: (this: Action, event: ActionEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof ActionEventMap>(type: K, listener: (this: Action, event: ActionEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
}

/** Keeps one checked action in the group. Each action in the group becomes checkable. */
export declare class ActionGroup {
    add<T extends Action>(action: T): T;
    readonly actions: Action[];
    readonly checked: Action | null;
}

export interface ShortcutMapOptions extends ShortcutOptions {
    /** True: a shortcut with no Ctrl, Alt, or Meta does not run while the user types in a text field. The default is true. */
    ignoreInFields?: boolean;
}

/** The shortcuts of a part of the page. */
export declare class ShortcutMap {
    constructor(actions?: Action[], options?: ShortcutMapOptions);
    /** Returns a function that removes the action. */
    add(action: Action): () => void;
    remove(action: Action): void;
    readonly actions: Action[];
    find(event: KeyboardEvent): Action | null;
    /** Runs the action of the event, and stops the key. Returns true if an action matched. */
    handle(event: KeyboardEvent): boolean;
    /** Listens for `keydown` on the element. Returns the removal function. */
    attach(element: EventTarget): () => void;
}

/** Makes actions from plain objects. The key is the `id`. An `Action` value stays as it is. */
export declare function actionsFrom<K extends string>(definitions: Record<K, Omit<ActionOptions, 'id'> | Action>): Record<K, Action>;
