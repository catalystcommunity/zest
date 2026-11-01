// The tokens as text, for an application that has no CSS step. To load them as a file that the
// browser can cache, link to tokens.css in this package.
export const tokensCss = `@layer zest {
    :root {
        color-scheme: light dark;

        --zest-color-window: light-dark(#ffffff, #181b1f);
        --zest-color-window-text: light-dark(#1d2329, #e6e9ed);
        --zest-color-face: light-dark(#eef1f4, #262b31);
        --zest-color-face-text: light-dark(#1d2329, #e6e9ed);
        --zest-color-field: light-dark(#ffffff, #101316);
        --zest-color-field-text: light-dark(#1d2329, #e6e9ed);
        --zest-color-highlight: light-dark(#0a5ab8, #8cc2ff);
        --zest-color-highlight-text: light-dark(#ffffff, #0a1a2c);
        --zest-color-secondary-text: light-dark(#525a64, #b4bcc6);
        --zest-color-disabled-text: light-dark(#636b75, #98a1ab);
        --zest-color-border: light-dark(#737b85, #8b949e);
        --zest-color-focus: light-dark(#0a5ab8, #8cc2ff);
        --zest-color-invalid: light-dark(#b42318, #ff9a8f);

        --zest-font-family: system-ui, sans-serif;
        --zest-font-size: 1rem;
        --zest-line-height: 1.5;

        --zest-gap-related: 0.5em;
        --zest-gap-unrelated: 1.5em;
        --zest-margin-window: 1.5em;

        --zest-control-height: 2.5em;
        --zest-control-padding-block: 0.375em;
        --zest-control-padding-inline: 1em;
        --zest-control-radius: 0.375em;

        --zest-border-width: 1px;
        --zest-focus-width: 2px;
        --zest-focus-offset: 2px;
        --zest-motion-duration: 0ms;
    }
    @media (pointer: coarse) {
        :root {
            --zest-control-height: 2.75em;
        }
    }
    @media (prefers-reduced-motion: no-preference) {
        :root {
            --zest-motion-duration: 120ms;
        }
    }
    @media (prefers-contrast: more) {
        :root {
            --zest-color-border: light-dark(#1d2329, #e6e9ed);
            --zest-border-width: 2px;
            --zest-focus-width: 3px;
        }
    }
}
`;

let sheet = null;

// Adds the tokens to a document or a shadow root, one time. It does nothing until you call it.
export function installTokens(target = document) {
    if (!sheet) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(tokensCss);
    }
    if (!target.adoptedStyleSheets.includes(sheet)) {
        target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
    }
    return sheet;
}
