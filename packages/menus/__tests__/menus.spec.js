import { describe, it, expect, vi, afterEach } from 'vitest';
import { Action, ActionGroup } from '@catalystcommunity/actions';
import {
    PopupMenu, ShadowPopupMenu, MenuBar, ShadowMenuBar, MenuButton, ToolBar, ShadowToolBar, ToolTip, NoticeArea,
    attachContextMenu, attachToolTip, showNotice, menuEntries, menuActions, parseMnemonic,
} from '../src';

customElements.define('popup-menu', PopupMenu);
customElements.define('shadow-popup-menu', ShadowPopupMenu);
customElements.define('menu-bar', MenuBar);
customElements.define('shadow-menu-bar', ShadowMenuBar);
customElements.define('menu-button', MenuButton);
customElements.define('tool-bar', ToolBar);
customElements.define('shadow-tool-bar', ShadowToolBar);
customElements.define('tool-tip', ToolTip);
customElements.define('notice-area', NoticeArea);

const press = (target, key, init = {}) => {
    const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, composed: true, ...init});
    target.dispatchEvent(event);
    return event;
};
const release = (target, key, init = {}) => target.dispatchEvent(new KeyboardEvent('keyup', {key, bubbles: true, cancelable: true, composed: true, ...init}));
const deepActive = () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) { active = active.shadowRoot.activeElement; }
    return active;
};
const label = (item) => item.querySelector('.label').textContent;

function editorActions() {
    const run = vi.fn();
    const align = new ActionGroup();
    return {
        run,
        save: new Action({id: 'save', label: '&Save', shortcut: 'Ctrl+S', run}),
        open: new Action({id: 'open', label: '&Open', shortcut: 'Ctrl+O', run}),
        undo: new Action({id: 'undo', label: '&Undo', shortcut: 'Ctrl+Z', run, enabled: false}),
        wrap: new Action({id: 'wrap', label: '&Word wrap', checkable: true, run}),
        left: new Action({id: 'left', label: 'Left', group: align, checked: true, run}),
        right: new Action({id: 'right', label: 'Right', group: align, run}),
    };
}

afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
});

describe('menu data', () => {
    it('reads actions, plain objects, separators, and submenus, and removes extra separators', () => {
        const {save, open} = editorActions();
        const entries = menuEntries([{separator: true}, save, {separator: true}, {separator: true}, {label: 'Recent', items: [open]}, {label: 'Quit', run() {}}, {separator: true}]);
        expect(entries.map(entry => entry.type)).toEqual(['action', 'separator', 'submenu', 'action']);
        expect(entries[3].action).toBeInstanceOf(Action);
        expect(entries[3].action.id).toBe('Quit');
    });

    it('makes one action for each plain object, so that its state stays', () => {
        const item = {label: 'Bold', checkable: true};
        const first = menuEntries([item])[0].action;
        first.trigger();
        expect(menuEntries([item])[0].action).toBe(first);
        expect(first.checked).toBe(true);
    });

    it('finds each action, also in submenus', () => {
        const {save, open, undo} = editorActions();
        expect(menuActions([{label: 'File', items: [save, {label: 'More', items: [open]}]}, undo])).toEqual([save, open, undo]);
    });

    it('reads a mnemonic, and two ampersands as one', () => {
        expect(parseMnemonic('&File')).toEqual({text: 'File', mnemonic: {index: 0, key: 'f'}});
        expect(parseMnemonic('Save && E&xit')).toEqual({text: 'Save & Exit', mnemonic: {index: 8, key: 'x'}});
        expect(parseMnemonic('Plain').mnemonic).toBeNull();
    });
});

function openMenu(items, {shadow = false} = {}) {
    const opener = document.body.appendChild(document.createElement('button'));
    opener.focus();
    const menu = document.body.appendChild(document.createElement(shadow ? 'shadow-popup-menu' : 'popup-menu'));
    menu.items = items;
    menu.open({anchor: opener});
    const root = shadow ? menu.shadowRoot : menu;
    const items_ = () => [...menu.menuElement.children].map(child => (child.classList.contains('entry') ? child.firstElementChild : child)).filter(child => child.classList.contains('item'));
    return {opener, menu, root, items: items_};
}

describe('popup menus', () => {
    it('shows each state of its actions, and the shortcut', () => {
        const a = editorActions();
        const {items} = openMenu([a.save, a.undo, {separator: true}, a.wrap, a.left, a.right]);
        const [save, undo, wrap, left, right] = items();
        expect(label(save)).toBe('Save');
        expect(save.querySelector('u').textContent).toBe('S');
        expect(save.querySelector('.shortcut').textContent).toBe('Ctrl+S');
        expect(save.getAttribute('aria-keyshortcuts')).toBe('Control+S');
        expect(undo.getAttribute('aria-disabled')).toBe('true');
        expect(wrap.getAttribute('role')).toBe('menuitemcheckbox');
        expect(wrap.getAttribute('aria-checked')).toBe('false');
        expect([left.getAttribute('role'), left.getAttribute('aria-checked'), right.getAttribute('aria-checked')]).toEqual(['menuitemradio', 'true', 'false']);
    });

    it('changes an item when its action changes', () => {
        const a = editorActions();
        const {items} = openMenu([a.save, a.undo]);
        a.undo.update({enabled: true, label: 'Undo typing'});
        expect(items()[1].hasAttribute('aria-disabled')).toBe(false);
        expect(label(items()[1])).toBe('Undo typing');
    });

    it('focuses the first item, moves with the arrows, and runs an item with Enter', () => {
        const a = editorActions();
        const {menu, items, opener} = openMenu([a.save, a.open]);
        const selected = vi.fn();
        document.body.addEventListener('popup-menu-select', selected);
        expect(document.activeElement).toBe(items()[0]);
        press(items()[0], 'ArrowDown');
        expect(document.activeElement).toBe(items()[1]);
        press(items()[1], 'Enter');
        expect(a.run).toHaveBeenCalledWith(expect.objectContaining({action: a.open}));
        expect(menu.isOpen).toBe(false);
        expect(document.activeElement).toBe(opener);
        expect(selected.mock.calls[0][0].detail.id).toBe('open');
    });

    it('runs an item with Space on keyup, not keydown', () => {
        const a = editorActions();
        const {items} = openMenu([a.save]);
        press(items()[0], ' ');
        expect(a.run).not.toHaveBeenCalled();
        release(items()[0], ' ');
        expect(a.run).toHaveBeenCalledTimes(1);
    });

    it('does not run a disabled item, and keeps the menu open', () => {
        const a = editorActions();
        const {menu, items} = openMenu([a.undo]);
        items()[0].click();
        expect(a.run).not.toHaveBeenCalled();
        expect(menu.isOpen).toBe(true);
    });

    it('changes a check item and a radio item', () => {
        const a = editorActions();
        const first = openMenu([a.wrap]);
        first.items()[0].click();
        expect(a.wrap.checked).toBe(true);
        const second = openMenu([a.left, a.right]);
        second.items()[1].click();
        expect([a.left.checked, a.right.checked]).toEqual([false, true]);
    });

    it('opens a submenu with the right arrow and closes it with the left arrow', () => {
        const a = editorActions();
        const {items} = openMenu([a.save, {label: 'Recent', items: [a.open]}]);
        const recent = items()[1];
        expect(recent.getAttribute('aria-haspopup')).toBe('menu');
        recent.focus();
        press(recent, 'ArrowRight');
        expect(recent.getAttribute('aria-expanded')).toBe('true');
        const sub = recent._zestSubmenu;
        expect(sub.isOpen).toBe(true);
        expect(label(document.activeElement)).toBe('Open');
        press(document.activeElement, 'ArrowLeft');
        expect(sub.isOpen).toBe(false);
        expect(document.activeElement).toBe(recent);
        expect(recent.getAttribute('aria-expanded')).toBe('false');
    });

    it('closes each menu and runs the action from a submenu', () => {
        const a = editorActions();
        const {menu, items, opener} = openMenu([{label: 'Recent', items: [a.open]}]);
        items()[0].click();
        items()[0]._zestSubmenu.menuElement.querySelector('.item').click();
        expect(a.run).toHaveBeenCalled();
        expect(menu.isOpen).toBe(false);
        expect(document.activeElement).toBe(opener);
    });

    it('closes with Escape, gives the focus back, and stops the key', () => {
        const a = editorActions();
        const {menu, items, opener} = openMenu([a.save]);
        const event = press(items()[0], 'Escape');
        expect(event.defaultPrevented).toBe(true);
        expect(menu.isOpen).toBe(false);
        expect(document.activeElement).toBe(opener);
    });

    it('runs an item with its mnemonic letter', () => {
        const a = editorActions();
        const {items} = openMenu([a.save, a.open]);
        press(items()[0], 'o');
        expect(a.run).toHaveBeenCalledWith(expect.objectContaining({action: a.open}));
    });

    it('closes on a pointer press outside, but not inside', () => {
        const a = editorActions();
        const {menu, items} = openMenu([a.save]);
        items()[0].dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, composed: true}));
        expect(menu.isOpen).toBe(true);
        document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
        expect(menu.isOpen).toBe(false);
    });

    it('works in a shadow root', () => {
        const a = editorActions();
        const {menu, items} = openMenu([a.save], {shadow: true});
        expect(menu.shadowRoot.contains(menu.menuElement)).toBe(true);
        expect(deepActive()).toBe(items()[0]);
        press(items()[0], 'Enter');
        expect(a.run).toHaveBeenCalled();
    });

    it('stops hearing its actions when it disconnects', () => {
        const a = editorActions();
        const remove = vi.spyOn(a.save, 'removeEventListener');
        const {menu} = openMenu([a.save]);
        menu.remove();
        expect(remove).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('needs to be on the page before it opens', () => {
        const menu = document.createElement('popup-menu');
        expect(() => menu.open()).toThrow('must be on the page');
    });
});

function makeBar(a = editorActions(), {shadow = false} = {}) {
    const bar = document.createElement(shadow ? 'shadow-menu-bar' : 'menu-bar');
    bar.items = [
        {label: '&File', items: [a.open, a.save, {separator: true}, {label: 'Recent', items: [{label: 'notes.txt', run: a.run}]}]},
        {label: '&Edit', items: [a.undo]},
        {label: '&View', items: [a.wrap, {separator: true}, a.left, a.right]},
    ];
    document.body.append(bar);
    const tops = () => [...bar.menuBarElement.querySelectorAll('.top')];
    return {a, bar, tops};
}

describe('menu bars', () => {
    it('keeps the focus on the same item when new items come', async () => {
        for (const shadow of [false, true]) {
            const {bar, tops} = makeBar(editorActions(), {shadow});
            tops()[1].focus();
            const before = tops()[1];
            bar.items = [...bar.items];
            await Promise.resolve();
            expect(tops()[1]).not.toBe(before);
            expect((shadow ? bar.shadowRoot : document).activeElement).toBe(tops()[1]);
            expect(tops().map(top => top.tabIndex)).toEqual([-1, 0, -1]);
            bar.remove();
        }
    });

    it('has one item in the tab order, and the left and right arrows move', () => {
        const {bar, tops} = makeBar();
        expect(bar.menuBarElement.getAttribute('role')).toBe('menubar');
        expect(tops().map(top => top.tabIndex)).toEqual([0, -1, -1]);
        tops()[0].focus();
        press(tops()[0], 'ArrowRight');
        expect(document.activeElement).toBe(tops()[1]);
        press(tops()[1], 'ArrowLeft');
        press(tops()[0], 'ArrowLeft');
        expect(document.activeElement).toBe(tops()[2]);
    });

    it('opens a menu with the down arrow, and the right arrow goes to the next menu', () => {
        const {tops} = makeBar();
        tops()[0].focus();
        press(tops()[0], 'ArrowDown');
        expect(tops()[0].getAttribute('aria-expanded')).toBe('true');
        expect(label(document.activeElement)).toBe('Open');
        press(document.activeElement, 'ArrowRight');
        expect(tops()[0].getAttribute('aria-expanded')).toBe('false');
        expect(tops()[1].getAttribute('aria-expanded')).toBe('true');
        expect(label(document.activeElement)).toBe('Undo');
        press(document.activeElement, 'Escape');
        expect(document.activeElement).toBe(tops()[1]);
        expect(tops()[1].getAttribute('aria-expanded')).toBe('false');
    });

    it('opens a submenu with the right arrow, in place of the next menu', () => {
        const {tops} = makeBar();
        tops()[0].focus();
        press(tops()[0], 'ArrowUp');
        expect(label(document.activeElement)).toBe('Recent');
        press(document.activeElement, 'ArrowRight');
        expect(label(document.activeElement)).toBe('notes.txt');
        expect(tops()[0].getAttribute('aria-expanded')).toBe('true');
    });

    it('runs each shortcut in its scope, and F10 and Alt with a letter go to the bar', () => {
        const {a, bar, tops} = makeBar();
        const field = document.body.appendChild(document.createElement('input'));
        const unbind = bar.bindShortcuts(document);
        field.focus();
        press(field, 's', {ctrlKey: true});
        expect(a.run).toHaveBeenCalledWith(expect.objectContaining({action: a.save}));
        press(field, 'F10');
        expect(document.activeElement).toBe(tops()[0]);
        press(document.activeElement, 'Escape');
        expect(document.activeElement).toBe(field);
        press(field, 'v', {altKey: true, code: 'KeyV'});
        expect(tops()[2].getAttribute('aria-expanded')).toBe('true');
        unbind();
        press(document.body, 's', {ctrlKey: true});
        expect(a.run).toHaveBeenCalledTimes(1);
    });

    it('moves to the bar when Alt goes down and up alone', () => {
        const {bar, tops} = makeBar();
        const field = document.body.appendChild(document.createElement('input'));
        bar.bindShortcuts(document);
        field.focus();
        press(field, 'Alt', {altKey: true});
        release(field, 'Alt');
        expect(document.activeElement).toBe(tops()[0]);
        press(document.activeElement, 'Alt', {altKey: true});
        release(document.activeElement, 'Alt');
        expect(document.activeElement).toBe(field);
    });

    it('binds the shortcuts of the shortcuts-for attribute, and removes them when it disconnects', () => {
        const a = editorActions();
        const scope = document.body.appendChild(document.createElement('div'));
        scope.id = 'editor';
        const bar = document.createElement('menu-bar');
        bar.setAttribute('shortcuts-for', 'editor');
        bar.items = [{label: 'File', items: [a.save]}];
        scope.append(bar);
        press(scope, 's', {ctrlKey: true});
        expect(a.run).toHaveBeenCalledTimes(1);
        bar.remove();
        press(scope, 's', {ctrlKey: true});
        expect(a.run).toHaveBeenCalledTimes(1);
    });

    it('works in a shadow root', () => {
        const {tops} = makeBar(editorActions(), {shadow: true});
        tops()[0].focus();
        press(tops()[0], 'Enter');
        expect(label(deepActive())).toBe('Open');
    });
});

describe('menu buttons', () => {
    it('opens with the down arrow, focuses the last item with the up arrow, and sends the selection', () => {
        const a = editorActions();
        const button = document.createElement('menu-button');
        button.label = 'Options';
        button.items = [a.save, a.open];
        document.body.append(button);
        const toggle = button.querySelector('.toggle');
        expect(toggle.getAttribute('aria-haspopup')).toBe('menu');
        const selected = vi.fn();
        button.addEventListener('menu-button-select', selected);
        press(toggle, 'ArrowUp');
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(label(document.activeElement)).toBe('Open');
        press(document.activeElement, 'Enter');
        expect(selected.mock.calls[0][0].detail.id).toBe('open');
        expect(document.activeElement).toBe(toggle);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });

    it('runs the default action from the main part of a split button', () => {
        const a = editorActions();
        const button = document.createElement('menu-button');
        button.split = true;
        button.items = [a.save, a.open];
        document.body.append(button);
        button.querySelector('.main').click();
        expect(a.run).toHaveBeenCalledWith(expect.objectContaining({action: a.save}));
        expect(button.querySelector('.toggle').getAttribute('aria-label')).toBe('More options');
    });
});

describe('toolbars', () => {
    function makeToolBar(a = editorActions(), tag = 'tool-bar') {
        const toolbar = document.createElement(tag);
        toolbar.label = 'Format';
        toolbar.items = [a.save, a.undo, {separator: true}, a.wrap, {label: 'Align', items: [a.left, a.right]}];
        document.body.append(toolbar);
        const root = toolbar.shadowRoot ?? toolbar;
        return {a, toolbar, buttons: () => [...root.querySelectorAll('button.tool')]};
    }

    it('shows a button for each action, with its states', () => {
        const {toolbar, buttons, a} = makeToolBar();
        expect(toolbar.toolBarElement.getAttribute('role')).toBe('toolbar');
        expect(toolbar.toolBarElement.getAttribute('aria-label')).toBe('Format');
        const [save, undo, wrap, align] = buttons();
        expect(save.textContent).toBe('Save');
        expect(undo.getAttribute('aria-disabled')).toBe('true');
        expect(wrap.getAttribute('aria-pressed')).toBe('false');
        expect(align.getAttribute('aria-haspopup')).toBe('menu');
        a.wrap.trigger();
        expect(wrap.getAttribute('aria-pressed')).toBe('true');
        a.undo.enabled = true;
        expect(undo.hasAttribute('aria-disabled')).toBe(false);
    });

    it('runs an action with a click, but not a disabled one', () => {
        const {buttons, a} = makeToolBar();
        buttons()[0].click();
        buttons()[1].click();
        expect(a.run).toHaveBeenCalledTimes(1);
    });

    it('moves with the arrow keys, and opens a menu of the toolbar with the down arrow', () => {
        const {buttons} = makeToolBar();
        buttons()[0].focus();
        press(buttons()[0], 'End');
        expect(document.activeElement.classList.contains('more')).toBe(false);
        expect(document.activeElement).toBe(buttons()[3]);
        press(buttons()[3], 'ArrowDown');
        expect(label(document.activeElement)).toBe('Left');
    });

    it('gives a tooltip to a button with a shortcut, and removes it when it disconnects', () => {
        const {toolbar, buttons} = makeToolBar();
        const save = buttons()[0];
        const tip = document.getElementById(save.getAttribute('aria-describedby'));
        expect(tip.getAttribute('role')).toBe('tooltip');
        expect(tip.textContent).toBe('Save (Ctrl+S)');
        toolbar.remove();
        expect(tip.isConnected).toBe(false);
    });

    it('puts its tooltips in its shadow root', () => {
        const {toolbar, buttons} = makeToolBar(editorActions(), 'shadow-tool-bar');
        const save = buttons()[0];
        expect(toolbar.shadowRoot.getElementById(save.getAttribute('aria-describedby'))).not.toBeNull();
    });
});

describe('tooltips', () => {
    it('shows on focus, hides with Escape, and the key does nothing else', () => {
        const button = document.body.appendChild(document.createElement('button'));
        const remove = attachToolTip(button, 'Bold text');
        const tip = document.getElementById(button.getAttribute('aria-describedby'));
        button.focus();
        expect(tip.isShown).toBe(true);
        const event = press(button, 'Escape');
        expect(event.defaultPrevented).toBe(true);
        expect(tip.isShown).toBe(false);
        remove();
        expect(button.hasAttribute('aria-describedby')).toBe(false);
        expect(tip.isConnected).toBe(false);
    });

    it('shows after a delay on hover, and stays while the pointer is on it', () => {
        vi.useFakeTimers();
        const button = document.body.appendChild(document.createElement('button'));
        attachToolTip(button, () => 'From a function', {delay: 300});
        const tip = document.getElementById(button.getAttribute('aria-describedby'));
        button.dispatchEvent(new PointerEvent('pointerenter', {pointerType: 'mouse'}));
        vi.advanceTimersByTime(200);
        expect(tip.isShown).toBe(false);
        vi.advanceTimersByTime(200);
        expect(tip.isShown).toBe(true);
        button.dispatchEvent(new PointerEvent('pointerleave'));
        tip.dispatchEvent(new PointerEvent('pointerenter'));
        vi.advanceTimersByTime(1000);
        expect(tip.isShown).toBe(true);
        tip.dispatchEvent(new PointerEvent('pointerleave'));
        vi.advanceTimersByTime(200);
        expect(tip.isShown).toBe(false);
    });

    it('works from markup with the for attribute', () => {
        document.body.innerHTML = '<button id="b">B</button><tool-tip for="b">Bold</tool-tip>';
        expect(document.getElementById('b').getAttribute('aria-describedby')).toBe(document.querySelector('tool-tip').id);
    });
});

describe('notices', () => {
    it('puts a notice in the polite region, and an error in the alert region, after the regions exist', () => {
        vi.useFakeTimers();
        const first = showNotice({text: 'Saved', kind: 'success'});
        const error = showNotice({text: 'The disk is full', kind: 'error'});
        expect(first.element.isConnected).toBe(false);
        vi.advanceTimersByTime(150);
        expect(first.element.closest('[role="status"]')).not.toBeNull();
        expect(error.element.closest('[role="alert"]')).not.toBeNull();
        expect(error.element.textContent).toContain('Error: The disk is full');
    });

    it('closes after its time, but not while the pointer is on it, and an error stays', async () => {
        vi.useFakeTimers();
        const area = document.body.appendChild(document.createElement('notice-area'));
        vi.advanceTimersByTime(150);
        const notice = area.add({text: 'Copied', timeout: 1000});
        const error = area.add({text: 'Failed', kind: 'error'});
        notice.element.dispatchEvent(new PointerEvent('pointerenter'));
        vi.advanceTimersByTime(5000);
        expect(notice.element.isConnected).toBe(true);
        notice.element.dispatchEvent(new PointerEvent('pointerleave'));
        vi.advanceTimersByTime(1000);
        expect(notice.element.isConnected).toBe(false);
        expect(await notice.closed).toBe('timeout');
        vi.advanceTimersByTime(60000);
        expect(error.element.isConnected).toBe(true);
    });

    it('runs its action, and the dismiss button closes it', async () => {
        vi.useFakeTimers();
        const area = document.body.appendChild(document.createElement('notice-area'));
        vi.advanceTimersByTime(150);
        const run = vi.fn();
        const notice = area.add({text: 'Deleted', action: {label: 'Undo', run}});
        notice.element.querySelector('.action').click();
        expect(run).toHaveBeenCalled();
        expect(await notice.closed).toBe('action');
        const other = area.add({text: 'Other'});
        expect(other.element.querySelector('.dismiss').getAttribute('aria-label')).toBe('Dismiss');
        other.element.querySelector('.dismiss').click();
        expect(await other.closed).toBe('dismiss');
    });

    it('keeps only the newest notices', () => {
        vi.useFakeTimers();
        const area = document.body.appendChild(document.createElement('notice-area'));
        vi.advanceTimersByTime(150);
        area.max = 2;
        for (const text of ['a', 'b', 'c']) { area.add({text}); }
        expect(area.notices.map(notice => notice.textContent.replace('✕', ''))).toEqual(['b', 'c']);
    });
});

describe('context menus', () => {
    it('opens at the pointer, and gives the event to a function of items', () => {
        const a = editorActions();
        const box = document.body.appendChild(document.createElement('div'));
        const items = vi.fn(() => [a.save]);
        const remove = attachContextMenu(box, items);
        const event = new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: 30, clientY: 40});
        box.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(items).toHaveBeenCalledWith(event);
        const menu = document.querySelector('popup-menu');
        expect(menu.isOpen).toBe(true);
        expect(menu.menuElement.style.left).toBe('30px');
        remove();
        expect(menu.isConnected).toBe(false);
    });

    it('opens with Shift+F10 and the context menu key, and gives the focus back', () => {
        const a = editorActions();
        const box = document.body.appendChild(document.createElement('div'));
        box.tabIndex = 0;
        attachContextMenu(box, [a.save]);
        box.focus();
        press(box, 'F10', {shiftKey: true});
        const menu = document.querySelector('popup-menu');
        expect(menu.isOpen).toBe(true);
        // The browser can send its own event after the key. It must not open a second time.
        box.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}));
        press(document.activeElement, 'Escape');
        expect(document.activeElement).toBe(box);
        press(box, 'ContextMenu');
        expect(menu.isOpen).toBe(true);
    });

    it('does nothing with no items, so the browser menu shows', () => {
        const box = document.body.appendChild(document.createElement('div'));
        attachContextMenu(box, () => []);
        const event = new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
        box.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
    });
});
