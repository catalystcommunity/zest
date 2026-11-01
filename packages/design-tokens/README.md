# `DesignTokens`

The default look of Zest, as CSS custom properties. A component works with no tokens: it uses system colors and its own default sizes. Load the tokens to use the Zest design system.

## Usage

Link the file, so that the browser can cache it and the page never shows without styles:

```html
<link rel="stylesheet" href="/node_modules/@catalystcommunity/design-tokens/src/tokens.css">
```

Or use JavaScript if the application has no CSS step:

```js
import { installTokens } from '@catalystcommunity/design-tokens';

installTokens();
```

If you bundle the file with Vite, set `build.cssTarget` to `['chrome123', 'firefox120', 'safari17.5']` or later. With older targets, the build rewrites `light-dark()` to a media query for the whole page, and `color-scheme` on a part of the page does nothing.

## Change the Look

Set a token on `:root` or on any parent element. The tokens are in the `zest` layer, so your value always wins.

```css
:root { --zest-color-highlight: #7a2e8e; }
.sidebar { --zest-control-height: 3em; color-scheme: dark; }
```

## Names

```
Global:         --zest-<category>-<role>
Family, widget: --zest-<family or tag>[-<part>]-<role>[-<state>]
```

- The categories are `color`, `font`, `gap`, `margin`, `border`, `focus`, and `motion`.
- The color roles say what the color paints: `window`, `face` (buttons and toolbars), `field` (inputs), `highlight`, each with a `-text` color. There are also `secondary-text`, `disabled-text`, `border`, `focus`, and `invalid`.
- The families are `control` and `menu`. Add a family only when two or more widgets share it.
- A widget uses its full tag name, for example `--zest-date-time-picker-day-size`.
- The states are `hover`, `active`, `focus`, `disabled`, `selected`, `checked`, and `invalid`.
- `face` is always a solid color. `fill` is a gradient on top of it.
- A component reads a token in this order: widget, family, global, system color. Do not set a family or widget token to `var(...)` on `:root`: the value resolves there, and a change on a parent element no longer reaches it.
- Sizes use `em`, so a control follows its font size. Borders and focus rings use `px`. Do not register a size with `@property`, or it stops following the local font.
- A private alias inside a component starts with `--_`. It is not public API.

## Sizes

At the default font size of 16px:

| Token | Value | Size |
| --- | --- | --- |
| `--zest-control-height` | `2.5em` | 40px, or 44px with a coarse pointer |
| `--zest-control-padding-inline` | `1em` | 16px |
| `--zest-control-radius` | `0.375em` | 6px |
| `--zest-gap-related` | `0.5em` | 8px |
| `--zest-gap-unrelated` | `1.5em` | 24px |
| `--zest-margin-window` | `1.5em` | 24px |

Heights are minimums, so a control grows when the text grows.

## Accessibility Rules

The tests enforce these for all tokens, in light and dark:

- Text and its background: a contrast of 4.5:1 or more. Disabled text also meets this, although the standard does not require it.
- A border, a focus ring, and a highlight against what is next to them: 3:1 or more.

Each component must also obey these rules:

- A pointer target is 24 by 24 CSS pixels or more. The default is much larger.
- The focus ring is a `2px` solid outline, and it uses `:focus-visible`. Use `outline`, not `box-shadow`, because `box-shadow` does not show in forced colors mode.
- Do not show a state with color only. For example, an unavailable date also has a line through it.
- Use `min-height`, not `height`, so that text can grow.
- With `prefers-reduced-motion`, nothing moves: the motion duration is `0ms`.
- With `prefers-contrast: more`, borders and focus rings are thicker.
- With `forced-colors`, a selected item uses `Highlight` and `HighlightText`.
