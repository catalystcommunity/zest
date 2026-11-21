import { createElementOf, tokenAliases } from "@catalystcommunity/base-components";
import { ShadowContainer, deepActiveElement, focusRing, smallButton, uid } from "./shared.js";

const KINDS = ['info', 'warning', 'error', 'question'];
const ICONS = {info: 'ℹ', warning: '⚠', error: '⛔', question: '?'};
const TYPING = /^(textarea|select|button)$/;
const FOCUSABLE = 'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"]), [contenteditable]';
// A slot button that does something that the user cannot undo
const DANGER = ':scope > [slot="buttons"]:is([data-danger], [variant="danger"])';
const NOT_TEXT = /^(button|submit|reset|checkbox|radio|range|color|file|image)$/;

// An element where Space types a space, so the press guard does not stop Space there
function takesSpace(element) {
    if (!element) { return false; }
    if (element.isContentEditable || element.localName === 'textarea') { return true; }
    return element.localName === 'input' && !NOT_TEXT.test(element.type);
}
// An element where Enter types a new line
function takesEnter(element) {
    return Boolean(element && (element.isContentEditable || element.localName === 'textarea'));
}

// A window over the page, from a native dialog. showModal() and show() give a promise of the
// result: the value of the button that closed it, or 'cancel'.
// Before the user closes it (a button, the close button, or Escape), the dialog sends the cancelable
// event dialog-window-before-close. With preventDefault(), the dialog stays open, and the
// application calls close(value) when it is ready. close() from code sends no such event.
//
// A button in the dialog acts only on a press that started after the dialog opened: a key that the
// user held or typed before, or the second click of a double-click that opened the dialog, does
// nothing. A click from code (not trusted) always acts. With a danger button, the dialog first gives
// the focus to its message, and Enter does not click the danger button. disable-for (milliseconds)
// also disables the buttons for that time after the dialog opens.
export class DialogWindow extends ShadowContainer {
    static properties = {
        label: {type: String, default: ''},
        kind: {type: String, default: ''},
        // No close button in the title bar. Escape still cancels a modal dialog.
        noClose: {type: Boolean},
        // Milliseconds after the dialog opens while its buttons do nothing. 0 (the default) is no wait.
        disableFor: {type: Number, default: 0},
        open: {type: Boolean, reflect: true, render: false},
        labels: {type: Object, attribute: false},
    };
    static labels = {close: 'Close', info: 'Information', warning: 'Warning', error: 'Error', question: 'Question', confirmPrompt: 'Type {text} to confirm'};
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
/* The message gets the focus first in a danger dialog. It is not a control, so it has no ring. */
.zest-content:focus {
    outline: none;
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
/* While disable-for runs, the buttons do nothing */
.zest-waiting ::slotted(*) {
    opacity: 0.5;
    cursor: progress;
}
/* !important for the same reason: a page style for button must not make a disabled button look
   like one that the user can press */
::slotted(button:disabled) {
    color: var(--_disabled-text) !important;
    background: var(--_face) !important;
    border-style: dashed !important;
    border-color: var(--_disabled-text) !important;
    cursor: default !important;
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
    // The press guard: the time when the buttons act, the Enter and Space keys that went down after
    // that, and a pointer press that started in the open dialog
    #readyAt = 0;
    #fresh = new Set();
    #pressed = false;
    #waitTimer = null;
    #waiting = [];

    get returnValue() {
        return this.#dialog?.returnValue ?? '';
    }

    built() {
        this.#dialog = this.shadowPart('dialog');
        const title = this.shadowPart('.zest-title');
        title.id = uid('dialog-title');
        this.#dialog.setAttribute('aria-labelledby', title.id);
        // The message can get the focus from code (a danger dialog), but it is not in the Tab order
        this.shadowPart('.zest-content').tabIndex = -1;
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
        // The press guard is on the host, in the capture phase, so that it runs before the buttons
        this.addEventListener('keydown', (e) => this.#guardKeydown(e), true);
        this.addEventListener('keyup', (e) => this.#guardKeyup(e), true);
        this.addEventListener('mousedown', (e) => { if (e.detail <= 1) { this.#pressed = true; } }, true);
        this.addEventListener('pointerdown', (e) => { if (e.pointerType && e.pointerType !== 'mouse') { this.#pressed = true; } }, true);
        this.addEventListener('click', (e) => this.#guardClick(e), true);
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
            if (e.key !== 'Enter' || e.defaultPrevented || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) { return; }
            const target = e.composedPath()[0];
            if (TYPING.test(target.localName ?? '') || target.isContentEditable || target.getAttribute?.('role') === 'button') { return; }
            // Enter never clicks a danger button. The user must move the focus to it.
            const preferred = this.querySelector(':scope > [slot="buttons"][data-default]:not([disabled], [data-danger], [variant="danger"])');
            if (preferred) {
                e.preventDefault();
                preferred.click();
            }
        });
    }

    // The press guard. Enter or Space acts only if its key went down after the buttons are ready. A
    // key that the user held from before the dialog opened only repeats, and it does nothing.
    #guardKeydown(e) {
        if (!this.#dialog.open || (e.key !== 'Enter' && e.key !== ' ')) { return; }
        const ready = performance.now() >= this.#readyAt;
        if (ready && !e.repeat) {
            this.#fresh.add(e.key);
            return;
        }
        if (ready && this.#fresh.has(e.key)) { return; }
        const target = e.composedPath()[0];
        if (e.key === 'Enter' ? takesEnter(target) : takesSpace(target)) { return; }
        e.preventDefault();
    }
    // A button acts on the keyup of Space. With no keydown in the dialog, the keyup does nothing.
    #guardKeyup(e) {
        if (e.key === 'Enter') {
            this.#fresh.delete('Enter');
            return;
        }
        if (e.key !== ' ' || !this.#dialog.open) { return; }
        if (this.#fresh.has(' ')) {
            // The click of the button comes after the keyup
            setTimeout(() => this.#fresh.delete(' '));
            return;
        }
        if (!takesSpace(e.composedPath()[0])) { e.preventDefault(); }
    }
    #guardClick(e) {
        if (!this.#dialog.open) { return; }
        const path = e.composedPath();
        const index = path.findIndex(node => node instanceof HTMLButtonElement);
        if (index < 0 || index > path.indexOf(this)) { return; }
        let acts;
        if (performance.now() < this.#readyAt && this.#isActionButton(path)) {
            acts = false;
        } else if (!e.isTrusted) {
            acts = true;
        } else if (e.detail === 0) {
            // A click from the keyboard
            acts = this.#fresh.has('Enter') || this.#fresh.has(' ');
        } else {
            acts = this.#pressed;
        }
        if (!acts) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }
    // A button that closes the dialog or that is in the buttons slot. disable-for stops these.
    #isActionButton(path) {
        const index = path.findIndex(node => node instanceof HTMLButtonElement);
        const native = path[index];
        if (native === this.shadowPart('.zest-close')) { return false; }
        const host = path.slice(index + 1).find(node => node instanceof Element);
        const button = host && host.focusTarget === native ? host : native;
        return (button.parentElement === this && button.slot === 'buttons') || button.hasAttribute('data-close');
    }
    #startGuard() {
        this.#fresh.clear();
        this.#pressed = false;
        const wait = Math.max(0, Number(this.disableFor) || 0);
        this.#readyAt = performance.now() + wait;
        if (wait > 0) {
            this.#setWaiting(true);
            this.#waitTimer = setTimeout(() => this.#setWaiting(false), wait);
        }
    }
    #stopGuard() {
        clearTimeout(this.#waitTimer);
        this.#waitTimer = null;
        this.#setWaiting(false);
        this.#fresh.clear();
        this.#readyAt = 0;
    }
    // aria-disabled, not disabled: a disabled button loses the focus and leaves the Tab order
    #setWaiting(on) {
        this.shadowPart('.zest-buttons').classList.toggle('zest-waiting', on);
        for (const element of this.#waiting) { element.removeAttribute('aria-disabled'); }
        this.#waiting = [];
        if (!on) { return; }
        for (const button of this.querySelectorAll(':scope > [slot="buttons"], [data-close]')) {
            const target = button.focusTarget ?? button;
            if (target.hasAttribute('aria-disabled')) { continue; }
            target.setAttribute('aria-disabled', 'true');
            this.#waiting.push(target);
        }
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
        this.#startGuard();
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
        // With a danger button, the message gets the focus, not a button: a key that the user types
        // when the dialog opens then presses nothing.
        const content = this.shadowPart('.zest-content');
        const target = this.querySelector('[autofocus]')
            ?? children.flatMap(child => child.matches(FOCUSABLE) ? [child] : [...child.querySelectorAll(FOCUSABLE)])
                .find(element => !element.disabled && !element.closest('[hidden]'))
            ?? (this.querySelector(DANGER) ? content : null)
            ?? this.querySelector(':scope > [slot="buttons"][data-default]')
            ?? this.querySelector(':scope > [slot="buttons"]')
            ?? this.shadowPart('.zest-close');
        target?.focus();
    }

    #finish(value = this.#dialog.returnValue) {
        const resolve = this.#resolve;
        this.#resolve = null;
        this.open = false;
        this.#stopGuard();
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

function makeDialog({title = '', kind = '', parent = document.body, labels, disableFor = 0}) {
    const dialog = createElementOf(DialogWindow, 'dialog-window', {label: title, kind});
    if (labels) { dialog.labels = labels; }
    if (disableFor > 0) { dialog.disableFor = disableFor; }
    parent.append(dialog);
    return dialog;
}

function addMessage(dialog, text) {
    const message = document.createElement('p');
    message.textContent = text;
    message.style.margin = '0';
    message.style.whiteSpace = 'pre-line';
    dialog.append(message);
}

// A field with a label above it. caption is text or nodes. Gives the input.
function addField(dialog, ...caption) {
    const id = uid('dialog-field');
    const field = document.createElement('div');
    field.style.display = 'grid';
    field.style.gap = '0.25em';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.append(...caption);
    const input = document.createElement('input');
    input.id = id;
    input.style.font = 'inherit';
    input.style.minHeight = 'var(--zest-control-height, 2.5em)';
    input.style.boxSizing = 'border-box';
    input.style.width = '100%';
    field.append(label, input);
    dialog.append(field);
    return input;
}

// Enter in the field clicks the button, if it is enabled. A held Enter does nothing: the dialog
// stops it before this listener.
function enterClicks(input, button) {
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing && !e.defaultPrevented && !button.disabled) {
            e.preventDefault();
            button.click();
        }
    });
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
// disableFor: milliseconds after the dialog opens while its buttons do nothing.
export function showMessage({title = '', text = '', buttons = [{label: 'OK', value: 'ok', default: true}], kind = 'info', parent, labels, disableFor = 0} = {}) {
    const dialog = makeDialog({title, kind, parent, labels, disableFor});
    addMessage(dialog, text);
    addButtons(dialog, buttons);
    return run(dialog);
}

// A question with OK and Cancel. Gives true for OK. With danger, the OK button has the look of an
// action that the user cannot undo, such as a delete: the message gets the focus, and Enter does
// not click OK. With confirmText, OK is enabled only after the user types that text in a field.
export async function askConfirm({title = '', text = '', okLabel = 'OK', cancelLabel = 'Cancel', kind = 'question', danger = false, confirmText = '', parent, labels, disableFor = 0} = {}) {
    const buttons = [
        {label: okLabel, value: 'ok', default: true, danger},
        {label: cancelLabel, value: 'cancel'},
    ];
    const expected = String(confirmText ?? '').trim();
    if (!expected) { return (await showMessage({title, text, kind, parent, labels, disableFor, buttons})) === 'ok'; }
    const dialog = makeDialog({title, kind, parent, labels, disableFor});
    if (text) { addMessage(dialog, text); }
    // The prompt shows the text to type in bold, at the place of {text}
    const [before, after = ''] = dialog.text('confirmPrompt').split('{text}');
    const shown = document.createElement('strong');
    shown.textContent = expected;
    const input = addField(dialog, before, shown, after);
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('autocapitalize', 'none');
    addButtons(dialog, buttons);
    const ok = dialog.querySelector('[value="ok"]');
    const update = () => { ok.disabled = input.value.trim() !== expected; };
    input.addEventListener('input', update);
    update();
    enterClicks(input, ok);
    return (await run(dialog)) === 'ok';
}

// Asks for a line of text. Gives the text, or null after Cancel.
export async function askText({title = '', label = '', value = '', okLabel = 'OK', cancelLabel = 'Cancel', required = false, type = 'text', parent, labels, disableFor = 0} = {}) {
    const dialog = makeDialog({title, parent, labels, disableFor});
    const input = addField(dialog, label);
    input.type = type;
    input.value = value;
    input.required = required;
    addButtons(dialog, [{label: okLabel, value: 'ok', default: true}, {label: cancelLabel, value: 'cancel'}]);
    const ok = dialog.querySelector('[value="ok"]');
    const update = () => { ok.disabled = required && !input.value.trim(); };
    input.addEventListener('input', update);
    // Enter in the field is the same as OK
    enterClicks(input, ok);
    update();
    const promise = dialog.showModal();
    input.select();
    try {
        return (await promise) === 'ok' ? input.value : null;
    } finally {
        dialog.remove();
    }
}
