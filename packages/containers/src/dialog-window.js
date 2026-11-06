import { createElementOf, tokenAliases } from "@catalystcommunity/base-components";
import { ShadowContainer, deepActiveElement, focusRing, smallButton, uid } from "./shared.js";

const KINDS = ['info', 'warning', 'error', 'question'];
const ICONS = {info: 'ℹ', warning: '⚠', error: '⛔', question: '?'};
const TYPING = /^(textarea|select|button)$/;
const FOCUSABLE = 'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"]), [contenteditable]';

// A window over the page, from a native dialog. showModal() and show() give a promise of the
// result: the value of the button that closed it, or 'cancel'.
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
  <div class="titlebar" part="titlebar">
    <span class="icon" aria-hidden="true"></span>
    <div class="title" role="heading" aria-level="2"></div>
    <button type="button" class="close" part="close">×</button>
  </div>
  <div class="content" part="content"><span class="kind"></span><slot></slot></div>
  <div class="buttons" part="buttons"><slot name="buttons"></slot></div>
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
.titlebar {
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
.title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-weight: bold;
    overflow-wrap: anywhere;
}
.icon:empty {
    display: none;
}
.icon {
    font-size: 1.25em;
}
${smallButton('.close')}
.close {
    min-width: 2em;
    min-height: 2em;
    font-size: 1.125em;
}
.close[hidden] {
    display: none;
}
.content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: var(--_padding-inline);
}
.kind {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}
.buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--_gap);
    padding: 0 var(--_padding-inline) var(--_padding-inline);
}
.buttons[hidden] {
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
${focusRing}
`;
    #dialog;
    #resolve = null;
    #opener = null;
    #promise = null;

    get returnValue() {
        return this.#dialog?.returnValue ?? '';
    }

    built() {
        this.#dialog = this.part('dialog');
        const title = this.part('.title');
        title.id = uid('dialog-title');
        this.#dialog.setAttribute('aria-labelledby', title.id);
        this.part('.close').addEventListener('click', () => this.close('cancel'));
        // Escape. The dialog closes from here, so that the promise and the event are the same for each way.
        this.#dialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            this.close('cancel');
        });
        this.#dialog.addEventListener('close', () => this.#finish());
        const buttons = this.part('slot[name="buttons"]');
        const showButtons = () => { this.part('.buttons').hidden = !buttons.assignedElements().length; };
        buttons.addEventListener('slotchange', showButtons);
        showButtons();
        this.addEventListener('click', (e) => {
            const button = e.composedPath().find(node => node instanceof HTMLButtonElement && this.contains(node));
            if (!button || button.disabled) { return; }
            if (button.slot === 'buttons' || button.hasAttribute('data-close')) {
                this.close(button.dataset.close ?? button.value ?? '');
            }
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
    // Closes the dialog with a result
    close(value = '') {
        if (!this.#dialog?.open) { return; }
        if (typeof this.#dialog.close === 'function') {
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
        this.#dialog.returnValue = '';
        if (modal && this.#dialog.showModal) { this.#dialog.showModal(); }
        else if (this.#dialog.show) { this.#dialog.show(); }
        else { this.#dialog.setAttribute('open', ''); }
        this.open = true;
        this.#promise = new Promise(resolve => { this.#resolve = resolve; });
        this.#focusFirst();
        return this.#promise;
    }

    #focusFirst() {
        const children = [...this.children].filter(child => child.slot !== 'buttons');
        const target = this.querySelector('[autofocus]')
            ?? children.flatMap(child => child.matches(FOCUSABLE) ? [child] : [...child.querySelectorAll(FOCUSABLE)])
                .find(element => !element.disabled && !element.closest('[hidden]'))
            ?? this.querySelector(':scope > [slot="buttons"][data-default]')
            ?? this.querySelector(':scope > [slot="buttons"]')
            ?? this.part('.close');
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
        this.part('.title').textContent = this.label;
        this.part('.icon').textContent = ICONS[kind] ?? '';
        // The words of the kind come first, so that a screen reader also tells it. The icon is only for the eyes.
        this.part('.kind').textContent = kind ? `${this.text(kind)}: ` : '';
        const close = this.part('.close');
        close.hidden = this.noClose;
        close.setAttribute('aria-label', this.text('close'));
        close.title = this.text('close');
        if (kind && kind !== 'info') { this.#dialog.setAttribute('role', 'alertdialog'); } else { this.#dialog.removeAttribute('role'); }
    }
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

// A question with OK and Cancel. Gives true for OK.
export async function askConfirm({title = '', text = '', okLabel = 'OK', cancelLabel = 'Cancel', kind = 'question', parent, labels} = {}) {
    const value = await showMessage({title, text, kind, parent, labels, buttons: [
        {label: okLabel, value: 'ok', default: true},
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
