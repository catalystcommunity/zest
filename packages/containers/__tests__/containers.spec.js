import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushRenders } from '@catalystcommunity/base-components';
import {
    defineContainers, containerTags, GroupBox, TabView, SplitView, AccordionView, DialogWindow,
    showMessage, askConfirm, askText, WindowArea, FloatingWindow, StatusPane, BoxLayout,
} from '../src';

defineContainers();

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const key = (target, name, init = {}) => target.dispatchEvent(new KeyboardEvent('keydown', {key: name, bubbles: true, composed: true, cancelable: true, ...init}));
function add(html) {
    const holder = document.createElement('div');
    holder.innerHTML = html;
    document.body.append(holder);
    return holder.firstElementChild;
}

afterEach(() => {
    document.body.replaceChildren();
    flushRenders();
});

describe('the package', () => {
    it('defines each default tag, and defines nothing again', () => {
        expect(customElements.get('tab-view')).toBe(TabView);
        expect(Object.keys(containerTags)).toHaveLength(14);
        expect(() => defineContainers()).not.toThrow();
    });

    it('keeps the native part property of each container', () => {
        // jsdom has no part property, so check that no container class hides it
        for (const [tag, componentClass] of Object.entries(containerTags)) {
            for (let at = componentClass.prototype; at && at !== HTMLElement.prototype; at = Object.getPrototypeOf(at)) {
                expect(Object.hasOwn(at, 'part'), tag).toBe(false);
            }
        }
    });
});

describe('group-box', () => {
    it('has a title, and a check box that turns the content off', async () => {
        const box = add('<group-box label="Proxy" checkable><input aria-label="Host"></group-box>');
        await tick();
        expect(box).toBeInstanceOf(GroupBox);
        const content = box.shadowRoot.querySelector('.zest-content');
        expect(content.inert).toBe(true);
        const changes = vi.fn();
        box.addEventListener('group-box-check', changes);
        const check = box.shadowRoot.querySelector('input');
        check.click();
        await tick();
        expect(box.checked).toBe(true);
        expect(box.hasAttribute('checked')).toBe(true);
        expect(content.inert).toBe(false);
        expect(changes).toHaveBeenCalledTimes(1);
        expect(box.shadowRoot.querySelector('.zest-check-text').textContent).toBe('Proxy');
    });

    it('shows and hides the content with its button', async () => {
        const box = add('<group-box label="More" collapsible><p>Text</p></group-box>');
        await tick();
        const toggle = box.shadowRoot.querySelector('.zest-toggle');
        const heard = vi.fn();
        box.addEventListener('group-box-toggle', heard);
        toggle.click();
        await tick();
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(box.shadowRoot.querySelector('.zest-content').hidden).toBe(true);
        expect(heard.mock.calls[0][0].detail).toEqual({collapsed: true});
    });
});

describe('tab-view', () => {
    async function tabs(attributes = '') {
        const view = add(`<tab-view ${attributes}>
            <tab-page label="One" id="p1">First</tab-page>
            <tab-page label="Two" id="p2" closable>Second</tab-page>
            <tab-page label="Three" id="p3">Third</tab-page>
        </tab-view>`);
        await tick();
        return {view, tabs: () => [...view.shadowRoot.querySelectorAll('[role="tab"]')], pages: view.pages};
    }

    it('makes a tab for each page, and shows only the selected page', async () => {
        const {tabs: list, pages} = await tabs();
        expect(list().map(tab => tab.textContent.replace('×', ''))).toEqual(['One', 'Two', 'Three']);
        expect(list().map(tab => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
        expect(pages.map(page => page.hidden)).toEqual([false, true, true]);
        expect(pages[0].getAttribute('role')).toBe('tabpanel');
        expect(pages[0].getAttribute('aria-label')).toBe('One');
        expect(list().map(tab => tab.tabIndex)).toEqual([0, -1, -1]);
    });

    it('selects with a click and with the arrow keys, and sends an event for each', async () => {
        const {view, tabs: list} = await tabs();
        const heard = [];
        view.addEventListener('tab-view-select', e => heard.push(e.detail.id));
        list()[2].click();
        await tick();
        expect(view.selected).toBe(2);
        list()[2].focus();
        key(list()[2], 'ArrowRight');
        await tick();
        expect(view.selected).toBe(0);
        expect(heard).toEqual(['p3', 'p1']);
    });

    it('moves only the focus with manual activation, until Enter or a click', async () => {
        const {view, tabs: list} = await tabs('activation="manual"');
        list()[0].focus();
        key(list()[0], 'ArrowRight');
        await tick();
        expect(view.selected).toBe(0);
        expect(view.shadowRoot.activeElement).toBe(list()[1]);
        expect(list()[1].tabIndex).toBe(0);
        list()[1].click();
        await tick();
        expect(view.selected).toBe(1);
    });

    it('closes a closable tab with Delete, unless a listener cancels it', async () => {
        const {view, tabs: list} = await tabs();
        view.select('p2');
        await tick();
        expect(list()[1].getAttribute('aria-keyshortcuts')).toBe('Delete');
        const cancel = (e) => e.preventDefault();
        view.addEventListener('tab-view-close', cancel);
        key(list()[1], 'Delete');
        await tick();
        expect(view.pages).toHaveLength(3);
        view.removeEventListener('tab-view-close', cancel);
        key(list()[1], 'Delete');
        await tick();
        expect(view.pages.map(page => page.id)).toEqual(['p1', 'p3']);
        expect(view.selectedPage.id).toBe('p3');
        key(list()[1], 'Delete');
        await tick();
        expect(view.pages).toHaveLength(2);
    });

    it('selects from code with no event, and makes a tab for a new page', async () => {
        const {view, tabs: list} = await tabs('placement="start"');
        const heard = vi.fn();
        view.addEventListener('tab-view-select', heard);
        view.select(view.pages[1]);
        const page = document.createElement('tab-page');
        page.label = 'Four';
        view.append(page);
        await tick();
        expect(heard).not.toHaveBeenCalled();
        expect(list()).toHaveLength(4);
        expect(view.shadowRoot.querySelector('[role="tablist"]').getAttribute('aria-orientation')).toBe('vertical');
        page.label = 'Renamed';
        await tick();
        expect(list()[3].textContent).toContain('Renamed');
    });
});

describe('split-view', () => {
    async function split(sizes = '[100,100]', extra = '') {
        const view = add(`<split-view sizes="${sizes}" ${extra}><div label="Left">L</div><div min-size="80">R</div></split-view>`);
        await tick();
        flushRenders();
        return {view, divider: view.shadowRoot.querySelector('[role="separator"]')};
    }

    it('puts a divider between the panes, with a value and a name', async () => {
        const {view, divider} = await split();
        expect(view.shadowRoot.querySelectorAll('[role="separator"]')).toHaveLength(1);
        expect(divider.getAttribute('aria-valuenow')).toBe('50');
        expect(divider.getAttribute('aria-label')).toBe('Resize Left');
        expect(divider.getAttribute('aria-orientation')).toBe('vertical');
        expect(view.shadowRoot.querySelector('.zest-split').style.gridTemplateColumns).toContain('100fr');
    });

    it('changes the sizes with the arrow keys, keeps the minimum, and sends an event', async () => {
        const {view, divider} = await split();
        const heard = vi.fn();
        view.addEventListener('split-view-resize', heard);
        key(divider, 'ArrowRight');
        expect(view.sizes).toEqual([110, 90]);
        key(divider, 'End');
        expect(view.sizes).toEqual([120, 80]);
        key(divider, 'Home');
        expect(view.sizes).toEqual([32, 168]);
        expect(heard).toHaveBeenCalledTimes(3);
        flushRenders();
        expect(divider.getAttribute('aria-valuenow')).toBe('16');
    });

    it('collapses the pane before the divider with Enter, and restores it', async () => {
        const {view, divider} = await split();
        key(divider, 'Enter');
        flushRenders();
        expect(view.collapsedPanes).toEqual([0]);
        expect(view.panes[0].inert).toBe(true);
        expect(divider.getAttribute('aria-valuenow')).toBe('0');
        key(divider, 'Enter');
        flushRenders();
        expect(view.panes[0].inert).toBe(false);
        expect(view.sizes[0]).toBe(100);
    });

    it('uses rows for a vertical split', async () => {
        const {view, divider} = await split('[1,1]', 'orientation="vertical"');
        expect(view.shadowRoot.querySelector('.zest-split').style.gridTemplateRows).toContain('fr');
        expect(divider.getAttribute('aria-orientation')).toBe('horizontal');
        key(divider, 'ArrowDown');
        expect(view.sizes[0]).toBeGreaterThan(1);
    });
});

describe('accordion-view', () => {
    it('keeps one section open, unless multiple is set, and the arrows go between headings', async () => {
        const view = add(`<accordion-view>
            <accordion-section label="A" open>a</accordion-section>
            <accordion-section label="B">b</accordion-section>
        </accordion-view>`);
        await tick();
        expect(view).toBeInstanceOf(AccordionView);
        const [a, b] = view.sections;
        const header = (section) => section.shadowRoot.querySelector('button');
        header(b).click();
        await tick();
        expect([a.open, b.open]).toEqual([false, true]);
        expect(header(b).getAttribute('aria-expanded')).toBe('true');
        expect(b.shadowRoot.querySelector('[role="heading"]').getAttribute('aria-level')).toBe('3');
        view.multiple = true;
        header(a).click();
        await tick();
        expect([a.open, b.open]).toEqual([true, true]);
        header(a).focus();
        key(header(a), 'ArrowDown');
        expect(b.shadowRoot.activeElement).toBe(header(b));
    });
});

describe('dialog-window', () => {
    it('gives the value of the button that closes it, and returns the focus', async () => {
        const opener = add('<button>Open</button>');
        opener.focus();
        const dialog = add('<dialog-window label="Save?"><p>Text</p><button slot="buttons" value="save" data-default>Save</button><button slot="buttons" value="cancel">Cancel</button></dialog-window>');
        await tick();
        expect(dialog).toBeInstanceOf(DialogWindow);
        const closed = vi.fn();
        dialog.addEventListener('dialog-window-close', closed);
        const result = dialog.showModal();
        expect(dialog.open).toBe(true);
        expect(document.activeElement).toBe(dialog.querySelector('[value="save"]'));
        dialog.querySelector('[value="save"]').click();
        await expect(result).resolves.toBe('save');
        expect(closed.mock.calls[0][0].detail).toEqual({value: 'save'});
        expect(document.activeElement).toBe(opener);
        expect(dialog.open).toBe(false);
    });

    it('clicks the default button on Enter, and gives cancel from the close button', async () => {
        const dialog = add('<dialog-window label="Q"><p>Text</p><button slot="buttons" value="yes" data-default>Yes</button></dialog-window>');
        await tick();
        let result = dialog.show();
        key(dialog.shadowRoot.querySelector('.zest-content'), 'Enter');
        await expect(result).resolves.toBe('yes');
        result = dialog.show();
        dialog.shadowRoot.querySelector('.zest-close').click();
        await expect(result).resolves.toBe('cancel');
    });

    it('tells the kind in words, and uses alertdialog for a warning', async () => {
        const dialog = add('<dialog-window label="Disk" kind="warning"></dialog-window>');
        await tick();
        expect(dialog.shadowRoot.querySelector('.zest-kind').textContent).toBe('Warning: ');
        expect(dialog.shadowRoot.querySelector('dialog').getAttribute('role')).toBe('alertdialog');
    });

    it('has helpers for a message, a confirmation, and a line of text', async () => {
        const message = showMessage({title: 'Done', text: 'Saved.', buttons: ['OK', 'Show']});
        await tick();
        const shown = document.querySelector('dialog-window');
        expect([...shown.querySelectorAll('button')].map(button => button.value)).toEqual(['ok', 'show']);
        shown.querySelector('[value="show"]').click();
        await expect(message).resolves.toBe('show');
        expect(document.querySelector('dialog-window')).toBeNull();

        const confirm = askConfirm({title: 'Delete?', text: 'Sure?'});
        await tick();
        document.querySelector('dialog-window [value="ok"]').click();
        await expect(confirm).resolves.toBe(true);

        const name = askText({title: 'Rename', label: 'Name', value: 'old', required: true});
        await tick();
        const input = document.querySelector('dialog-window input');
        expect(document.activeElement).toBe(input);
        input.value = '';
        input.dispatchEvent(new Event('input'));
        expect(document.querySelector('dialog-window [value="ok"]').disabled).toBe(true);
        input.value = 'new';
        input.dispatchEvent(new Event('input'));
        key(input, 'Enter');
        await expect(name).resolves.toBe('new');

        const cancelled = askText({title: 'Rename', label: 'Name'});
        await tick();
        document.querySelector('dialog-window').close('cancel');
        await expect(cancelled).resolves.toBeNull();
    });
});

// A component host with an inner button, as push-button is: in the light DOM, or in a shadow root
class FakeButton extends HTMLElement {
    connectedCallback() {
        if (this.inner) { return; }
        this.inner = document.createElement('button');
        this.inner.type = 'button';
        this.inner.textContent = this.getAttribute('label') ?? '';
        if (this.hasAttribute('shadow')) { this.attachShadow({mode: 'open'}).append(this.inner); } else { this.append(this.inner); }
    }
    get focusTarget() { return this.inner; }
    get disabled() { return this.hasAttribute('disabled'); }
}
customElements.define('fake-button', FakeButton);

describe('dialog-window close requests', () => {
    const make = async (buttons) => {
        const dialog = add(`<dialog-window label="Edit"><input aria-label="Name">${buttons}</dialog-window>`);
        await tick();
        return dialog;
    };

    it('sends a cancelable event before a button closes it, and close() later gives the result', async () => {
        const dialog = await make('<button slot="buttons" value="save" data-default>Save</button><button slot="buttons" value="cancel">Cancel</button>');
        const requests = [];
        dialog.addEventListener('dialog-window-before-close', (e) => {
            requests.push(e.detail);
            if (e.detail.value === 'save') { e.preventDefault(); }
        });
        const closed = vi.fn();
        dialog.addEventListener('dialog-window-close', closed);
        const result = dialog.showModal();
        const save = dialog.querySelector('[value="save"]');
        save.click();
        expect(dialog.open).toBe(true);
        expect(closed).not.toHaveBeenCalled();
        expect(requests).toEqual([{value: 'save', reason: 'button', button: save}]);
        // The application saves, then closes the dialog. close() sends no request.
        dialog.close('save');
        await expect(result).resolves.toBe('save');
        expect(requests).toHaveLength(1);
        expect(closed.mock.calls[0][0].detail).toEqual({value: 'save'});
    });

    it('gives the reason of the close button and of Escape, and either can be stopped', async () => {
        const dialog = await make('<button slot="buttons" value="ok">OK</button>');
        const reasons = [];
        let keep = true;
        dialog.addEventListener('dialog-window-before-close', (e) => {
            reasons.push(e.detail.reason);
            expect(e.detail.value).toBe('cancel');
            expect(e.detail.button).toBeNull();
            if (keep) { e.preventDefault(); }
        });
        const result = dialog.showModal();
        dialog.shadowRoot.querySelector('.zest-close').click();
        const escape = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, composed: true, cancelable: true});
        dialog.querySelector('input').dispatchEvent(escape);
        expect(escape.defaultPrevented).toBe(true);
        expect(dialog.open).toBe(true);
        expect(reasons).toEqual(['close-button', 'escape']);
        keep = false;
        key(dialog.querySelector('input'), 'Escape');
        await expect(result).resolves.toBe('cancel');
    });

    it('does not close on Escape when a child used the key, or when the dialog is not modal', async () => {
        const dialog = await make('');
        const requests = vi.fn();
        dialog.addEventListener('dialog-window-before-close', requests);
        dialog.showModal();
        const input = dialog.querySelector('input');
        input.addEventListener('keydown', (e) => e.preventDefault(), {once: true});
        key(input, 'Escape');
        expect(dialog.open).toBe(true);
        dialog.close();
        dialog.show();
        key(input, 'Escape');
        expect(dialog.open).toBe(true);
        expect(requests).not.toHaveBeenCalled();
    });

    it('requestClose() asks first, as the user does', async () => {
        const dialog = await make('');
        dialog.addEventListener('dialog-window-before-close', (e) => e.preventDefault(), {once: true});
        const result = dialog.showModal();
        expect(dialog.requestClose('later')).toBe(false);
        expect(dialog.open).toBe(true);
        expect(dialog.requestClose('done')).toBe(true);
        await expect(result).resolves.toBe('done');
        expect(dialog.requestClose('again')).toBe(false);
    });

    it('a button with data-keep-open stays open and sends no request', async () => {
        const dialog = await make('<button slot="buttons" value="test" data-keep-open>Test</button><button slot="buttons" value="ok">OK</button>');
        const requests = vi.fn();
        dialog.addEventListener('dialog-window-before-close', requests);
        const result = dialog.showModal();
        dialog.querySelector('[value="test"]').click();
        expect(dialog.open).toBe(true);
        expect(requests).not.toHaveBeenCalled();
        dialog.querySelector('[value="ok"]').click();
        await expect(result).resolves.toBe('ok');
    });

    it('a component button in the slot closes as a native button does, in the light DOM and in a shadow root', async () => {
        for (const shadow of [false, true]) {
            const dialog = await make(`<fake-button slot="buttons" value="save" label="Save" data-default ${shadow ? 'shadow' : ''}></fake-button><fake-button slot="buttons" value="off" label="Off" disabled></fake-button>`);
            const host = dialog.querySelector('[value="save"]');
            const requests = [];
            dialog.addEventListener('dialog-window-before-close', (e) => {
                requests.push(e.detail);
                e.preventDefault();
            });
            const result = dialog.showModal();
            dialog.querySelector('[value="off"]').inner.click();
            expect(requests).toEqual([]);
            host.inner.click();
            expect(requests).toEqual([{value: 'save', reason: 'button', button: host}]);
            expect(dialog.open).toBe(true);
            dialog.close('save');
            await expect(result).resolves.toBe('save');
            dialog.remove();
        }
    });

    it('a button that is not a slot button, and not data-close, does not close', async () => {
        const dialog = await make('<div slot="buttons"><button value="help">Help</button></div><p><button data-close="done">Done</button></p>');
        const result = dialog.showModal();
        dialog.querySelector('[value="help"]').click();
        expect(dialog.open).toBe(true);
        dialog.querySelector('[data-close]').click();
        await expect(result).resolves.toBe('done');
    });
});

describe('danger buttons', () => {
    it('askConfirm({danger}) marks the OK button, with a sign that is not color', async () => {
        const confirm = askConfirm({title: 'Delete the file?', text: 'You cannot undo this.', okLabel: 'Delete', kind: 'warning', danger: true});
        await tick();
        const ok = document.querySelector('dialog-window [value="ok"]');
        expect(ok.hasAttribute('data-danger')).toBe(true);
        expect(ok.hasAttribute('data-default')).toBe(true);
        // The button row shows before the focus moves, so the default button gets it
        expect(document.activeElement).toBe(ok);
        expect(ok.querySelector('[aria-hidden="true"]').textContent).toBe('⚠ ');
        expect(ok.textContent).toBe('⚠ Delete');
        expect(document.querySelector('dialog-window [value="cancel"]').hasAttribute('data-danger')).toBe(false);
        document.querySelector('dialog-window [value="cancel"]').click();
        await expect(confirm).resolves.toBe(false);

        const plain = askConfirm({title: 'Continue?'});
        await tick();
        expect(document.querySelector('dialog-window [data-danger]')).toBeNull();
        document.querySelector('dialog-window [value="ok"]').click();
        await expect(plain).resolves.toBe(true);
    });

    it('showMessage takes danger on each button', async () => {
        const message = showMessage({title: 'Remove', buttons: [{label: 'Keep', value: 'keep', default: true}, {label: 'Remove', value: 'remove', danger: true}]});
        await tick();
        expect([...document.querySelectorAll('dialog-window [data-danger]')].map(button => button.value)).toEqual(['remove']);
        document.querySelector('dialog-window [value="remove"]').click();
        await expect(message).resolves.toBe('remove');
    });
});

describe('window-area', () => {
    async function area() {
        const element = add(`<window-area>
            <floating-window label="One" x="10" y="10"></floating-window>
            <floating-window label="Two" x="40" y="40"></floating-window>
        </window-area>`);
        await tick();
        flushRenders();
        return {area: element, windows: element.windows};
    }

    it('puts the last window on top, and the one the user selects on top after that', async () => {
        const {area: element, windows: [one, two]} = await area();
        expect(element).toBeInstanceOf(WindowArea);
        expect(two.active).toBe(true);
        expect(Number(two.style.zIndex)).toBeGreaterThan(Number(one.style.zIndex));
        one.shadowRoot.querySelector('.zest-content').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, composed: true}));
        expect(one.active).toBe(true);
        expect(two.active).toBe(false);
        expect(Number(one.style.zIndex)).toBeGreaterThan(Number(two.style.zIndex));
    });

    it('moves with Alt+F7 and the arrows, keeps it with Enter, and cancels with Escape', async () => {
        const {windows: [one]} = await area();
        expect(one).toBeInstanceOf(FloatingWindow);
        const moved = vi.fn();
        one.addEventListener('floating-window-move', moved);
        const handle = one.shadowRoot.querySelector('.zest-handle');
        key(handle, 'F7', {altKey: true});
        expect(one.mode).toBe('move');
        key(handle, 'ArrowRight');
        key(handle, 'ArrowDown', {shiftKey: true});
        key(handle, 'Enter');
        expect([one.x, one.y]).toEqual([20, 11]);
        expect(moved.mock.calls[0][0].detail).toMatchObject({x: 20, y: 11});
        key(handle, 'F8', {altKey: true});
        key(handle, 'ArrowLeft');
        expect(one.width).toBe(310);
        key(handle, 'Escape');
        expect(one.width).toBe(320);
        expect(one.mode).toBe(null);
    });

    it('cycles the handle from move to size to off', async () => {
        const {windows: [one]} = await area();
        const handle = one.shadowRoot.querySelector('.zest-handle');
        handle.click();
        flushRenders();
        expect(handle.getAttribute('aria-pressed')).toBe('true');
        expect(one.shadowRoot.querySelector('.zest-hint').textContent).toContain('Move');
        handle.click();
        expect(one.mode).toBe('size');
        handle.click();
        expect(one.mode).toBe(null);
    });

    it('minimizes, maximizes, and closes, and a listener can stop the close', async () => {
        const {area: element, windows: [one, two]} = await area();
        const states = [];
        one.addEventListener('floating-window-state', e => states.push(e.detail.state));
        one.shadowRoot.querySelector('.zest-maximize').click();
        flushRenders();
        expect(one.style.width).toBe('100%');
        one.shadowRoot.querySelector('.zest-minimize').click();
        flushRenders();
        expect(one.getAttribute('state')).toBe('minimized');
        expect(one.style.bottom).toBe('0px');
        expect(states).toEqual(['maximized', 'minimized']);
        const stop = (e) => e.preventDefault();
        two.addEventListener('floating-window-close', stop);
        two.shadowRoot.querySelector('.zest-close').click();
        expect(element.windows).toHaveLength(2);
        two.removeEventListener('floating-window-close', stop);
        two.shadowRoot.querySelector('.zest-close').click();
        expect(element.windows).toEqual([one]);
    });
});

describe('small containers', () => {
    it('makes a status pane a live region only when asked', async () => {
        const pane = add('<status-pane width="8em">Ready</status-pane>');
        await tick();
        expect(pane).toBeInstanceOf(StatusPane);
        expect(pane.hasAttribute('role')).toBe(false);
        expect(pane.style.getPropertyValue('--_status-width')).toBe('8em');
        pane.live = true;
        await tick();
        expect(pane.getAttribute('role')).toBe('status');
    });

    it('gives a box layout a token gap or a CSS gap', async () => {
        const box = add('<box-layout gap="unrelated" align="center"></box-layout>');
        await tick();
        expect(box).toBeInstanceOf(BoxLayout);
        expect(box.style.getPropertyValue('--_box-gap')).toContain('--zest-gap-unrelated');
        expect(box.style.alignItems).toBe('center');
        box.gap = '3px';
        await tick();
        expect(box.style.getPropertyValue('--_box-gap')).toBe('3px');
    });

    it('gives a scroll area a name and a place in the tab order', async () => {
        const area = add('<scroll-area label="Log"><p>Text</p></scroll-area>');
        await tick();
        const viewport = area.shadowRoot.querySelector('.zest-viewport');
        expect(viewport.getAttribute('aria-label')).toBe('Log');
        expect(viewport.tabIndex).toBe(0);
    });
});
