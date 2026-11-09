// Type declarations for @catalystcommunity/design-tokens. The source is JavaScript; keep this file
// in step with src/index.js. __tests__/types.spec.js checks that each export has a declaration.

/** The tokens as CSS text, in `@layer zest`. */
export declare const tokensCss: string;

/** Adds the tokens to a document or a shadow root, one time. Returns the shared style sheet. */
export declare function installTokens(target?: Document | ShadowRoot): CSSStyleSheet;
