// The default CSS of each component in this package. Each class has its own text, so each class
// shares one sheet between its instances.
import { tokenAliases, visuallyHidden } from "@catalystcommunity/base-components";

// The parts that a menu item, a menu bar item, and a toolbar button share
const common = (wrapper) => `
${wrapper} {
    overflow-wrap: normal;
    box-sizing: border-box;
}
${wrapper} .zest-sr {
    ${visuallyHidden}
}
${wrapper} .zest-icon:empty:not([data-icon]), ${wrapper} .zest-shortcut:empty {
    display: none;
}
${wrapper} .zest-icon[data-icon]::before {
    content: attr(data-icon) / "";
}
${wrapper} .zest-icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    min-width: 1.25em;
}
${wrapper} .zest-icon img {
    width: 1.25em;
    height: 1.25em;
    object-fit: contain;
}
${wrapper} [aria-disabled="true"] {
    color: var(--_disabled-text);
    cursor: default;
}
${wrapper} [aria-disabled="true"] .zest-icon {
    opacity: 0.6;
}
@media (forced-colors: active) {
    ${wrapper} [aria-disabled="true"] {
        color: GrayText;
    }
}
`;

export const popupMenu = `
popup-menu, :host {
    display: contents;
}
.zest-popup-menu {
    ${tokenAliases('popup-menu', 'menu')}
    position: fixed;
    inset: auto;
    margin: 0;
    min-width: 12em;
    padding: 0.25em;
    overflow: auto;
    background: var(--_window);
    color: var(--_window-text);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: 0 0.25em 1em rgb(0 0 0 / 0.25);
    font-size: var(--zest-popup-menu-font-size, inherit);
    text-align: start;
}
.zest-popup-menu[hidden] {
    display: none;
}
.zest-popup-menu .zest-item {
    display: flex;
    align-items: center;
    gap: var(--_gap);
    min-height: var(--zest-popup-menu-item-height, 2em);
    padding: 0.125em 0.75em 0.125em 0.375em;
    border-radius: calc(var(--_radius) - 2px);
    white-space: nowrap;
    cursor: default;
    user-select: none;
}
.zest-popup-menu .zest-item::before {
    content: "";
    flex: none;
    width: 1em;
    text-align: center;
}
.zest-popup-menu .zest-item[role="menuitemcheckbox"][aria-checked="true"]::before {
    content: "✓" / "";
}
.zest-popup-menu .zest-item[role="menuitemradio"][aria-checked="true"]::before {
    content: "●" / "";
    font-size: 0.75em;
    width: 1.333em;
}
.zest-popup-menu .zest-item.zest-has-sub::after {
    content: "▸" / "";
    flex: none;
    margin-inline-start: auto;
    padding-inline-start: 1em;
}
.zest-popup-menu .zest-item.zest-has-sub:dir(rtl)::after {
    content: "◂" / "";
}
.zest-popup-menu .zest-label {
    flex: 1;
}
.zest-popup-menu .zest-shortcut {
    margin-inline-start: auto;
    padding-inline-start: 2em;
    color: var(--_secondary-text);
    font-size: 0.875em;
}
.zest-popup-menu .zest-item:hover, .zest-popup-menu .zest-item:focus, .zest-popup-menu .zest-item[aria-expanded="true"] {
    background: var(--_hover-face);
    outline: none;
}
.zest-popup-menu .zest-item:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
}
.zest-popup-menu [role="separator"] {
    height: var(--_border-width);
    margin: 0.25em 0.375em;
    background: var(--_line);
}
${common('.zest-popup-menu')}
`;

export const menuBar = `
menu-bar, :host {
    display: block;
    min-width: 0;
}
.zest-menu-bar {
    ${tokenAliases('menu-bar', 'menu')}
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 4px;
    background: var(--_face);
    color: var(--_face-text);
    border-block-end: var(--_border-width) solid var(--_line);
}
.zest-menu-bar .zest-top {
    display: flex;
    align-items: center;
    gap: 0.375em;
    min-height: 2em;
    padding: 0.125em 0.75em;
    border-radius: var(--_radius);
    white-space: nowrap;
    cursor: default;
    user-select: none;
}
.zest-menu-bar .zest-top:hover, .zest-menu-bar .zest-top[aria-expanded="true"] {
    background: var(--_hover-face);
}
.zest-menu-bar .zest-top[aria-expanded="true"] {
    box-shadow: inset 0 0 0 var(--_border-width) var(--_border);
}
.zest-menu-bar .zest-top:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
}
${common('.zest-menu-bar')}
`;

const buttonFace = `
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375em;
    min-height: var(--_height);
    padding: var(--_padding-block) var(--_padding-inline);
    background-color: var(--_face);
    background-image: var(--_fill);
    color: var(--_face-text);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    font: inherit;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color var(--_motion), border-color var(--_motion);
`;

export const menuButton = `
menu-button, :host {
    display: inline-block;
    max-width: 100%;
}
.zest-menu-button {
    ${tokenAliases('menu-button')}
    display: inline-flex;
    max-width: 100%;
}
.zest-menu-button button {
    ${buttonFace}
}
.zest-menu-button button[hidden] {
    display: none;
}
.zest-menu-button button:hover {
    background-image: none;
    border-color: var(--_highlight);
}
.zest-menu-button button:disabled {
    color: var(--_disabled-text);
    cursor: default;
    background-image: none;
}
.zest-menu-button .zest-toggle::after {
    content: "▾" / "";
}
/* The children of the application, as the face of the button */
.zest-menu-button .zest-content {
    display: inline-flex;
    align-items: center;
    gap: var(--_gap);
    min-width: 0;
}
.zest-menu-button .zest-content[hidden], .zest-menu-button.zest-custom .zest-label:empty {
    display: none;
}
.zest-menu-button.zest-split .zest-main {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
}
.zest-menu-button.zest-split .zest-toggle {
    margin-inline-start: calc(var(--_border-width) * -1);
    padding-inline: 0.5em;
    border-start-start-radius: 0;
    border-end-start-radius: 0;
}
.zest-menu-button button[aria-expanded="true"] {
    background-image: none;
    border-color: var(--_highlight);
    box-shadow: inset 0 0.125em 0.25em rgb(0 0 0 / 0.2);
}
.zest-menu-button :focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
    position: relative;
}
${common('.zest-menu-button')}
`;

export const toolBar = `
tool-bar, :host {
    display: block;
    min-width: 0;
}
.zest-tool-bar {
    ${tokenAliases('tool-bar')}
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    padding: 4px;
    overflow: hidden;
    background: var(--_face);
    color: var(--_face-text);
    border: var(--_border-width) solid var(--_line);
    border-radius: var(--_radius);
}
.zest-tool-bar.zest-wrap {
    flex-wrap: wrap;
}
.zest-tool-bar[aria-orientation="vertical"] {
    flex-direction: column;
    align-items: stretch;
    overflow: visible;
}
.zest-tool-bar button {
    ${buttonFace}
    flex: none;
    min-height: var(--zest-tool-bar-button-size, 2.25em);
    min-width: var(--zest-tool-bar-button-size, 2.25em);
    padding: 0.25em 0.625em;
    background: transparent;
    border-color: transparent;
}
.zest-tool-bar.zest-icons-only button.zest-tool {
    padding-inline: 0.375em;
}
.zest-tool-bar button:hover {
    background: var(--_hover-face);
    border-color: var(--_border);
}
.zest-tool-bar button[aria-pressed="true"] {
    background: color-mix(in srgb, var(--_highlight) 18%, var(--_face));
    border-color: var(--_highlight);
    box-shadow: inset 0 0.125em 0.25em rgb(0 0 0 / 0.2);
}
.zest-tool-bar button[aria-expanded="true"] {
    border-color: var(--_border);
    box-shadow: inset 0 0.125em 0.25em rgb(0 0 0 / 0.2);
}
.zest-tool-bar button[aria-haspopup]:not(.zest-more)::after {
    content: "▾" / "";
}
.zest-tool-bar button[hidden] {
    display: none;
}
.zest-tool-bar button:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
}
.zest-tool-bar [role="separator"] {
    flex: none;
    align-self: stretch;
    width: var(--_border-width);
    margin: 0.25em 0.25em;
    background: var(--_line);
}
.zest-tool-bar[aria-orientation="vertical"] [role="separator"] {
    width: auto;
    height: var(--_border-width);
}
.zest-tool-bar [role="separator"][hidden] {
    display: none;
}
@media (forced-colors: active) {
    .zest-tool-bar button[aria-pressed="true"] {
        background: Highlight;
        color: HighlightText;
    }
}
${common('.zest-tool-bar')}
`;

export const toolTip = `
tool-tip {
    display: none;
}
.zest-tool-tip {
    ${tokenAliases('tool-tip')}
    position: fixed;
    inset: auto;
    margin: 0;
    max-width: min(20em, calc(100vw - 8px));
    padding: 0.25em 0.5em;
    overflow: visible;
    background: var(--zest-tool-tip-face, var(--_window-text));
    color: var(--zest-tool-tip-text, var(--_window));
    border: var(--_border-width) solid var(--_border);
    border-radius: calc(var(--_radius) - 2px);
    box-shadow: 0 0.125em 0.5em rgb(0 0 0 / 0.25);
    font-size: 0.875em;
    overflow-wrap: break-word;
    pointer-events: auto;
}
.zest-tool-tip:popover-open, .zest-tool-tip.zest-shown {
    display: block;
}
`;

export const notices = `
notice-area {
    display: contents;
}
.zest-notices {
    ${tokenAliases('notice-area')}
    position: fixed;
    inset: auto;
    inset-block-end: 1em;
    inset-inline-end: 1em;
    margin: 0;
    width: min(24em, calc(100vw - 2em));
    max-height: calc(100vh - 2em);
    padding: 0;
    overflow: visible;
    background: none;
    border: none;
    pointer-events: none;
    overflow-wrap: normal;
}
.zest-notices > div {
    display: flex;
    flex-direction: column;
    gap: var(--_gap);
}
.zest-notices > div:not(:empty) + div:not(:empty) {
    margin-block-start: var(--_gap);
}
.zest-notices .zest-notice {
    display: flex;
    align-items: center;
    gap: var(--_gap);
    padding: var(--_gap);
    pointer-events: auto;
    background: var(--_window);
    color: var(--_window-text);
    border: var(--_border-width) solid var(--_border);
    border-inline-start: 0.375em solid var(--_highlight);
    border-radius: var(--_radius);
    box-shadow: 0 0.25em 1em rgb(0 0 0 / 0.25);
}
.zest-notices .zest-notice[data-kind="error"] {
    border-inline-start-color: var(--_invalid);
}
.zest-notices .zest-notice::before {
    content: "i" / "";
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 1.5em;
    height: 1.5em;
    border-radius: 50%;
    border: var(--_border-width) solid currentColor;
    font-weight: bold;
}
.zest-notices .zest-notice[data-kind="success"]::before { content: "✓" / ""; }
.zest-notices .zest-notice[data-kind="warning"]::before { content: "!" / ""; }
.zest-notices .zest-notice[data-kind="error"]::before { content: "✕" / ""; color: var(--_invalid); }
.zest-notices .zest-text {
    flex: 1;
    min-width: 0;
    overflow-wrap: break-word;
}
.zest-notices .zest-sr {
    ${visuallyHidden}
}
.zest-notices button {
    ${buttonFace}
    flex: none;
    min-height: 2em;
    min-width: 2em;
    padding: 0.125em 0.5em;
}
.zest-notices button.zest-dismiss {
    background: transparent;
    border-color: transparent;
}
.zest-notices button:hover {
    background-image: none;
    border-color: var(--_highlight);
}
.zest-notices button:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
`;
