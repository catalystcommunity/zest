// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { askConfirm, askText, containerTags, defineContainers, showMessage, type DialogCloseReason } from '@catalystcommunity/containers';

defineContainers(containerTags);

const dialog = document.createElement('dialog-window');
dialog.label = 'Save changes?';
dialog.kind = 'question';
const save = document.createElement('button');
save.slot = 'buttons';
save.value = 'save';
save.dataset.default = '';
dialog.append(save);
document.body.append(dialog);

dialog.addEventListener('dialog-window-before-close', async (e) => {
    const reason: DialogCloseReason = e.detail.reason;
    if (e.detail.value !== 'save' || reason !== 'button') { return; }
    e.preventDefault();
    dialog.close('save');
});
dialog.addEventListener('dialog-window-close', (e) => { const value: string = e.detail.value; void value; });

async function run(): Promise<void> {
    const result: string = await dialog.showModal();
    const closed: boolean = dialog.requestClose('cancel', {reason: 'code'});
    const choice: string = await showMessage({title: 'Done', text: 'Saved.', buttons: ['OK', {label: 'Undo', value: 'undo', danger: true}]});
    const remove: boolean = await askConfirm({title: 'Delete?', okLabel: 'Delete', kind: 'warning', danger: true});
    const name: string | null = await askText({title: 'Rename', label: 'Name', required: true});
    void [result, closed, choice, remove, name];
}
void run();

const tabs = document.createElement('tab-view');
tabs.addEventListener('tab-view-close', (e) => { if (e.detail.page.label === 'Main') { e.preventDefault(); } });
tabs.select(0);

const split = document.createElement('split-view');
split.sizes = [1, 2];
split.addEventListener('split-view-resize', (e) => { const sizes: number[] = e.detail.sizes; void sizes; });

const area = document.createElement('window-area');
const win = document.createElement('floating-window');
area.append(win);
win.setGeometry({x: 10, width: 400});
area.addEventListener('window-area-activate', (e) => { const label: string = e.detail.window.label; void label; });
area.tile();
