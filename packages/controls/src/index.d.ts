// Type declarations for @catalystcommunity/controls. The source is JavaScript; keep this file in
// step with src/*.js. __tests__/types.spec.js checks that each export has a declaration.
//
// Each control observes `aria-label` and `aria-describedby` on the host, and gives them to its inner
// element. A control with `autofocus` gets the focus when it connects, if nothing else has it.
// The inner elements (for example `button`, `input`, `field`) exist after the first connect.
import { BaseComponent } from '@catalystcommunity/base-components';

/** The words that a person reads. Set a part of them with the `labels` property. */
export interface ControlLabels {
    clear: string;
    show: string;
    hide: string;
    showPassword: string;
    increase: string;
    decrease: string;
    showOptions: string;
    noOptions: string;
    working: string;
    charactersLeft: (count: number) => string;
    characterCount: (count: number, max: number) => string;
    on: string;
    off: string;
    selectOne: string;
    fillNumber: string;
    selectAtLeastOne: string;
    checkThis: string;
}

/** An option as the application gives it: a string, or an object. */
export type ControlOptionInput = string | number | {
    value?: string | number;
    label?: string;
    disabled?: boolean;
    description?: string;
    selected?: boolean;
    [key: string]: unknown;
};

/** An option after the control reads it. */
export interface ControlOption {
    value: string;
    label: string;
    disabled: boolean;
    description?: string;
    selected?: boolean;
    [key: string]: unknown;
}

/** The base of each control. It is not exported at runtime. */
declare class ZestElement extends BaseComponent {
    /** Attributes of the host that the control copies to its inner native element. */
    static forwardAttributes: string[];
    labels: Partial<ControlLabels>;
    /** True after the first render made the DOM. */
    readonly built: boolean;
    /** `DEFAULT_LABELS` with the `labels` property on top. */
    readonly text: ControlLabels;
    /** Called after each connect, after the first render. */
    connected(): void;
    /** Makes the DOM one time. */
    build(): void;
    /** Changes the DOM to agree with the properties. */
    update(): void;
    nameInner(element: Element, options?: {fallback?: string; labelledBy?: string | null}): void;
    describe(ids: Array<string | false | null | undefined | 0>, element?: Element | null): void;
    forwardTo(element: Element): void;
    takeContent(container: Element, keep?: (node: Node) => boolean): boolean;
    followContent(container: Element, inner: Node | Node[], changed: (hasContent: boolean) => void, keep?: (node: Node) => boolean): void;
    /** Stops the events of inner native elements at the container. */
    stopInner(container: Element, names?: string[]): void;
    /** Sends a plain `Event` that bubbles and is composed. */
    fire(name: string): boolean;
}

/** The base of each control that is form associated. It is not exported at runtime. */
declare class FormControl extends ZestElement {
    static formAssociated: boolean;
    name: string | undefined;
    disabled: boolean;
    required: boolean;
    /** The visible label. */
    label: string;
    internals: ElementInternals | null;
    /** True for a control that submits its form. */
    readonly submitsForm: boolean;
    /** True for a field in which Enter submits the form. */
    readonly blocksImplicitSubmission: boolean;
    /** `disabled`, or disabled by a parent fieldset. */
    readonly isDisabled: boolean;
    readonly form: HTMLFormElement | null;
    readonly validity: ValidityState | undefined;
    readonly validationMessage: string;
    readonly willValidate: boolean;
    /** The inner element that gets the focus. */
    readonly focusTarget: HTMLElement | null;
    checkValidity(): boolean;
    reportValidity(): boolean;
    formDisabledCallback(disabled: boolean): void;
    formResetCallback(): void;
    formStateRestoreCallback(state: unknown): void;
    resetValue(): void;
    restoreValue(state: unknown): void;
    setFormValue(value: File | string | FormData | null, state?: File | string | FormData | null): void;
    /** `flags` as `ValidityState`, for example `{valueMissing: true}`. An empty object is valid. */
    setValidity(flags?: ValidityStateFlags, message?: string, anchor?: HTMLElement | null): void;
}

export type { ZestElement, FormControl };

export declare class PushButton extends FormControl {
    variant: 'default' | 'primary' | 'danger' | 'flat' | (string & {});
    /** The button stays pressed until the user selects it again. */
    toggle: boolean;
    pressed: boolean;
    type: 'button' | 'submit' | 'reset' | (string & {});
    /** A URL of an image, or a character. */
    icon: string;
    button: HTMLButtonElement;
    readonly focusTarget: HTMLButtonElement;
}
export declare class ShadowPushButton extends PushButton { shadow: ShadowRoot; }

export declare class CheckBox extends FormControl {
    static kind: string;
    checked: boolean;
    indeterminate: boolean;
    /** The value in the form data when checked. */
    value: string;
    input: HTMLInputElement;
    wrapper: HTMLLabelElement;
    readonly focusTarget: HTMLInputElement;
    /** Changes the state as a click does, and sends the events. */
    toggle(): void;
    extraParts(): Node[];
}
export declare class ShadowCheckBox extends CheckBox { shadow: ShadowRoot; }

export declare class ToggleSwitch extends CheckBox {
    /** Shows the words On or Off. */
    showState: boolean;
}
export declare class ShadowToggleSwitch extends ToggleSwitch { shadow: ShadowRoot; }

export declare class RadioButton extends ZestElement {
    value: string;
    checked: boolean;
    disabled: boolean;
    label: string;
    /** The radio group that holds it, or null. */
    readonly group: RadioGroup | null;
}
export declare class ShadowRadioButton extends RadioButton { shadow: ShadowRoot; }

export declare class RadioGroup extends FormControl {
    value: string;
    orientation: 'vertical' | 'horizontal' | (string & {});
    /** The group makes a radio button for each option. */
    options: ControlOptionInput[];
    wrapper: HTMLDivElement;
    readonly radios: RadioButton[];
    readonly focusTarget: RadioButton | null;
}
export declare class ShadowRadioGroup extends RadioGroup { shadow: ShadowRoot; }

/**
 * The base of TextField and TextArea. It is not exported at runtime. The attributes
 * `autocapitalize`, `autocorrect`, `spellcheck`, and `enterkeyhint` of the host go to the inner field.
 */
declare class TextControl extends FormControl {
    static kind: string;
    value: string;
    placeholder: string;
    readonly: boolean;
    minlength: number | null;
    maxlength: number | null;
    /** Help text under the field. A problem replaces it. */
    helper: string;
    /** A problem from the application. */
    error: string;
    autocomplete: string;
    field: HTMLInputElement | HTMLTextAreaElement;
    wrapper: HTMLDivElement;
    labelElement: HTMLLabelElement;
    box: HTMLDivElement;
    help: HTMLDivElement;
    /** True after the user left the field, or after the form checked it. */
    touched: boolean;
    readonly focusTarget: HTMLInputElement | HTMLTextAreaElement;
    /** Selects the text. */
    select(): void;
    /** Sets `error`. */
    setCustomValidity(message: string): void;
}

export declare class TextField extends TextControl {
    type: 'text' | 'email' | 'password' | 'search' | 'url' | 'tel' | (string & {});
    pattern: string;
    prefixText: string;
    suffixText: string;
    inputmode: string;
    field: HTMLInputElement;
    readonly focusTarget: HTMLInputElement;
    /** Removes the text, and sends the events as the user would. */
    clear(): void;
}
export declare class ShadowTextField extends TextField { shadow: ShadowRoot; }

export declare class TextArea extends TextControl {
    rows: number;
    /** The field grows with its text. */
    autogrow: boolean;
    field: HTMLTextAreaElement;
    readonly focusTarget: HTMLTextAreaElement;
}
export declare class ShadowTextArea extends TextArea { shadow: ShadowRoot; }

export declare class SpinBox extends FormControl {
    value: number | null;
    min: number | null;
    max: number | null;
    step: number;
    /** The number of decimals. With null, from `step`. */
    precision: number | null;
    locale: string;
    placeholder: string;
    readonly: boolean;
    input: HTMLInputElement;
    wrapper: HTMLDivElement;
    readonly focusTarget: HTMLInputElement;
    readonly decimals: number;
    readonly format: Intl.NumberFormat;
    /** Reads a number in the format of the locale. Null for empty text, undefined for text that is not a number. */
    parse(text: string | null | undefined): number | null | undefined;
    clamp(number: number | null | undefined): number | null;
    stepBy(count: number): void;
    stepUp(count?: number): void;
    stepDown(count?: number): void;
    /** Reads the text, and sends `change` if the value changed. */
    commit(): void;
}
export declare class ShadowSpinBox extends SpinBox { shadow: ShadowRoot; }

export type SliderMark = number | {value: number; label?: string};

export declare class SliderControl extends FormControl {
    value: number;
    min: number;
    max: number;
    step: number;
    orientation: 'horizontal' | 'vertical' | (string & {});
    ticks: boolean;
    /** Labels under the track. */
    marks: SliderMark[];
    showValue: boolean;
    locale: string;
    unit: string;
    /** Gives the text of a value. */
    format: ((value: number) => string | number) | null;
    wrapper: HTMLDivElement;
    thumb: HTMLDivElement;
    readonly focusTarget: HTMLDivElement;
    readonly vertical: boolean;
    readonly valueText: string;
    /** The number in the limits and on a step. */
    clamp(number: number): number;
}
export declare class ShadowSliderControl extends SliderControl { shadow: ShadowRoot; }

export declare class ProgressBar extends ZestElement {
    /** With null, the bar shows that work continues. */
    value: number | null;
    max: number;
    label: string;
    showValue: boolean;
    /** Text in place of the percent. */
    valueText: string;
    locale: string;
    wrapper: HTMLDivElement;
    bar: HTMLDivElement;
    readonly indeterminate: boolean;
}
export declare class ShadowProgressBar extends ProgressBar { shadow: ShadowRoot; }

export declare class ComboBox extends FormControl {
    options: ControlOptionInput[];
    value: string;
    /** The user can type. */
    editable: boolean;
    placeholder: string;
    wrapper: HTMLDivElement;
    /** An input when editable, else a div. */
    control: HTMLInputElement | HTMLDivElement;
    popup: HTMLDivElement;
    readonly focusTarget: HTMLInputElement | HTMLDivElement;
    /** True while the list shows. */
    readonly open: boolean;
    readonly items: ControlOption[];
    readonly selectedOption: ControlOption | null;
    /** Opens the list, at the first or the last option, or at the selected option. */
    show(at?: 'first' | 'last' | null): void;
    close(): void;
}
export declare class ShadowComboBox extends ComboBox { shadow: ShadowRoot; }

export declare class ListBox extends FormControl {
    options: ControlOptionInput[];
    multiple: boolean;
    /** The first selected value. */
    value: string;
    /** All of the selected values. */
    values: string[];
    list: HTMLDivElement;
    wrapper: HTMLDivElement;
    readonly focusTarget: HTMLDivElement;
    readonly items: ControlOption[];
    /** The value of the active option, or null. */
    readonly activeValue: string | null;
}
export declare class ShadowListBox extends ListBox { shadow: ShadowRoot; }

export type ControlTags = {
    'push-button': typeof PushButton;
    'check-box': typeof CheckBox;
    'toggle-switch': typeof ToggleSwitch;
    'radio-group': typeof RadioGroup;
    'radio-button': typeof RadioButton;
    'text-field': typeof TextField;
    'text-area': typeof TextArea;
    'spin-box': typeof SpinBox;
    'slider-control': typeof SliderControl;
    'progress-bar': typeof ProgressBar;
    'combo-box': typeof ComboBox;
    'list-box': typeof ListBox;
};

export type ShadowControlTags = {
    'shadow-push-button': typeof ShadowPushButton;
    'shadow-check-box': typeof ShadowCheckBox;
    'shadow-toggle-switch': typeof ShadowToggleSwitch;
    'shadow-radio-group': typeof ShadowRadioGroup;
    'shadow-radio-button': typeof ShadowRadioButton;
    'shadow-text-field': typeof ShadowTextField;
    'shadow-text-area': typeof ShadowTextArea;
    'shadow-spin-box': typeof ShadowSpinBox;
    'shadow-slider-control': typeof ShadowSliderControl;
    'shadow-progress-bar': typeof ShadowProgressBar;
    'shadow-combo-box': typeof ShadowComboBox;
    'shadow-list-box': typeof ShadowListBox;
};

/** The default tag of each control. */
export declare const controlTags: ControlTags;
/** The same controls, each in an open shadow root. */
export declare const shadowControlTags: ShadowControlTags;
/** Defines each default tag that is not defined yet. With `shadow`, also the shadow tags. */
export declare function defineControls(options?: {shadow?: boolean}): void;

/** The first submit button of the form in tree order: a `push-button type="submit"` or a native one. */
export declare function defaultButton(form: HTMLFormElement | null | undefined): Element | null;
/** Implicit submission, as the browser does it for Enter in a native field. Returns true if it clicked the default button or submitted. */
export declare function submitImplicitly(form: HTMLFormElement | null | undefined): boolean;

declare global {
    interface HTMLElementTagNameMap {
        'push-button': PushButton;
        'check-box': CheckBox;
        'toggle-switch': ToggleSwitch;
        'radio-group': RadioGroup;
        'radio-button': RadioButton;
        'text-field': TextField;
        'text-area': TextArea;
        'spin-box': SpinBox;
        'slider-control': SliderControl;
        'progress-bar': ProgressBar;
        'combo-box': ComboBox;
        'list-box': ListBox;
        'shadow-push-button': ShadowPushButton;
        'shadow-check-box': ShadowCheckBox;
        'shadow-toggle-switch': ShadowToggleSwitch;
        'shadow-radio-group': ShadowRadioGroup;
        'shadow-radio-button': ShadowRadioButton;
        'shadow-text-field': ShadowTextField;
        'shadow-text-area': ShadowTextArea;
        'shadow-spin-box': ShadowSpinBox;
        'shadow-slider-control': ShadowSliderControl;
        'shadow-progress-bar': ShadowProgressBar;
        'shadow-combo-box': ShadowComboBox;
        'shadow-list-box': ShadowListBox;
    }
}
