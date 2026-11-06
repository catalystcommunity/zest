import { defineElements } from "@catalystcommunity/base-components";
import { PushButton, ShadowPushButton } from "./button.js";
import { CheckBox, ShadowCheckBox, ShadowToggleSwitch, ToggleSwitch } from "./check.js";
import { ComboBox, ShadowComboBox } from "./combo.js";
import { ListBox, ShadowListBox } from "./listbox.js";
import { RadioButton, RadioGroup, ShadowRadioButton, ShadowRadioGroup } from "./radio.js";
import { ProgressBar, ShadowProgressBar, ShadowSliderControl, SliderControl } from "./slider.js";
import { ShadowSpinBox, SpinBox } from "./spin.js";
import { ShadowTextArea, ShadowTextField, TextArea, TextField } from "./text.js";

// The design and each option are in the README. Importing this package defines no tags.

// The default tag of each control
export const controlTags = {
    'push-button': PushButton,
    'check-box': CheckBox,
    'toggle-switch': ToggleSwitch,
    'radio-group': RadioGroup,
    'radio-button': RadioButton,
    'text-field': TextField,
    'text-area': TextArea,
    'spin-box': SpinBox,
    'slider-control': SliderControl,
    'progress-bar': ProgressBar,
    'combo-box': ComboBox,
    'list-box': ListBox,
};

// The same controls, each in an open shadow root
export const shadowControlTags = {
    'shadow-push-button': ShadowPushButton,
    'shadow-check-box': ShadowCheckBox,
    'shadow-toggle-switch': ShadowToggleSwitch,
    'shadow-radio-group': ShadowRadioGroup,
    'shadow-radio-button': ShadowRadioButton,
    'shadow-text-field': ShadowTextField,
    'shadow-text-area': ShadowTextArea,
    'shadow-spin-box': ShadowSpinBox,
    'shadow-slider-control': ShadowSliderControl,
    'shadow-progress-bar': ShadowProgressBar,
    'shadow-combo-box': ShadowComboBox,
    'shadow-list-box': ShadowListBox,
};

// Defines each default tag that is not defined yet. With `shadow`, also the shadow tags.
export function defineControls({shadow = false} = {}) {
    defineElements(controlTags);
    if (shadow) { defineElements(shadowControlTags); }
}

export {
    PushButton, ShadowPushButton,
    CheckBox, ShadowCheckBox,
    ToggleSwitch, ShadowToggleSwitch,
    RadioGroup, ShadowRadioGroup,
    RadioButton, ShadowRadioButton,
    TextField, ShadowTextField,
    TextArea, ShadowTextArea,
    SpinBox, ShadowSpinBox,
    SliderControl, ShadowSliderControl,
    ProgressBar, ShadowProgressBar,
    ComboBox, ShadowComboBox,
    ListBox, ShadowListBox,
};
