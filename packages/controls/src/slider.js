import { isRtl, tokenAliases } from "@catalystcommunity/base-components";
import { FormControl, ZestElement, numberFormat, shadowOf, uniqueId } from "./form-control.js";

const sliderStyles = `
slider-control, :host {
    display: block;
    /* In a parent that shrinks its children to their content, the track still has a length */
    min-width: min(12em, 100%);
    max-width: 100%;
}
.zest-slider {
    ${tokenAliases('slider-control')}
    --_thumb: max(24px, 1.5em);
    --_track: 0.375em;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: "label value" "area area";
    align-items: center;
    gap: 0.25em var(--_gap);
    min-width: 0;
    color: var(--_window-text);
}
.zest-slider .label {
    grid-area: label;
    font-weight: 600;
}
.zest-slider .value {
    grid-area: value;
    font-variant-numeric: tabular-nums;
    color: var(--_secondary-text);
}
.zest-slider .value:empty, .zest-slider .label:empty {
    display: none;
}
.zest-slider .area {
    grid-area: area;
    position: relative;
    min-height: var(--_thumb);
    margin-inline: calc(var(--_thumb) / 2);
    touch-action: none;
    cursor: pointer;
}
.zest-slider .track {
    position: absolute;
    inset-inline: 0;
    inset-block-start: calc(50% - var(--_track) / 2);
    height: var(--_track);
    background: var(--_face);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_track);
    box-sizing: border-box;
}
.zest-slider .fill {
    position: absolute;
    inset-inline-start: 0;
    inset-block: calc(var(--_border-width) * -1);
    width: calc(var(--_pos) * 100%);
    background: var(--_highlight);
    border-radius: inherit;
}
.zest-slider .thumb {
    position: absolute;
    inset-block-start: calc(50% - var(--_thumb) / 2);
    inset-inline-start: calc(var(--_pos) * 100% - var(--_thumb) / 2);
    box-sizing: border-box;
    width: var(--_thumb);
    height: var(--_thumb);
    background: var(--_window);
    border: max(2px, var(--_border-width)) solid var(--_highlight);
    border-radius: 50%;
    cursor: grab;
}
.zest-slider .thumb:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
.zest-slider .ticks {
    position: absolute;
    inset-inline: 0;
    inset-block-start: calc(50% + var(--_track));
    height: 0.5em;
    pointer-events: none;
}
.zest-slider .tick {
    position: absolute;
    inset-inline-start: calc(var(--_at) * 100%);
    width: 1px;
    height: 0.375em;
    background: var(--_border);
}
.zest-slider .marks {
    grid-area: auto / 1 / auto / -1;
    position: relative;
    min-height: 1.5em;
    margin-inline: calc(var(--_thumb) / 2);
    font-size: 0.875em;
    color: var(--_secondary-text);
}
.zest-slider .marks:empty {
    display: none;
}
.zest-slider .mark {
    position: absolute;
    inset-inline-start: calc(var(--_at) * 100%);
    translate: -50%;
    white-space: nowrap;
}
.zest-slider .mark:first-child {
    translate: 0;
    inset-inline-start: calc(var(--_thumb) / -2);
}
.zest-slider .mark:last-child {
    translate: 0;
    inset-inline-start: auto;
    inset-inline-end: calc(var(--_thumb) / -2);
}
.zest-slider.vertical {
    grid-template-columns: auto auto;
    grid-template-areas: "label label" "area marks" "value value";
    justify-content: start;
}
.zest-slider.vertical .area {
    width: var(--_thumb);
    min-height: var(--_length, 10em);
    margin-inline: 0;
    margin-block: calc(var(--_thumb) / 2);
}
.zest-slider.vertical .track {
    inset-inline: auto;
    inset-inline-start: calc(50% - var(--_track) / 2);
    inset-block: 0;
    width: var(--_track);
    height: auto;
}
.zest-slider.vertical .fill {
    inset-inline: calc(var(--_border-width) * -1);
    inset-block: auto calc(var(--_border-width) * -1);
    width: auto;
    height: calc(var(--_pos) * 100%);
}
.zest-slider.vertical .thumb {
    inset-inline-start: calc(50% - var(--_thumb) / 2);
    inset-block-start: calc((1 - var(--_pos)) * 100% - var(--_thumb) / 2);
}
.zest-slider.vertical .ticks, .zest-slider.vertical .tick {
    display: none;
}
.zest-slider.vertical .marks {
    grid-area: marks;
    min-height: auto;
    min-width: 2em;
    margin-inline: 0;
    margin-block: calc(var(--_thumb) / 2);
}
.zest-slider.vertical .mark, .zest-slider.vertical .mark:first-child, .zest-slider.vertical .mark:last-child {
    inset-inline-start: 0;
    inset-inline-end: auto;
    inset-block-start: calc((1 - var(--_at)) * 100%);
    translate: 0 -50%;
}
.zest-slider.disabled {
    color: var(--_disabled-text);
}
.zest-slider.disabled .area {
    cursor: default;
}
.zest-slider.disabled .fill {
    background: var(--_disabled-text);
}
.zest-slider.disabled .thumb {
    border-color: var(--_disabled-text);
    border-style: dashed;
    cursor: default;
}
@media (forced-colors: active) {
    .zest-slider .fill {
        background: Highlight;
        forced-color-adjust: none;
    }
    .zest-slider .thumb {
        border-color: ButtonText;
    }
}
`;

// A value in a range, set with a thumb that the user drags or moves with the keys
export class SliderControl extends FormControl {
    static styles = sliderStyles;
    static renderTiming = 'frame';
    static properties = {
        value: {type: Number, default: 0},
        min: {type: Number, default: 0},
        max: {type: Number, default: 100},
        step: {type: Number, default: 1},
        orientation: {type: String, default: 'horizontal'},
        ticks: {type: Boolean},
        marks: {type: Array, default: () => []},
        showValue: {type: Boolean},
        locale: {type: String, default: ''},
        unit: {type: String, default: ''},
        format: {type: Function, attribute: false, default: null},
    };
    wrapper;
    thumb;
    #label;
    #area;
    #value;
    #ticks;
    #marks;
    #dragging = null;
    #drawn = {ticks: '', marks: ''};

    get focusTarget() { return this.thumb; }
    get vertical() { return this.orientation === 'vertical'; }

    build() {
        this.wrapper = Object.assign(document.createElement('div'), {className: 'zest-slider'});
        this.wrapper.part = 'control';
        this.#label = Object.assign(document.createElement('span'), {className: 'label', id: uniqueId('slider-label')});
        this.#value = Object.assign(document.createElement('span'), {className: 'value'});
        this.#value.setAttribute('aria-hidden', 'true');
        this.#area = Object.assign(document.createElement('div'), {className: 'area'});
        const track = Object.assign(document.createElement('div'), {className: 'track'});
        track.append(Object.assign(document.createElement('div'), {className: 'fill'}));
        this.#ticks = Object.assign(document.createElement('div'), {className: 'ticks'});
        this.thumb = Object.assign(document.createElement('div'), {className: 'thumb', tabIndex: 0});
        this.thumb.setAttribute('role', 'slider');
        this.thumb.setAttribute('aria-labelledby', this.#label.id);
        this.thumb.part = 'thumb';
        this.#marks = Object.assign(document.createElement('div'), {className: 'marks'});
        this.#marks.setAttribute('aria-hidden', 'true');
        this.#area.append(track, this.#ticks, this.thumb);
        this.wrapper.append(this.#label, this.#value, this.#area, this.#marks);
        this.thumb.addEventListener('keydown', (e) => this.#onKeydown(e));
        this.#area.addEventListener('pointerdown', (e) => this.#onPointerDown(e));
        // The thumb keeps the focus that the pointer gives it
        this.#area.addEventListener('mousedown', (e) => e.preventDefault());
        this.#area.addEventListener('pointermove', (e) => this.#onPointerMove(e));
        this.#area.addEventListener('pointerup', (e) => this.#onPointerEnd(e));
        this.#area.addEventListener('pointercancel', (e) => this.#onPointerEnd(e));
        this.root.append(this.wrapper);
    }

    // The value in the limits, on a step
    clamp(number) {
        const min = Math.min(this.min, this.max);
        const max = Math.max(this.min, this.max);
        const step = this.step > 0 ? this.step : 1;
        const stepped = min + Math.round((number - min) / step) * step;
        const decimals = Math.max(String(step).split('.')[1]?.length ?? 0, String(min).split('.')[1]?.length ?? 0);
        return Number(Math.max(min, Math.min(max, stepped)).toFixed(decimals));
    }

    get valueText() {
        const value = this.clamp(this.value);
        if (this.format) { return String(this.format(value)); }
        const text = numberFormat(this.locale || undefined).format(value);
        return this.unit ? `${text} ${this.unit}` : text;
    }

    #set(number, final) {
        const value = this.clamp(number);
        const changed = value !== this.value;
        this.value = value;
        if (changed) {
            this.update();
            this.fire('input');
        }
        if (final && (changed || this.#dragging?.changed)) { this.fire('change'); }
        return changed;
    }

    #onKeydown(e) {
        if (this.isDisabled || e.altKey || e.ctrlKey || e.metaKey) { return; }
        const step = this.step > 0 ? this.step : 1;
        const big = Math.max(step, Math.round((this.max - this.min) / 10 / step) * step);
        const back = isRtl(this.wrapper) && !this.vertical ? -1 : 1;
        const moves = {
            ArrowRight: step * back, ArrowLeft: -step * back, ArrowUp: step, ArrowDown: -step,
            PageUp: big, PageDown: -big,
        };
        let next;
        if (e.key in moves) { next = this.clamp(this.value) + moves[e.key]; }
        else if (e.key === 'Home') { next = this.min; }
        else if (e.key === 'End') { next = this.max; }
        else { return; }
        e.preventDefault();
        this.#set(next, true);
    }

    #fromPointer(e) {
        const rect = this.#area.getBoundingClientRect();
        let fraction;
        if (this.vertical) {
            fraction = rect.height ? 1 - (e.clientY - rect.top) / rect.height : 0;
        } else {
            fraction = rect.width ? (e.clientX - rect.left) / rect.width : 0;
            if (isRtl(this.wrapper)) { fraction = 1 - fraction; }
        }
        fraction = Math.max(0, Math.min(1, fraction));
        return this.min + fraction * (this.max - this.min);
    }

    #onPointerDown(e) {
        if (this.isDisabled || e.button !== 0) { return; }
        // No preventDefault here: in Chromium the focus would then go to the page. mousedown stops it.
        this.thumb.focus();
        this.#dragging = {id: e.pointerId, changed: false};
        this.#area.setPointerCapture?.(e.pointerId);
        this.#dragging.changed = this.#set(this.#fromPointer(e), false);
    }

    #onPointerMove(e) {
        if (!this.#dragging || this.#dragging.id !== e.pointerId) { return; }
        if (this.#set(this.#fromPointer(e), false)) { this.#dragging.changed = true; }
    }

    #onPointerEnd(e) {
        if (!this.#dragging || this.#dragging.id !== e.pointerId) { return; }
        if (this.#dragging.changed) { this.fire('change'); }
        this.#dragging = null;
    }

    update() {
        const value = this.clamp(this.value);
        const span = this.max - this.min || 1;
        const position = (value - this.min) / span;
        this.wrapper.style.setProperty('--_pos', String(Math.max(0, Math.min(1, position))));
        this.wrapper.classList.toggle('vertical', this.vertical);
        this.wrapper.classList.toggle('disabled', this.isDisabled);
        this.#label.textContent = this.label;
        const thumb = this.thumb;
        if (!this.label && this.getAttribute('aria-label')) { thumb.setAttribute('aria-label', this.getAttribute('aria-label')); }
        thumb.setAttribute('aria-valuemin', this.min);
        thumb.setAttribute('aria-valuemax', this.max);
        thumb.setAttribute('aria-valuenow', value);
        thumb.setAttribute('aria-valuetext', this.valueText);
        thumb.setAttribute('aria-orientation', this.vertical ? 'vertical' : 'horizontal');
        if (this.isDisabled) {
            thumb.setAttribute('aria-disabled', 'true');
            thumb.tabIndex = -1;
        } else {
            thumb.removeAttribute('aria-disabled');
            thumb.tabIndex = 0;
        }
        this.#value.textContent = this.showValue ? this.valueText : '';
        this.#drawTicks(span);
        this.setFormValue(String(value), String(value));
    }

    #drawTicks(span) {
        const step = this.step > 0 ? this.step : 1;
        const count = Math.round(span / step);
        const every = count <= 50 ? 1 : Math.ceil(count / 10);
        const tickKey = this.ticks ? `${this.min}|${this.max}|${step}` : '';
        if (tickKey !== this.#drawn.ticks) {
            this.#drawn.ticks = tickKey;
            this.#ticks.replaceChildren();
            if (this.ticks) {
                for (let i = 0; i <= count; i += every) {
                    const tick = Object.assign(document.createElement('span'), {className: 'tick'});
                    tick.style.setProperty('--_at', String(i / count));
                    this.#ticks.append(tick);
                }
            }
        }
        const marks = this.marks.map(mark => (typeof mark === 'object' ? mark : {value: Number(mark), label: String(mark)}));
        const markKey = JSON.stringify([marks, this.min, this.max]);
        if (markKey !== this.#drawn.marks) {
            this.#drawn.marks = markKey;
            this.#marks.replaceChildren(...marks.map(mark => {
                const element = Object.assign(document.createElement('span'), {className: 'mark', textContent: mark.label ?? String(mark.value)});
                element.style.setProperty('--_at', String((mark.value - this.min) / span));
                return element;
            }));
        }
    }

    resetValue() {
        const attribute = this.getAttribute('value');
        this.value = attribute === null ? this.min : Number(attribute);
    }
    restoreValue(state) { this.value = Number(state); }
}

const progressStyles = `
progress-bar, :host {
    display: block;
    min-width: 0;
}
.zest-progress {
    ${tokenAliases('progress-bar')}
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    color: var(--_window-text);
}
.zest-progress .head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--_gap);
}
.zest-progress .label {
    font-weight: 600;
}
.zest-progress .text {
    font-variant-numeric: tabular-nums;
    color: var(--_secondary-text);
}
.zest-progress .label:empty, .zest-progress .text:empty, .zest-progress .head:has(.label:empty + .text:empty) {
    display: none;
}
.zest-progress .bar {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    min-height: 0.75em;
    background: var(--_face);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
}
.zest-progress .fill {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    width: calc(var(--_pos, 0) * 100%);
    background: var(--_highlight);
    transition: width var(--_motion);
}
.zest-progress.indeterminate .fill {
    width: 35%;
    background: repeating-linear-gradient(-45deg, var(--_highlight) 0 0.5em, color-mix(in srgb, var(--_highlight) 60%, var(--_window)) 0.5em 1em);
    animation: zest-progress-move 1.4s ease-in-out infinite;
}
@keyframes zest-progress-move {
    from { inset-inline-start: -35%; }
    to { inset-inline-start: 100%; }
}
/* With reduced motion, the bar does not move. Stripes on all of it show that work continues. */
@media (prefers-reduced-motion: reduce) {
    .zest-progress.indeterminate .fill {
        width: 100%;
        animation: none;
    }
}
@media (forced-colors: active) {
    .zest-progress .fill {
        background: Highlight;
        forced-color-adjust: none;
    }
}
`;

// Shows how much of a task is done. With no value, it shows that work continues.
export class ProgressBar extends ZestElement {
    static styles = progressStyles;
    static properties = {
        value: {type: Number, default: null},
        max: {type: Number, default: 100},
        label: {type: String, default: ''},
        showValue: {type: Boolean},
        valueText: {type: String, default: ''},
        locale: {type: String, default: ''},
    };
    wrapper;
    bar;
    #label;
    #text;
    #fill;

    get indeterminate() { return this.value === null || Number.isNaN(this.value); }

    build() {
        this.wrapper = Object.assign(document.createElement('div'), {className: 'zest-progress'});
        this.wrapper.part = 'control';
        const head = Object.assign(document.createElement('div'), {className: 'head'});
        this.#label = Object.assign(document.createElement('span'), {className: 'label', id: uniqueId('progress-label')});
        this.#text = Object.assign(document.createElement('span'), {className: 'text'});
        this.#text.setAttribute('aria-hidden', 'true');
        head.append(this.#label, this.#text);
        this.bar = Object.assign(document.createElement('div'), {className: 'bar'});
        this.bar.setAttribute('role', 'progressbar');
        this.bar.part = 'bar';
        this.#fill = Object.assign(document.createElement('div'), {className: 'fill'});
        this.bar.append(this.#fill);
        this.wrapper.append(head, this.bar);
        this.root.append(this.wrapper);
    }

    update() {
        const max = this.max > 0 ? this.max : 100;
        const indeterminate = this.indeterminate;
        const fraction = indeterminate ? 0 : Math.max(0, Math.min(1, this.value / max));
        this.wrapper.classList.toggle('indeterminate', indeterminate);
        this.wrapper.style.setProperty('--_pos', String(fraction));
        this.#label.textContent = this.label;
        if (this.label) {
            this.bar.setAttribute('aria-labelledby', this.#label.id);
        } else {
            this.bar.removeAttribute('aria-labelledby');
            if (this.getAttribute('aria-label')) { this.bar.setAttribute('aria-label', this.getAttribute('aria-label')); }
        }
        const text = indeterminate ? this.text.working : (this.valueText || numberFormat(this.locale || undefined, {style: 'percent'}).format(fraction));
        this.bar.setAttribute('aria-valuemin', '0');
        this.bar.setAttribute('aria-valuemax', String(max));
        if (indeterminate) {
            this.bar.removeAttribute('aria-valuenow');
        } else {
            this.bar.setAttribute('aria-valuenow', String(Math.min(max, Math.max(0, this.value))));
        }
        this.bar.setAttribute('aria-valuetext', text);
        this.#text.textContent = this.showValue ? text : '';
    }
}

export class ShadowSliderControl extends shadowOf(SliderControl) {}
export class ShadowProgressBar extends ProgressBar {
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}
