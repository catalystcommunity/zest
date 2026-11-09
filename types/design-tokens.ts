// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { installTokens, tokensCss } from '@catalystcommunity/design-tokens';

const sheet: CSSStyleSheet = installTokens();
const host = document.createElement('div');
installTokens(host.attachShadow({mode: 'open'}));
const css: string = tokensCss;
void [sheet, css];
