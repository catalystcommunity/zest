import { isRenderScheduled, isRtl, tokenAliases } from "@catalystcommunity/base-components";
import { ShadowContainer, clamp } from "./shared.js";

const MAX_PANES = 16;
const DEFAULT_MIN = 32;
const STEP = 10;
const BIG_STEP = 50;

// The panes are the children of the application, in one slot. The order property puts a divider
// between each two panes. The rules are the same for each instance, so all instances share one sheet.
const paneOrder = Array.from({length: MAX_PANES}, (_, i) => `::slotted(:nth-child(${i + 1})) { order: ${i * 2}; }`).join('\n');

// Two or more panes with a divider between each two. The user drags a divider, or uses the arrow
// keys on it, to change the sizes. Enter on a divider collapses the pane before it.
export class SplitView extends ShadowContainer {
    static renderTiming = 'frame';
    static properties = {
        orientation: {type: String, default: 'horizontal'},
        // Relative sizes, as for fr units. After the user moves a divider, these are the sizes in CSS pixels.
        sizes: {type: Array, default: () => []},
        labels: {type: Object, attribute: false},
    };
    static labels = {resize: 'Resize {pane}', pane: 'pane {number}'};
    static shadowHtml = `<div class="zest-split" part="split"><slot></slot></div>`;
    static styles = `
:host {
    display: grid;
    min-width: 0;
    min-height: 0;
}
:host([hidden]) {
    display: none;
}
:host([orientation="vertical"]) {
    min-height: var(--zest-split-view-min-height, 16em);
}
.zest-split {
    ${tokenAliases('split-view')}
    --_divider: var(--zest-split-view-divider-size, 0.5em);
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
}
.zest-split[data-orientation="vertical"] {
    grid-auto-flow: row;
    grid-template-columns: minmax(0, 1fr);
}
::slotted(*) {
    min-width: 0;
    min-height: 0;
    overflow: auto;
    box-sizing: border-box;
}
${paneOrder}
/* A collapsed pane has no size, also when the application gives it padding or a border */
::slotted([data-collapsed]) {
    padding: 0 !important;
    border: none !important;
    overflow: hidden !important;
}
.zest-divider {
    position: relative;
    z-index: 1;
    box-sizing: border-box;
    /* The track is narrow. The negative margin gives a target of 24 CSS pixels. */
    min-width: 24px;
    margin-inline: calc((24px - var(--_divider)) / -2);
    cursor: col-resize;
    touch-action: none;
    outline: none;
}
.zest-split[data-orientation="vertical"] .zest-divider {
    min-width: 0;
    min-height: 24px;
    margin-inline: 0;
    margin-block: calc((24px - var(--_divider)) / -2);
    cursor: row-resize;
}
.zest-divider::after {
    content: "";
    position: absolute;
    inset-block: 0;
    inset-inline-start: 50%;
    width: var(--_divider);
    transform: translateX(-50%);
    background: var(--_face);
    border-inline: var(--_border-width) solid var(--_line);
    box-sizing: border-box;
    transition: background-color var(--_motion);
}
.zest-split[data-orientation="vertical"] .zest-divider::after {
    inset-inline: 0;
    inset-block-start: 50%;
    width: auto;
    height: var(--_divider);
    transform: translateY(-50%);
    border-inline: none;
    border-block: var(--_border-width) solid var(--_line);
}
.zest-divider:hover::after, .zest-divider.zest-dragging::after {
    background: var(--_highlight);
}
.zest-divider:focus-visible::after {
    background: var(--_highlight);
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
.zest-divider.zest-collapsed::after {
    background-image: repeating-linear-gradient(45deg, transparent 0 3px, var(--_border) 3px 4px);
}
`;
    #split;
    #collapsed = new Set();
    #restore = new Map();
    #drag = null;

    get panes() {
        return this.shadowPart('slot')?.assignedElements() ?? [];
    }
    get collapsedPanes() {
        return [...this.#collapsed].sort((a, b) => a - b);
    }

    collapse(index) {
        if (this.#collapsed.has(index) || !this.panes[index]) { return; }
        this.#restore.set(index, this.#weights()[index]);
        this.#collapsed.add(index);
        this.invalidate();
    }
    expand(index) {
        if (!this.#collapsed.delete(index)) { return; }
        const sizes = this.#weights();
        sizes[index] = this.#restore.get(index) ?? 1;
        this.sizes = sizes;
        this.invalidate();
    }
    toggle(index) {
        if (this.#collapsed.has(index)) { this.expand(index); } else { this.collapse(index); }
    }

    built() {
        this.#split = this.shadowPart('.zest-split');
        this.shadowPart('slot').addEventListener('slotchange', () => this.invalidate());
        this.#split.addEventListener('pointerdown', (e) => this.#onPointerDown(e));
        this.#split.addEventListener('keydown', (e) => this.#onKeydown(e));
    }

    #vertical() {
        return this.orientation === 'vertical';
    }
    #weights() {
        const count = this.panes.length;
        return Array.from({length: count}, (_, i) => {
            const value = Number(this.sizes[i]);
            return Number.isFinite(value) && value >= 0 ? value : 1;
        });
    }
    #limits(pane) {
        const min = Number(pane.getAttribute('min-size'));
        const max = Number(pane.getAttribute('max-size'));
        return {min: Number.isFinite(min) && pane.hasAttribute('min-size') ? min : DEFAULT_MIN, max: Number.isFinite(max) && max > 0 ? max : Infinity};
    }
    // The size of each pane in CSS pixels. With no layout, as in a test, the weights.
    #measured() {
        // A render that waits for the next frame has sizes that the layout does not show yet. Two keys
        // in one frame would otherwise both start from the old size, and one step would be lost.
        if (isRenderScheduled(this)) { this.render(); }
        const sizes = this.panes.map(pane => {
            const rect = pane.getBoundingClientRect();
            return this.#vertical() ? rect.height : rect.width;
        });
        return sizes.some(size => size > 0) ? sizes : this.#weights();
    }
    #dividers() {
        return [...this.#split.querySelectorAll('.zest-divider')];
    }
    #paneName(pane, i) {
        const name = pane.getAttribute('label') || pane.getAttribute('aria-label');
        return name || this.text('pane').replace('{number}', i + 1);
    }

    // Moves divider i so that the pane before it has the size `first`, in CSS pixels
    #resizePair(i, first) {
        const panes = this.panes;
        const sizes = this.#measured();
        if (this.#collapsed.has(i)) {
            this.#collapsed.delete(i);
        }
        if (this.#collapsed.has(i + 1)) {
            this.#collapsed.delete(i + 1);
        }
        const total = sizes[i] + sizes[i + 1];
        const a = this.#limits(panes[i]);
        const b = this.#limits(panes[i + 1]);
        const low = Math.max(a.min, total - b.max);
        const high = Math.min(a.max, total - b.min);
        const value = clamp(first, low, high);
        sizes[i] = value;
        sizes[i + 1] = total - value;
        this.sizes = sizes;
    }

    #sendResize() {
        this.emit('split-view-resize', {sizes: [...this.sizes], collapsed: this.collapsedPanes});
    }

    #onPointerDown(e) {
        const divider = e.target.closest?.('.zest-divider');
        if (!divider || e.button !== 0) { return; }
        e.preventDefault();
        const i = this.#dividers().indexOf(divider);
        const sizes = this.#measured();
        this.#drag = {i, start: this.#vertical() ? e.clientY : e.clientX, first: sizes[i], moved: false};
        divider.setPointerCapture?.(e.pointerId);
        divider.classList.add('zest-dragging');
        divider.focus({preventScroll: true});
        const move = (event) => {
            const position = this.#vertical() ? event.clientY : event.clientX;
            let delta = position - this.#drag.start;
            if (!this.#vertical() && isRtl(this)) { delta = -delta; }
            this.#drag.moved = true;
            this.#resizePair(i, this.#drag.first + delta);
        };
        const end = () => {
            divider.removeEventListener('pointermove', move);
            divider.removeEventListener('pointerup', end);
            divider.removeEventListener('pointercancel', end);
            divider.classList.remove('zest-dragging');
            if (this.#drag?.moved) { this.#sendResize(); }
            this.#drag = null;
        };
        divider.addEventListener('pointermove', move);
        divider.addEventListener('pointerup', end);
        divider.addEventListener('pointercancel', end);
    }

    #onKeydown(e) {
        const divider = e.target.closest?.('.zest-divider');
        if (!divider || e.altKey || e.ctrlKey || e.metaKey) { return; }
        const i = this.#dividers().indexOf(divider);
        const sizes = this.#measured();
        const step = e.shiftKey ? BIG_STEP : STEP;
        const vertical = this.#vertical();
        const rtl = !vertical && isRtl(this);
        const keys = vertical
            ? {ArrowUp: -step, ArrowDown: step}
            : {ArrowLeft: rtl ? step : -step, ArrowRight: rtl ? -step : step};
        if (e.key in keys) {
            this.#resizePair(i, sizes[i] + keys[e.key]);
        } else if (e.key === 'Home') {
            this.#resizePair(i, 0);
        } else if (e.key === 'End') {
            this.#resizePair(i, Infinity);
        } else if (e.key === 'Enter') {
            this.toggle(i);
        } else {
            return;
        }
        e.preventDefault();
        this.#sendResize();
    }

    render() {
        const panes = this.panes.slice(0, MAX_PANES);
        const vertical = this.#vertical();
        this.#split.dataset.orientation = vertical ? 'vertical' : 'horizontal';
        let dividers = this.#dividers();
        while (dividers.length < panes.length - 1) {
            const divider = document.createElement('div');
            divider.className = 'zest-divider';
            divider.setAttribute('role', 'separator');
            divider.setAttribute('part', 'divider');
            divider.tabIndex = 0;
            divider.setAttribute('aria-valuemin', '0');
            divider.setAttribute('aria-valuemax', '100');
            this.#split.append(divider);
            dividers = this.#dividers();
        }
        for (const extra of dividers.splice(Math.max(0, panes.length - 1))) { extra.remove(); }

        const weights = this.#weights();
        const total = weights.reduce((sum, weight, i) => sum + (this.#collapsed.has(i) ? 0 : weight), 0) || 1;
        const tracks = [];
        panes.forEach((pane, i) => {
            const collapsed = this.#collapsed.has(i);
            const {min} = this.#limits(pane);
            tracks.push(collapsed ? '0px' : `minmax(${min}px, ${weights[i]}fr)`);
            if (i < panes.length - 1) { tracks.push('var(--_divider)'); }
            pane.inert = collapsed;
            pane.toggleAttribute('data-collapsed', collapsed);
        });
        this.#split.style.gridTemplateColumns = vertical ? '' : tracks.join(' ');
        this.#split.style.gridTemplateRows = vertical ? tracks.join(' ') : '';
        dividers.forEach((divider, i) => {
            divider.style.order = String(i * 2 + 1);
            // A separator between panes side by side is a vertical line
            divider.setAttribute('aria-orientation', vertical ? 'horizontal' : 'vertical');
            const share = this.#collapsed.has(i) ? 0 : weights[i] / total;
            divider.setAttribute('aria-valuenow', String(Math.round(share * 100)));
            divider.setAttribute('aria-label', this.text('resize').replace('{pane}', this.#paneName(panes[i], i)));
            divider.classList.toggle('zest-collapsed', this.#collapsed.has(i) || this.#collapsed.has(i + 1));
        });
    }
}
