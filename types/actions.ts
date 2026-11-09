// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { Action, ActionGroup, ShortcutMap, actionsFrom, ariaShortcut, formatShortcut, parseShortcut } from '@catalystcommunity/actions';
import { BaseComponent } from '@catalystcommunity/base-components';

const save = new Action({id: 'save', label: 'Save', shortcut: 'Mod+S', run: ({source}) => { void source; }});
const align = new ActionGroup();
const left = new Action({id: 'left', group: align});
const right = new Action({id: 'right', group: align});
const actions = actionsFrom({undo: {label: 'Undo', shortcut: 'Mod+Z'}, save});

save.addEventListener('change', (e) => { const names: string[] = e.detail.changed; void names; });
save.addEventListener('trigger', (e) => { if (e.detail.source === null) { e.preventDefault(); } });
save.update({enabled: false, label: 'Save as'});
const ran: boolean = right.trigger();

const shortcuts = new ShortcutMap([save, actions.undo], {ignoreInFields: false});
class MyEditor extends BaseComponent {
    connectedCallback(): void {
        super.connectedCallback();
        this.own(shortcuts.attach(this));
    }
}
customElements.define('my-editor', MyEditor);

const parsed = parseShortcut('Mod+Shift+Z', {mac: true});
const text: string = formatShortcut('Mod+Shift+Z');
const aria: string = ariaShortcut(parsed);
void [left, ran, text, aria, align.checked?.id];
