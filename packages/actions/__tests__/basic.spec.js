import { describe, it, expect, vi } from 'vitest';
import { Action, ActionGroup, ShortcutMap, actionsFrom, ariaShortcut, formatShortcut, matchesShortcut, parseShortcut } from '../src';

const key = (init) => new KeyboardEvent('keydown', {bubbles: true, cancelable: true, ...init});

describe('shortcuts', () => {
    it('reads Mod as Command on a Mac and as Ctrl on other systems', () => {
        expect(parseShortcut('Mod+Shift+Z', {mac: false})).toEqual({ctrl: true, alt: false, shift: true, meta: false, key: 'z'});
        expect(parseShortcut('mod+s', {mac: true})).toEqual({ctrl: false, alt: false, shift: false, meta: true, key: 's'});
        expect(parseShortcut('Ctrl++', {mac: false}).key).toBe('+');
        expect(parseShortcut('Alt+Down').key).toBe('arrowdown');
    });

    it('refuses a shortcut with no key or with two keys', () => {
        expect(() => parseShortcut('Ctrl+Shift')).toThrow('needs a key');
        expect(() => parseShortcut('Ctrl+A+B')).toThrow('one key');
    });

    it('matches the key and each modifier', () => {
        expect(matchesShortcut(key({key: 's', ctrlKey: true}), 'Ctrl+S')).toBe(true);
        expect(matchesShortcut(key({key: 'S', ctrlKey: true, shiftKey: true}), 'Ctrl+S')).toBe(false);
        expect(matchesShortcut(key({key: 'S', ctrlKey: true, shiftKey: true}), 'Ctrl+Shift+S')).toBe(true);
        expect(matchesShortcut(key({key: 'F2'}), 'F2')).toBe(true);
        expect(matchesShortcut(key({key: '?', shiftKey: true}), '?')).toBe(true);
    });

    it('uses the key code for a letter on a layout that is not Latin', () => {
        expect(matchesShortcut(key({key: 'ы', code: 'KeyS', ctrlKey: true}), 'Ctrl+S')).toBe(true);
        expect(matchesShortcut(key({key: '!', code: 'Digit1', ctrlKey: true, shiftKey: true}), 'Ctrl+Shift+1')).toBe(true);
    });

    it('writes a shortcut for a menu and for aria-keyshortcuts', () => {
        expect(formatShortcut('Mod+Shift+Z', {mac: true})).toBe('⇧⌘Z');
        expect(formatShortcut('Mod+Shift+Z', {mac: false})).toBe('Ctrl+Shift+Z');
        expect(formatShortcut('Alt+ArrowDown', {mac: false})).toBe('Alt+↓');
        expect(ariaShortcut('Mod+Shift+ArrowDown', {mac: false})).toBe('Control+Shift+ArrowDown');
        expect(ariaShortcut('F2')).toBe('F2');
    });
});

describe('actions', () => {
    it('runs when it is enabled, and sends trigger before it runs', () => {
        const run = vi.fn();
        const action = new Action({id: 'save', run});
        const heard = vi.fn();
        action.addEventListener('trigger', heard);
        expect(action.trigger('menu')).toBe(true);
        expect(heard).toHaveBeenCalled();
        expect(run).toHaveBeenCalledWith(expect.objectContaining({action, source: 'menu'}));
        action.enabled = false;
        expect(action.trigger()).toBe(false);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('does not run when a trigger listener cancels it', () => {
        const run = vi.fn();
        const action = new Action({id: 'delete', run});
        action.addEventListener('trigger', e => e.preventDefault());
        expect(action.trigger()).toBe(false);
        expect(run).not.toHaveBeenCalled();
    });

    it('sends one change event for each real change', () => {
        const action = new Action({id: 'bold', checkable: true});
        const changes = [];
        action.addEventListener('change', e => changes.push(e.detail.changed));
        action.update({label: 'Bold', enabled: true});
        action.enabled = true;
        action.trigger();
        expect(changes).toEqual([['label'], ['checked']]);
        expect(action.checked).toBe(true);
    });

    it('keeps one checked action in a group', () => {
        const group = new ActionGroup();
        const [left, center] = ['left', 'center'].map(id => new Action({id, group}));
        left.trigger();
        expect(group.checked).toBe(left);
        center.trigger();
        expect([left.checked, center.checked]).toEqual([false, true]);
        center.trigger();
        expect(center.checked).toBe(true);
    });

    it('needs an id, and makes actions from plain objects', () => {
        expect(() => new Action({})).toThrow('needs an id');
        const {save} = actionsFrom({save: {label: 'Save', shortcut: 'Mod+S'}});
        expect(save).toBeInstanceOf(Action);
        expect(save.id).toBe('save');
    });
});

describe('shortcut maps', () => {
    it('runs the action of a key in its element, and stops the key', () => {
        const run = vi.fn();
        const element = document.body.appendChild(document.createElement('div'));
        const map = new ShortcutMap([new Action({id: 'save', shortcut: 'Ctrl+S', run})], {mac: false});
        const detach = map.attach(element);
        const parent = vi.fn();
        document.body.addEventListener('keydown', parent);
        const event = key({key: 's', ctrlKey: true});
        element.dispatchEvent(event);
        expect(run).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
        expect(parent).not.toHaveBeenCalled();
        detach();
        element.dispatchEvent(key({key: 's', ctrlKey: true}));
        expect(run).toHaveBeenCalledTimes(1);
        document.body.removeEventListener('keydown', parent);
    });

    it('lets a child map win over a parent map', () => {
        const parentRun = vi.fn();
        const childRun = vi.fn();
        const parent = document.body.appendChild(document.createElement('div'));
        const child = parent.appendChild(document.createElement('div'));
        new ShortcutMap([new Action({id: 'a', shortcut: 'Delete', run: parentRun})]).attach(parent);
        new ShortcutMap([new Action({id: 'b', shortcut: 'Delete', run: childRun})]).attach(child);
        child.dispatchEvent(key({key: 'Delete'}));
        expect(childRun).toHaveBeenCalled();
        expect(parentRun).not.toHaveBeenCalled();
    });

    it('does not take a plain key while the user types in a field, but takes Ctrl and F keys', () => {
        const run = vi.fn();
        const input = document.body.appendChild(document.createElement('input'));
        const map = new ShortcutMap([
            new Action({id: 'a', shortcut: 'Delete', run}),
            new Action({id: 'b', shortcut: 'Ctrl+B', run}),
            new Action({id: 'c', shortcut: 'F2', run}),
        ], {mac: false});
        map.attach(document.body);
        input.dispatchEvent(key({key: 'Delete'}));
        expect(run).not.toHaveBeenCalled();
        input.dispatchEvent(key({key: 'b', ctrlKey: true}));
        input.dispatchEvent(key({key: 'F2'}));
        expect(run).toHaveBeenCalledTimes(2);
    });

    it('stops the key of a disabled action, but does not run it', () => {
        const run = vi.fn();
        const action = new Action({id: 'save', shortcut: 'Ctrl+S', run, enabled: false});
        const map = new ShortcutMap([action], {mac: false});
        const event = key({key: 's', ctrlKey: true});
        expect(map.handle(event)).toBe(true);
        expect(event.defaultPrevented).toBe(true);
        expect(run).not.toHaveBeenCalled();
    });
});
