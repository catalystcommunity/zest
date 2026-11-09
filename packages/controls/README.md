# `Controls`

The basic controls of a GUI toolkit: buttons, check boxes, switches, radio groups, text fields, text areas, spin boxes, sliders, progress bars, combo boxes, and list boxes.

## Usage

```js
import { defineControls } from '@catalystcommunity/controls';

defineControls();                 // the default tags, for example push-button
defineControls({shadow: true});   // also shadow-push-button and the other shadow tags
```

```html
<form>
  <text-field label="Name" name="name" required></text-field>
  <check-box name="subscribe" value="yes">Send me email</check-box>
  <radio-group label="Plan" name="plan">
    <radio-button value="free">Free</radio-button>
    <radio-button value="team" checked>Team</radio-button>
  </radio-group>
  <spin-box label="Seats" name="seats" min="1" max="50" value="3"></spin-box>
  <combo-box label="Country" name="country">
    <option value="ca">Canada</option>
    <option value="us" selected>United States</option>
  </combo-box>
  <push-button type="submit" variant="primary">Send</push-button>
</form>
```

You can also define each class with your own tag: `customElements.define('my-button', PushButton)`. Importing the package defines nothing.

## Design

- **Light DOM and shadow DOM.** Each control makes its own children. The default class puts them in the light DOM. Each `Shadow...` class puts them in an open shadow root, and gives the focus to the inner control. The children of the application, for example the text of a button, go into the control: in the light DOM they move, and in a shadow root a slot shows them.
- **Native parts.** A control uses a native element inside where one exists: a `button`, an `input`, or a `textarea`. The browser then gives the keyboard, the focus, autofill, and the words for a problem in the language of the user.
- **Events.** A control with a value sends `input` while the value changes and `change` when the user commits the value, as a native input does. Each event bubbles and is composed. The events of the inner native element do not leave the control, so you hear each event one time. A change from code sends no event.
- **Forms.** Each control is form associated. It gives its value to its form, follows `disabled` on a parent `fieldset`, goes back to its first value on form reset, and gets its state back when the browser restores the page. `checkValidity()`, `reportValidity()`, `validity`, and `validationMessage` work as on a native input. `focus()` and `blur()` act on the inner control.
- **Problems.** A field shows a problem only after the user leaves the field, or after the form checks it. The problem text is under the field, and the field has `aria-invalid`.
- **Children that change.** In the light DOM, the children of a button, a check box, or a radio button move into the control. Children that you add later also move, and `textContent` or `replaceChildren()` on the host changes only the text. In a shadow root, a slot shows them.
- **Enter submits the form.** Enter in a `text-field` does an implicit submission, as in a native input. It clicks the default button: the first submit button of the form, a `push-button type="submit"` or a native one. A disabled default button stops the submission. With no submit button, the form submits only if it has one field. The control does this itself, because a field in a shadow root is not in the form, and the browser does not know a `push-button` as a submit button. `submitImplicitly(form)` and `defaultButton(form)` do the same for your own fields.
- **Words.** Set the `labels` property to change the words, for example `field.labels = {clear: 'Löschen'}`. The keys are in `DEFAULT_LABELS` in `src/form-control.js`.

Each control has these attributes, and a property with the same name in camelCase:

| Attribute | Description |
| --- | --- |
| `label` | The visible label. With no label, set `aria-label` on the control. |
| `aria-label` | The name of the inner control. It wins over `label` and over the text of a button, so that a row action can say which row it acts on. A change goes to the inner control. |
| `aria-describedby` | Ids of page elements that describe the control, for example a password rule. The inner control gets them after its own help text. In a shadow root, the inner control gets the elements through `ariaDescribedByElements`, because an id cannot refer across the shadow root. |
| `autofocus` | The control gets the focus when it connects, if no other element has the focus. The browser does autofocus only while the page loads, so a control that is added later does it itself. |
| `name` | The name of the value in the form data. |
| `disabled` | The user cannot change the value. The control is not in the form data. |
| `required` | The form is not valid with no value. |

## PushButton

```html
<push-button variant="primary">Save</push-button>
<push-button toggle pressed icon="/bold.svg">Bold</push-button>
```

| Attribute | Default | Description |
| --- | --- | --- |
| `variant` | `default` | `default`, `primary`, `danger`, or `flat`. |
| `toggle` | | The button stays pressed until the user selects it again. It has `aria-pressed`. |
| `pressed` | | The pressed state of a toggle button. |
| `type` | `button` | `submit` or `reset` acts on the form of the button, also from a shadow root. In the light DOM, the inner button has the same type, so the browser also knows it as the default button for a native input. In a shadow root, the default button listens for Enter in the native inputs of its form. |
| `icon` | | A URL of an image, or a character. A screen reader does not read the icon. |

A toggle button sends `input` and `change` when the user changes it. Each button sends the native `click`.

## CheckBox and ToggleSwitch

```html
<check-box checked>Send me email</check-box>
<check-box indeterminate>All of the items</check-box>
<toggle-switch show-state>Wi-Fi</toggle-switch>
```

| Attribute | Default | Description |
| --- | --- | --- |
| `checked` | | The first state, and the state after form reset. The `checked` property is the current state. |
| `indeterminate` | | Shows a mixed state. A click clears it. Not on a switch. |
| `value` | `on` | The value in the form data when checked. |
| `show-state` | | On a switch: shows the words "On" or "Off". |

- `toggle()` changes the state as a click does, and sends the events.
- A switch has the role `switch`. The thumb moves and shows a check mark when it is on, so the state is not shown with color only.

## RadioGroup and RadioButton

```html
<radio-group label="Delivery" value="standard" orientation="horizontal">
  <radio-button value="standard">Standard</radio-button>
  <radio-button value="express">Express</radio-button>
  <radio-button value="drone" disabled>Drone</radio-button>
</radio-group>
```

```js
group.options = [{value: 's', label: 'Small'}, 'Medium', {value: 'l', label: 'Large', disabled: true}];
```

| Attribute | Default | Description |
| --- | --- | --- |
| `value` | | The value of the selected radio button. |
| `orientation` | `vertical` | `vertical` or `horizontal`. |
| `options` | | JSON, or the `options` property. The group makes a radio button for each option. |

- The group has one tab stop: the selected radio button. The arrow keys move the focus and select. They skip a disabled radio button. Space selects the focused radio button.
- With no `value` attribute, a radio button with `checked` gives the first value.
- A required group with no value shows "Select one." after the form checks it.
- `ShadowRadioGroup` slots its radio buttons. Each radio button has the role `radio` on itself, so that the group works the same in the light DOM and in a shadow root.

## TextField

```html
<text-field label="Email" type="email" required autocomplete="email"></text-field>
<text-field label="Price" prefix-text="$" suffix-text="USD" pattern="\d+(\.\d{2})?"></text-field>
```

| Attribute | Default | Description |
| --- | --- | --- |
| `value` | | The first value, and the value after form reset. The `value` property is the current text. |
| `type` | `text` | `text`, `email`, `password`, `search`, `url`, or `tel`. |
| `placeholder` | | Text in an empty field. Do not use it in place of a label. |
| `helper` | | Help text under the field. A problem replaces it. |
| `error` | | A problem from the application, for example "That name is used". `setCustomValidity()` sets it. |
| `pattern`, `minlength`, `maxlength` | | The same rules as a native input. |
| `prefix-text`, `suffix-text` | | Text before and after the value, for example a unit. A screen reader reads it as the description. |
| `readonly`, `autocomplete`, `inputmode` | | The same as a native input. |
| `autocapitalize`, `autocorrect`, `spellcheck`, `enterkeyhint` | | The control copies them to the input. For a user name, set `autocapitalize="none"` and `spellcheck="false"`. `text-area` copies them too. |

- A `search` field has a Clear button. Escape also clears it.
- A `password` field has a Show button. It has `aria-pressed`.
- `select()` selects the text.

## TextArea

```html
<text-area label="Comments" maxlength="200" rows="4" autogrow></text-area>
```

It has the attributes of `TextField` except `type`, `pattern`, and the affixes. It also has these:

| Attribute | Default | Description |
| --- | --- | --- |
| `rows` | 3 | The number of visible lines. |
| `autogrow` | | The field grows with its text. |

With `maxlength`, the field shows a count, for example "42 of 200". A live region tells the number of characters that are left only near the limit, not for each key.

## SpinBox

```html
<spin-box label="Weight" min="0" step="0.25" value="1234.5" locale="de-DE"></spin-box>
```

| Attribute | Default | Description |
| --- | --- | --- |
| `value` | empty | A number, or empty. |
| `min`, `max` | | The limits. |
| `step` | 1 | The change for one step. A value between two steps goes to the next step. |
| `precision` | from `step` | The number of decimals. |
| `locale` | the browser | The format of the number, for example `1.234,50` in German. |

| Key | Action |
| --- | --- |
| Arrow Up, Arrow Down | One step up or down. |
| Page Up, Page Down | A tenth of the range, or ten steps. |
| Home, End | The minimum or the maximum. |
| Enter | Commits the text. |

- The input has the role `spinbutton`. The user can type a number in the format of the locale, also with the digits of another script. The control reads, limits, and formats the number when the user leaves the field.
- The two buttons are for a pointer only. The arrow keys do the same. A button repeats while the user holds it.
- `stepUp(count)` and `stepDown(count)` change the value as the user would, and send the events.

## SliderControl

```html
<slider-control label="Volume" value="30" unit="%" show-value></slider-control>
<slider-control label="Rating" min="1" max="5" ticks marks='[{"value":1,"label":"Bad"},{"value":5,"label":"Good"}]'></slider-control>
```

| Attribute | Default | Description |
| --- | --- | --- |
| `value` | 0 | The value. It stays in the limits and on a step. |
| `min`, `max`, `step` | 0, 100, 1 | The range. |
| `orientation` | `horizontal` | `horizontal` or `vertical`. The bottom of a vertical slider is the minimum. |
| `ticks` | | Shows a tick for each step, or for each tenth of a range with more than 50 steps. |
| `marks` | | JSON, or the `marks` property: labels under the track. |
| `show-value` | | Shows the value next to the label. |
| `unit`, `locale` | | The text of the value. The `format` property is a function that gives the text. |

| Key | Action |
| --- | --- |
| Arrow keys | One step. In a right-to-left page, the left arrow goes up. |
| Page Up, Page Down | A tenth of the range. |
| Home, End | The minimum or the maximum. |

- The thumb has the role `slider` and `aria-valuetext`.
- A press on the track moves the thumb there. A drag sends `input` for each step, and `change` one time at the end.
- The slider renders one time for each frame, so a fast drag does not render more often than the screen.

## ProgressBar

```html
<progress-bar label="Upload" value="45" show-value></progress-bar>
<progress-bar label="Connecting"></progress-bar>
```

| Attribute | Default | Description |
| --- | --- | --- |
| `value` | empty | The progress. With no value, the bar shows that work continues. |
| `max` | 100 | The value of a complete task. |
| `show-value` | | Shows the percent. |
| `value-text` | | Text in place of the percent, for example "3 of 12 files". |

The bar has the role `progressbar`. With reduced motion, the bar that shows continued work does not move. Stripes on all of the bar show the state.

## ComboBox

```html
<combo-box label="Fruit" placeholder="Select a fruit"></combo-box>
<combo-box label="City" editable></combo-box>
```

```js
combo.options = ['Apple', 'Banana', {value: 'c', label: 'Cherry', disabled: true, description: 'Out of season'}];
```

| Attribute | Default | Description |
| --- | --- | --- |
| `options` | | JSON, or the `options` property. With no options, the `option` children give them. |
| `value` | | The value of the selected option. In an editable box, the typed text if it is not the label of an option. |
| `editable` | | The user can type. The list shows the options that contain the text. |
| `placeholder` | | Text when there is no value. |

| Key | Closed | Open |
| --- | --- | --- |
| Arrow Down | Opens the list. | The next option. |
| Arrow Up | Opens the list. | The previous option. |
| Alt + Arrow Down | Opens the list. | |
| Alt + Arrow Up | | Selects the option and closes the list. |
| Enter | Opens the list (select only). Commits the text (editable). | Selects the option and closes the list. |
| Space | Opens the list (select only). | Selects the option (select only). |
| Escape | Clears the text (editable). | Closes the list. |
| Home, End | Opens the list at the first or last option (select only). | The first or the last option (select only). |
| Page Up, Page Down | | Ten options. |
| A letter | Opens the list at an option that starts with it (select only). | The same. |
| Tab | | Selects the option (select only), closes the list, and moves the focus. |

- The control has the role `combobox`. The list has the role `listbox`, and the active option is `aria-activedescendant`.
- The list is a popover in the top layer, so a parent with `overflow: hidden` cannot clip it. It opens below the box, or above it when there is more room above. Its height fits the room.
- A press outside the control closes the list.

## ListBox

```html
<list-box label="Toppings" name="toppings" multiple>
  <option>Cream</option>
  <option selected>Nuts</option>
</list-box>
```

| Attribute | Default | Description |
| --- | --- | --- |
| `options` | | As `ComboBox`. |
| `multiple` | | The user can select more than one option. |
| `value` | | The first selected value. |

The `values` property has all of the selected values. With `multiple`, the form data has one entry for each value, as a native `select` does.

| Key | One option | Many options |
| --- | --- | --- |
| Arrow Up, Arrow Down | Moves and selects. | Moves. |
| Home, End, Page Up, Page Down | Moves and selects. | Moves. |
| Space | | Selects or clears the option. |
| Shift + arrow, Home, or End | | Selects from the last option to the new one. |
| Shift + Space | | Selects from the last option to this one. |
| Ctrl + A | | Selects all, or clears all. |
| A letter | Goes to an option that starts with it. | The same. |

A click on an option in a list of many selects or clears it, and the check mark shows the state. Shift and a click selects a range.

## Page CSS and the light DOM

A light DOM control is part of the page, so a page rule for an element type also changes the inside of the control. For example, `label { display: flex; flex-direction: column }` puts the box of a check box above its text. The default styles of a control are in `@layer zest`, and a page rule with no layer wins over them.

Do one of these:

- Put general page rules for element types in a layer before `zest`:

  ```css
  @layer page, zest;
  @layer page {
      label { display: flex; flex-direction: column; }
  }
  ```

- Or keep the rule off the controls: `label:not(:is(text-field, text-area, combo-box, check-box, toggle-switch, radio-group) label) { ... }`.
- Or use the `Shadow...` classes. A page rule does not go into a shadow root.

The internal class names of each control start with `zest-`. This is also true for the state classes, for example `zest-disabled`, `zest-error`, and `zest-primary`. Thus a page rule for a class such as `.label`, `.box`, or `.primary` does not change a control.

## Tests in happy-dom and jsdom

These environments do not connect a custom element to its form. `form` of a control is `null`, so a `push-button type="submit"` does not submit and Enter in a field does not submit. Call the submit handler in the test, or test the form in a real browser.

## Look

Each control reads the tokens in this order: the control token, for example `--zest-push-button-face`, then the family `--zest-control-*`, then the global `--zest-color-*`, then the system colors.

| Control | Root class | Part |
| --- | --- | --- |
| `PushButton` | `.zest-push-button` | `button` |
| `CheckBox`, `ToggleSwitch` | `.zest-check-box`, `.zest-toggle-switch` | `control` |
| `RadioGroup`, `RadioButton` | `.zest-radio-group`, `.zest-radio-button` | `group`, `circle` |
| `TextField`, `TextArea` | `.zest-text-field`, `.zest-text-area` | `control`, `box` |
| `SpinBox` | `.zest-spin-box` | `control`, `box` |
| `SliderControl` | `.zest-slider` | `control`, `thumb` |
| `ProgressBar` | `.zest-progress` | `control`, `bar` |
| `ComboBox` | `.zest-combo-box` | `control`, `box`, `popup` |
| `ListBox` | `.zest-list-box` | `control`, `list` |

- `--zest-list-box-max-height` sets the height of a list box before it scrolls. The default is `15em`.
- Each target is 24 by 24 CSS pixels or more. The focus ring is a 2px outline on `:focus-visible`. A field box shows the ring for its input, so the input has no second ring.
- A selected option has a check mark, a pressed button has a thicker border and bold text, and a disabled control has a dashed border. A state is never color only.
- In forced colors mode, a selected or pressed state uses `Highlight` and `HighlightText`.
