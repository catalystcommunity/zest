// The private aliases that each component reads, in the order of the design tokens: the widget
// token, then the family token, then the global token, then a system color. Put the result in the
// rule of the outer element of the component: `.zest-check-box { ${tokenAliases('check-box')} }`.
// The text is the same for each instance, so all instances share one sheet.
export function tokenAliases(widget, family = 'control') {
    const w = `--zest-${widget}`;
    const f = `--zest-${family}`;
    return `
    --_window: var(${w}-window, var(--zest-color-window, Canvas));
    --_window-text: var(${w}-window-text, var(--zest-color-window-text, CanvasText));
    --_face: var(${w}-face, var(${f}-face, var(--zest-color-face, ButtonFace)));
    --_face-text: var(${w}-face-text, var(${f}-face-text, var(--zest-color-face-text, ButtonText)));
    --_fill: var(${w}-fill, var(${f}-fill, linear-gradient(color-mix(in srgb, var(--_face) 88%, white), var(--_face))));
    --_field: var(${w}-field, var(${f}-field, var(--zest-color-field, Field)));
    --_field-text: var(${w}-field-text, var(${f}-field-text, var(--zest-color-field-text, FieldText)));
    --_highlight: var(${w}-highlight, var(--zest-color-highlight, Highlight));
    --_highlight-text: var(${w}-highlight-text, var(--zest-color-highlight-text, HighlightText));
    --_secondary-text: var(${w}-secondary-text, var(--zest-color-secondary-text, GrayText));
    --_disabled-text: var(${w}-disabled-text, var(--zest-color-disabled-text, GrayText));
    --_border: var(${w}-border, var(${f}-border, var(--zest-color-border, ButtonBorder)));
    --_line: var(${w}-line, color-mix(in srgb, var(--_border) 45%, transparent));
    --_hover-face: var(${w}-face-hover, color-mix(in srgb, var(--_highlight) 10%, transparent));
    --_selected-face: var(${w}-face-selected, var(--_highlight));
    --_selected-text: var(${w}-text-selected, var(--_highlight-text));
    --_invalid: var(${w}-invalid, var(--zest-color-invalid, LinkText));
    --_focus: var(${w}-focus, var(--zest-color-focus, Highlight));
    --_focus-width: var(--zest-focus-width, 2px);
    --_focus-offset: var(--zest-focus-offset, 2px);
    --_border-width: var(--zest-border-width, 1px);
    --_radius: var(${w}-radius, var(${f}-radius, var(--zest-control-radius, 0.375em)));
    --_height: var(${w}-height, var(${f}-height, var(--zest-control-height, 2.5em)));
    --_padding-block: var(${w}-padding-block, var(${f}-padding-block, var(--zest-control-padding-block, 0.375em)));
    --_padding-inline: var(${w}-padding-inline, var(${f}-padding-inline, var(--zest-control-padding-inline, 1em)));
    --_gap: var(${w}-gap, var(--zest-gap-related, 0.5em));
    --_gap-unrelated: var(--zest-gap-unrelated, 1.5em);
    --_motion: var(--zest-motion-duration, 0ms);
    font-family: var(--zest-font-family, inherit);
    line-height: var(--zest-line-height, inherit);
`;
}

// Hidden text that a screen reader still reads
export const visuallyHidden = `
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
`;
