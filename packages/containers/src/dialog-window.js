import { createElementOf, tokenAliases } from "@catalystcommunity/base-components";
import { ShadowContainer, deepActiveElement, focusRing, smallButton, uid } from "./shared.js";

const KINDS = ['info', 'warning', 'error', 'question'];
const ICONS = {info: 'ℹ', warning: '⚠', error: '⛔', question: '?'};
const TYPING = /^(textarea|select|button)$/;
const FOCUSABLE = 'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"]), [contenteditable]';

// A window over the page, from a native dialog. showModal() and show() give a promise of the
// result: the value of the button that closed it, or 'cancel'.
// Before the user closes it (a button, the close button, or Escape), the dialog sends the cancelable
// event dialog-window-before-close. With preventDefault(), the dialog stays open, and the
// application calls close(value) when it is ready. close() from code sends no such event.
export class DialogWindow extends ShadowContainer {
    static properties = {
        label: {type: String, default: ''},
        kind: {type: String, default: ''},
        // No close button in the title bar. Escape still cancels a modal dialog.
        noClose: {type: Boolean},
        open: {type: Boolean, reflect: true, render: false},
        labels: {type: Object, attribute: false},
    };
    static labels = {close: 'Close', info: 'Information', warning: 'Warning', error: 'Error', question: 'Question'};
    static shadowHtml = `
<dialog part="dialog">
  <div class="zest-titlebar" part="titlebar">
    <span class="zest-icon" aria-hidden="true"></span>
    <div class="zest-title" role="heading" aria-level="2"></div>
    <button type="button" class="zest-close" part="close">×</button>
  </div>
  <div class="zest-content" part="content"><span class="zest-kind"></span><slot></slot></div>
  <div class="zest-buttons" part="buttons"><slot name="buttons"></slot></div>
</dialog>`;
    static styles = `
:host {
    display: contents;
}
dialog {
    ${tokenAliases('dialog-window', 'window')}
    box-sizing: border-box;
    min-width: min(20em, calc(100vw - 2em));
    max-width: min(var(--zest-dialog-window-max-width, 36em), calc(100vw - 2em));
    max-height: calc(100vh - 2em);
    padding: 0;
    color: var(--_window-text);
    background: var(--_window);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: 0 0.5em 2em rgb(0 0 0 / 0.35);
}
dialog[open] {
    display: flex;
    flex-direction: column;
}
dialog::backdrop {
    background: rgb(0 0 0 / 0.4);
}
/* A browser puts a modeless dialog at its place in the page, which can be out of the view, and then
   the focus scrolls the document to it. Over the window, as a modal dialog is. */
dialog:not(:modal) {
    position: fixed;
    inset: 0;
    margin: auto;
    z-index: 1000;
}
.zest-titlebar {
    display: flex;
    align-items: center;
    gap: var(--_gap);
    min-height: var(--_height);
    padding: 0.25em 0.25em 0.25em var(--_padding-inline);
    background-color: var(--_face);
    background-image: var(--_fill);
    color: var(--_face-text);
    border-block-end: var(--_border-width) solid var(--_line);
    border-radius: var(--_radius) var(--_radius) 0 0;
}
.zest-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-weight: bold;
    overflow-wrap: anywhere;
}
.zest-icon:empty {
    display: none;
}
.zest-icon {
    font-size: 1.25em;
}
${smallButton('.zest-close')}
.zest-close {
    min-width: 2em;
    min-height: 2em;
    font-size: 1.125em;
}
.zest-close[hidden] {
    display: none;
}
.zest-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: var(--_padding-inline);
}
.zest-kind {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}
.zest-buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--_gap);
    padding: 0 var(--_padding-inline) var(--_padding-inline);
}
.zest-buttons[hidden] {
    display: none;
}
::slotted(button) {
    box-sizing: border-box;
    min-height: var(--_height);
    min-width: 6em;
    padding: var(--_padding-block) var(--_padding-inline);
    font: inherit;
    color: var(--_face-text);
    background-color: var(--_face);
    background-image: var(--_fill);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    cursor: pointer;
}
::slotted(button[data-default]) {
    font-weight: bold;
    border-width: 2px;
    border-color: var(--_highlight);
}
/* A button that does something that the user cannot undo, such as a delete. It is not shown by color
   only: the helpers put a warning sign before the text, and the default danger button is filled.
   A page style for button wins over ::slotted, but not over !important here, so a general page
   style cannot remove the danger look. The tokens change it. */
::slotted(button[data-danger]:not(:disabled)) {
    color: var(--_invalid) !important;
    background: var(--_window) !important;
    border-color: var(--_invalid) !important;
    font-weight: bold !important;
}
::slotted(button[data-danger][data-default]:not(:disabled)) {
    color: var(--_window) !important;
    background: var(--_invalid) !important;
    border-width: 2px !important;
}
::slotted(button:disabled) {
    color: var(--_disabled-text);
    background: var(--_face);
    border-style: dashed;
    border-color: var(--_disabled-text);
    cursor: default;
}
@media (forced-colors: active) {
    ::slotted(button[data-danger]) {
        border-width: 2px;
        border-style: double;
    }
}
${focusRing}
`;
    #dialog;
    #resolve = null;
    #opener = null;
    #promise = null;
    #modal = false;
    // True while close() closes the native dialog. A close that the browser does alone is a cancel.
    #closing = false;

    get returnValue() {
        return this.#dialog?.returnValue ?? '';
    }

    built() {
        this.#dialog = this.shadowPart('dialog');
        const title = this.shadowPart('.zest-title');
        title.id = uid('dialog-title');
        this.#dialog.setAttribute('aria-labelledby', title.id);
        this.shadowPart('.zest-close').addEventListener('click', () => this.requestClose('cancel', {reason: 'close-button'}));
        // A close request of the browser, such as the back gesture. The dialog closes from here, so
        // that the promise and the events are the same for each way.
        this.#dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            this.requestClose('cancel', {reason: 'escape'});
        });
        this.#dialog.addEventListener('close', () => {
            const value = this.#closing ? this.#dialog.returnValue : 'cancel';
            this.#closing = false;
            this.#finish(value);
        });
        this.shadowPart('slot[name="buttons"]').addEventListener('slotchange', () => this.#showButtons());
        this.#showButtons();
        this.addEventListener('click', (e) => {
            const button = this.#closer(e.composedPath());
            if (button) { this.requestClose(button.dataset.close ?? buttonValue(button), {reason: 'button', button}); }
        });
        this.#dialog.addEventListener('keydown', (e) => {
            // Escape of a modal dialog is done here, not by the browser. A browser closes the dialog with
            // no cancel event after a second Escape with no user activation, and then preventDefault()
            // of dialog-window-before-close could not keep it open.
            if (e.key !== 'Escape' || e.defaultPrevented || !this.#modal || e.isComposing) { return; }
            e.preventDefault();
            this.requestClose('cancel', {reason: 'escape'});
        });
        this.#dialog.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) { return; }
            const target = e.composedPath()[0];
            if (TYPING.test(target.localName ?? '') || target.isContentEditable || target.getAttribute?.('role') === 'button') { return; }
            const preferred = this.querySelector(':scope > [slot="buttons"][data-default]:not([disabled])');
            if (preferred) {
                e.preventDefault();
                preferred.click();
            }
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        // A dialog that leaves the page while it is open gives 'cancel'
        if (this.#resolve) { this.#finish('cancel'); }
    }

    // Opens the dialog as a modal: the rest of the page is inert until it closes
    showModal() {
        return this.#open(true);
    }
    // Opens the dialog, and the rest of the page stays usable
    show() {
        return this.#open(false);
    }
    // The button of the application that a click closes the dialog with, or null. It is a button in
    // the buttons slot, or a button with data-close. A component host whose focusTarget is the
    // clicked button, such as push-button, is the button, as a native button is.
    #closer(path) {
        const index = path.findIndex(node => node instanceof HTMLButtonElement);
        if (index < 0) { return null; }
        const native = path[index];
        const host = path.slice(index + 1).find(node => node instanceof Element);
        const button = host && host.focusTarget === native ? host : native;
        if (button === this || !this.contains(button) || native.disabled || button.disabled) { return null; }
        if (button.hasAttribute('data-keep-open')) { return null; }
        const slotted = button.parentElement === this && button.slot === 'buttons';
        return slotted || button.hasAttribute('data-close') ? button : null;
    }

    // Closes the dialog as the user does: it first sends the cancelable dialog-window-before-close
    // {value, reason, button}. Gives true if the dialog closed.
    requestClose(value = '', {reason = 'code', button = null} = {}) {
        if (!this.#dialog?.open) { return false; }
        const go = this.emit('dialog-window-before-close', {value: String(value), reason, button}, {cancelable: true});
        if (go) { this.close(value); }
        return go;
    }

    // Closes the dialog with a result. It sends no dialog-window-before-close.
    close(value = '') {
        if (!this.#dialog?.open) { return; }
        if (typeof this.#dialog.close === 'function') {
            this.#closing = true;
            this.#dialog.close(String(value));
            return;
        }
        // A document with no dialog support, as in a test
        this.#dialog.removeAttribute('open');
        this.#dialog.returnValue = String(value);
        this.#finish(String(value));
    }

    #open(modal) {
        if (!this.isConnected) { throw new Error('Add the dialog-window to the page before you open it'); }
        if (this.#dialog.open) { return this.#promise; }
        this.#opener = deepActiveElement();
        this.#modal = modal;
        this.#dialog.returnValue = '';
        if (modal && this.#dialog.showModal) { this.#dialog.showModal(); }
        else if (this.#dialog.show) { this.#dialog.show(); }
        else { this.#dialog.setAttribute('open', ''); }
        this.open = true;
        this.#promise = new Promise(resolve => { this.#resolve = resolve; });
        this.#focusFirst();
        return this.#promise;
    }

    // The button row shows only with buttons. slotchange comes after a microtask, so #open also calls this.
    #showButtons() {
        this.shadowPart('.zest-buttons').hidden = !this.shadowPart('slot[name="buttons"]').assignedElements().length;
    }

    #focusFirst() {
        this.#showButtons();
        const children = [...this.children].filter(child => child.slot !== 'buttons');
        const target = this.querySelector('[autofocus]')
            ?? children.flatMap(child => child.matches(FOCUSABLE) ? [child] : [...child.querySelectorAll(FOCUSABLE)])
                .find(element => !element.disabled && !element.closest('[hidden]'))
            ?? this.querySelector(':scope > [slot="buttons"][data-default]')
            ?? this.querySelector(':scope > [slot="buttons"]')
            ?? this.shadowPart('.zest-close');
        target?.focus();
    }

    #finish(value = this.#dialog.returnValue) {
        const resolve = this.#resolve;
        this.#resolve = null;
        this.open = false;
        if (!resolve) { return; }
        const opener = this.#opener;
        this.#opener = null;
        if (opener?.isConnected) { opener.focus(); }
        this.emit('dialog-window-close', {value});
        resolve(value);
    }

    render() {
        const kind = KINDS.includes(this.kind) ? this.kind : '';
        this.shadowPart('.zest-title').textContent = this.label;
        this.shadowPart('.zest-icon').textContent = ICONS[kind] ?? '';
        // The words of the kind come first, so that a screen reader also tells it. The icon is only for the eyes.
        this.shadowPart('.zest-kind').textContent = kind ? `${this.text(kind)}: ` : '';
        const close = this.shadowPart('.zest-close');
        close.hidden = this.noClose;
        close.setAttribute('aria-label', this.text('close'));
        close.title = this.text('close');
        if (kind && kind !== 'info') { this.#dialog.setAttribute('role', 'alertdialog'); } else { this.#dialog.removeAttribute('role'); }
    }
}

// The result of a button: its value property, or its value attribute
function buttonValue(button) {
    return typeof button.value === 'string' ? button.value : (button.getAttribute('value') ?? '');
}

function buttonList(buttons) {
    return buttons.map((button, i) => typeof button === 'string'
        ? {label: button, value: button.toLowerCase(), default: i === 0}
        : {value: button.label?.toLowerCase(), ...button});
}

function makeDialog({title = '', kind = '', parent = document.body, labels}) {
    const dialog = createElementOf(DialogWindow, 'dialog-window', {label: title, kind});
    if (labels) { dialog.labels = labels; }
    parent.append(dialog);
    return dialog;
}

function addButtons(dialog, buttons) {
    for (const item of buttonList(buttons)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.slot = 'buttons';
        button.value = item.value;
        button.textContent = item.label;
        if (item.default) { button.dataset.default = ''; }
        if (item.danger) {
            button.dataset.danger = '';
            // A sign before the text, so that the danger is not shown by color only
            const sign = document.createElement('span');
            sign.setAttribute('aria-hidden', 'true');
            sign.textContent = '⚠ ';
            button.prepend(sign);
        }
        dialog.append(button);
    }
}

async function run(dialog) {
    try {
        return await dialog.showModal();
    } finally {
        dialog.remove();
    }
}

// A message with buttons. Gives the value of the button, or 'cancel' after Escape.
// buttons: ['OK'] or [{label: 'Save', value: 'save', default: true}, {label: 'Cancel', value: 'cancel'}]
// danger: true on a button gives it the look of an action that the user cannot undo.
export function showMessage({title = '', text = '', buttons = [{label: 'OK', value: 'ok', default: true}], kind = 'info', parent, labels} = {}) {
    const dialog = makeDialog({title, kind, parent, labels});
    const message = document.createElement('p');
    message.textContent = text;
    message.style.margin = '0';
    message.style.whiteSpace = 'pre-line';
    dialog.append(message);
    addButtons(dialog, buttons);
    return run(dialog);
}

// A question with OK and Cancel. Gives true for OK. With danger, the OK button has the look of an
// action that the user cannot undo, such as a delete.
export async function askConfirm({title = '', text = '', okLabel = 'OK', cancelLabel = 'Cancel', kind = 'question', danger = false, parent, labels} = {}) {
    const value = await showMessage({title, text, kind, parent, labels, buttons: [
        {label: okLabel, value: 'ok', default: true, danger},
        {label: cancelLabel, value: 'cancel'},
    ]});
    return value === 'ok';
}

// Asks for a line of text. Gives the text, or null after Cancel.
export async function askText({title = '', label = '', value = '', okLabel = 'OK', cancelLabel = 'Cancel', required = false, type = 'text', parent, labels} = {}) {
    const dialog = makeDialog({title, parent, labels});
    const id = uid('ask-text');
    const field = document.createElement('div');
    field.style.display = 'grid';
    field.style.gap = '0.25em';
    const caption = document.createElement('label');
    caption.htmlFor = id;
    caption.textContent = label;
    const input = document.createElement('input');
    input.id = id;
    input.type = type;
    input.value = value;
    input.required = required;
    input.style.font = 'inherit';
    input.style.minHeight = 'var(--zest-control-height, 2.5em)';
    input.style.boxSizing = 'border-box';
    input.style.width = '100%';
    field.append(caption, input);
    dialog.append(field);
    addButtons(dialog, [{label: okLabel, value: 'ok', default: true}, {label: cancelLabel, value: 'cancel'}]);
    const ok = dialog.querySelector('[value="ok"]');
    const update = () => { ok.disabled = required && !input.value.trim(); };
    input.addEventListener('input', update);
    // Enter in the field is the same as OK
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing && !ok.disabled) {
            e.preventDefault();
            ok.click();
        }
    });
    update();
    const promise = dialog.showModal();
    input.select();
    try {
        return (await promise) === 'ok' ? input.value : null;
    } finally {
        dialog.remove();
    }
}
