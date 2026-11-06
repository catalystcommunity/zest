import { RovingFocus, tokenAliases } from "@catalystcommunity/base-components";
import { ShadowContainer, focusRing, uid } from "./shared.js";

// One page of a tab view. Its label is the text of its tab.
export class TabPage extends ShadowContainer {
    static properties = {
        label: {type: String, default: ''},
        closable: {type: Boolean},
        disabled: {type: Boolean, reflect: true},
    };
    static styles = `
:host {
    ${tokenAliases('tab-view')}
    display: block;
    min-width: 0;
}
:host([hidden]) {
    display: none;
}
:host(:focus-visible) {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
}
`;

    connected() {
        if (!this.hasAttribute('role')) { this.setAttribute('role', 'tabpanel'); }
        // A panel with no control in it still gets the focus, so that a keyboard user can read it
        if (!this.hasAttribute('tabindex')) { this.tabIndex = 0; }
    }
    render() {
        // The tab is in the shadow root of the tab view, so aria-labelledby cannot reach it
        this.setAttribute('aria-label', this.label);
    }
    propertyChanged() {
        this.parentElement?.pagesChanged?.();
    }
}

const ORIENTATION = {top: 'horizontal', bottom: 'horizontal', start: 'vertical', end: 'vertical'};

// Tabs that show one page at a time. The pages are the tab-page children.
export class TabView extends ShadowContainer {
    static properties = {
        selected: {type: Number, default: 0},
        placement: {type: String, default: 'top'},
        activation: {type: String, default: 'automatic'},
        label: {type: String, default: ''},
        labels: {type: Object, attribute: false},
    };
    static labels = {closeHint: 'Press Delete to close'};
    static shadowHtml = `
<div class="view" part="view">
  <div class="strip" part="strip"><div role="tablist" part="tablist"></div></div>
  <div class="pages" part="pages"><slot></slot></div>
</div>`;
    static styles = `
:host {
    display: block;
    min-width: 0;
}
:host([hidden]) {
    display: none;
}
.view {
    ${tokenAliases('tab-view')}
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
}
.view[data-placement="bottom"] {
    flex-direction: column-reverse;
}
.view[data-placement="start"] {
    flex-direction: row;
}
.view[data-placement="end"] {
    flex-direction: row-reverse;
}
.strip {
    position: relative;
    flex: none;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
}
.view[data-placement="start"] .strip, .view[data-placement="end"] .strip {
    overflow-x: hidden;
    overflow-y: auto;
    max-width: 40%;
}
[role="tablist"] {
    display: flex;
    gap: 2px;
    width: max-content;
    min-width: 100%;
    box-sizing: border-box;
}
[aria-orientation="vertical"] {
    flex-direction: column;
    width: auto;
    min-width: 0;
}
[role="tab"] {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    min-height: var(--_height);
    margin: 0;
    padding: var(--_padding-block) var(--_padding-inline);
    font: inherit;
    white-space: nowrap;
    color: var(--_face-text);
    background-color: var(--_face);
    background-image: var(--_fill);
    border: var(--_border-width) solid var(--_line);
    border-radius: var(--_radius) var(--_radius) 0 0;
    cursor: pointer;
    transition: background-color var(--_motion);
}
[role="tab"]:hover {
    background-image: none;
    background-color: var(--_hover-face);
}
/* The selected tab is bold and has a bar, so that color is not the only sign */
[role="tab"][aria-selected="true"] {
    font-weight: bold;
    color: var(--_window-text);
    background: var(--_window);
    box-shadow: inset 0 -3px 0 var(--_highlight);
}
.view[data-placement="bottom"] [role="tab"] {
    border-radius: 0 0 var(--_radius) var(--_radius);
}
.view[data-placement="bottom"] [role="tab"][aria-selected="true"] {
    box-shadow: inset 0 3px 0 var(--_highlight);
}
.view[data-placement="start"] [role="tab"], .view[data-placement="end"] [role="tab"] {
    justify-content: space-between;
    border-radius: var(--_radius);
}
.view[data-placement="start"] [role="tab"][aria-selected="true"] {
    box-shadow: inset -3px 0 0 var(--_highlight);
}
.view[data-placement="end"] [role="tab"][aria-selected="true"] {
    box-shadow: inset 3px 0 0 var(--_highlight);
}
[role="tab"][aria-disabled="true"] {
    color: var(--_disabled-text);
    cursor: default;
    text-decoration: line-through;
}
.close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    min-height: 24px;
    margin-inline-end: -0.5em;
    border-radius: var(--_radius);
    font-weight: normal;
}
.close:hover {
    background: var(--_hover-face);
    outline: var(--_border-width) solid var(--_border);
}
.close[hidden] {
    display: none;
}
.pages {
    flex: 1;
    min-width: 0;
    min-height: 0;
    padding: var(--_gap);
    background: var(--_window);
    color: var(--_window-text);
    border: var(--_border-width) solid var(--_line);
}
${focusRing}
`;
    #tablist;
    #tabs = new WeakMap();
    #focus = null;
    #orientation = null;
    #detach = null;
    #focusSelected = false;

    get pages() {
        return [...this.children].filter(child => child instanceof TabPage);
    }
    get selectedPage() {
        return this.pages[this.selected] ?? null;
    }
    // Called by a page when its label or state changes
    pagesChanged() {
        this.invalidate();
    }
    // Selects a page by its index, its id, or the element. A change from code sends no event.
    select(target) {
        const index = this.#indexOf(target);
        if (index >= 0) { this.selected = index; }
    }
    // Closes a page, as if the user closed it, but sends no event
    closePage(target) {
        const index = this.#indexOf(target);
        if (index >= 0) { this.#remove(index); }
    }

    #indexOf(target) {
        const pages = this.pages;
        if (typeof target === 'number') { return target < pages.length ? target : -1; }
        if (typeof target === 'string') { return pages.findIndex(page => page.id === target); }
        return pages.indexOf(target);
    }

    built() {
        this.#tablist = this.part('[role="tablist"]');
        this.part('slot').addEventListener('slotchange', () => this.invalidate());
        this.#tablist.addEventListener('click', (e) => {
            const tab = e.target.closest('[role="tab"]');
            if (!tab) { return; }
            const index = [...this.#tablist.children].indexOf(tab);
            if (e.target.closest('.close')) {
                this.#userClose(index);
            } else {
                this.#userSelect(index);
            }
        });
        this.#tablist.addEventListener('keydown', (e) => {
            const tab = e.target.closest('[role="tab"]');
            if (!tab || e.key !== 'Delete') { return; }
            const index = [...this.#tablist.children].indexOf(tab);
            if (this.#isClosable(this.pages[index])) {
                e.preventDefault();
                this.#userClose(index);
            }
        });
    }

    connected() {
        // A reconnect must listen again, so the focus group is made again
        this.#orientation = null;
    }

    #isClosable(page) {
        return Boolean(page) && (page.closable || this.hasAttribute('closable')) && !page.disabled;
    }

    #userSelect(index) {
        const page = this.pages[index];
        if (!page || page.disabled || index === this.selected) { return; }
        this.selected = index;
        this.emit('tab-view-select', {index, id: page.id, label: page.label, page});
    }

    #userClose(index) {
        const page = this.pages[index];
        if (!this.#isClosable(page)) { return; }
        if (!this.emit('tab-view-close', {index, id: page.id, label: page.label, page}, {cancelable: true})) { return; }
        const wasSelected = index === this.selected;
        this.#remove(index);
        this.#focusSelected = true;
        const now = this.selectedPage;
        if (wasSelected && now) {
            this.emit('tab-view-select', {index: this.selected, id: now.id, label: now.label, page: now});
        }
    }

    #remove(index) {
        const pages = this.pages;
        if (index < this.selected || (index === this.selected && index === pages.length - 1)) {
            this.selected = Math.max(0, this.selected - 1);
        }
        pages[index].remove();
        this.invalidate();
    }

    #tabOf(page) {
        let tab = this.#tabs.get(page);
        if (!tab) {
            tab = document.createElement('button');
            tab.type = 'button';
            tab.setAttribute('role', 'tab');
            tab.id = uid('tab');
            tab.setAttribute('part', 'tab');
            tab.innerHTML = '<span class="label"></span><span class="close" aria-hidden="true" hidden>×</span>';
            this.#tabs.set(page, tab);
        }
        return tab;
    }

    #ensureFocusGroup(orientation) {
        if (this.#orientation === orientation) { return; }
        this.#detach?.();
        this.#orientation = orientation;
        this.#focus = new RovingFocus(this.#tablist, {
            items: () => [...this.#tablist.children],
            orientation,
            onMove: (tab) => {
                if (this.activation !== 'manual') { this.#userSelect([...this.#tablist.children].indexOf(tab)); }
            },
        });
        this.#detach = this.own(this.#focus.attach());
    }

    render() {
        const pages = this.pages;
        if (pages.length && this.selected >= pages.length) { this.selected = pages.length - 1; }
        const selected = Math.max(0, Math.min(this.selected, pages.length - 1));
        const placement = ORIENTATION[this.placement] ? this.placement : 'top';
        const orientation = ORIENTATION[placement];
        this.part('.view').dataset.placement = placement;
        this.#tablist.setAttribute('aria-orientation', orientation);
        if (this.label) { this.#tablist.setAttribute('aria-label', this.label); } else { this.#tablist.removeAttribute('aria-label'); }

        const tabs = pages.map(page => this.#tabOf(page));
        const current = [...this.#tablist.children];
        if (tabs.length !== current.length || tabs.some((tab, i) => tab !== current[i])) {
            // Moving a tab that has the focus would lose the focus, so only the tabs that changed move
            const hadFocus = this.root.activeElement;
            this.#tablist.replaceChildren(...tabs);
            if (hadFocus && tabs.includes(hadFocus)) { hadFocus.focus({preventScroll: true}); }
        }
        pages.forEach((page, i) => {
            const tab = tabs[i];
            tab.querySelector('.label').textContent = page.label || `${i + 1}`;
            tab.setAttribute('aria-selected', String(i === selected));
            if (page.disabled) { tab.setAttribute('aria-disabled', 'true'); } else { tab.removeAttribute('aria-disabled'); }
            const closable = this.#isClosable(page);
            tab.querySelector('.close').hidden = !closable;
            if (closable) {
                tab.setAttribute('aria-keyshortcuts', 'Delete');
                tab.setAttribute('aria-description', this.text('closeHint'));
            } else {
                tab.removeAttribute('aria-keyshortcuts');
                tab.removeAttribute('aria-description');
            }
            page.hidden = i !== selected;
        });

        this.#ensureFocusGroup(orientation);
        const focusInTabs = tabs.includes(this.root.activeElement);
        const selectedTab = tabs[selected] ?? null;
        // With manual activation, the focus can be on a tab that is not selected
        this.#focus.update(focusInTabs && this.activation === 'manual' ? this.root.activeElement : selectedTab);
        if (this.#focusSelected) {
            this.#focusSelected = false;
            selectedTab?.focus();
        }
        if (selectedTab) { this.#reveal(selectedTab, orientation); }
    }

    // Scrolls the tab strip, and not the page, so that the selected tab shows
    #reveal(tab, orientation) {
        const strip = this.part('.strip');
        if (orientation === 'horizontal') {
            if (tab.offsetLeft < strip.scrollLeft) { strip.scrollLeft = tab.offsetLeft; }
            else if (tab.offsetLeft + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) { strip.scrollLeft = tab.offsetLeft + tab.offsetWidth - strip.clientWidth; }
        } else {
            if (tab.offsetTop < strip.scrollTop) { strip.scrollTop = tab.offsetTop; }
            else if (tab.offsetTop + tab.offsetHeight > strip.scrollTop + strip.clientHeight) { strip.scrollTop = tab.offsetTop + tab.offsetHeight - strip.clientHeight; }
        }
    }
}
