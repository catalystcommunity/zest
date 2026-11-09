// Uses the declarations as an application does. tsc checks it; nothing runs it.
import { BaseComponent, defineElements, flushRenders, RovingFocus, tokenAliases, type Removal } from '@catalystcommunity/base-components';

class HelloCard extends BaseComponent {
    static properties = {name: {type: String, default: 'World'}};
    static styles = `.zest-hello { ${tokenAliases('hello-card')} }`;
    declare name: string;
    connectedCallback(): void {
        super.connectedCallback();
        const remove: Removal = this.listen(this, 'click', (e) => { e.clientX.toFixed(); });
        this.own(remove);
        new RovingFocus(this, {items: 'button', orientation: 'vertical'}).attach();
        this.render();
    }
    render(): void { this.root.textContent = `Hello ${this.name}`; }
}
defineElements({'hello-card': HelloCard});
const rendered: number = flushRenders();
void rendered;
