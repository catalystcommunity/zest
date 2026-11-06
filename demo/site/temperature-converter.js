// The live example on the home page. The page also shows this file as its source.
import {BaseComponent} from '@catalystcommunity/base-components';

const round = (value) => Math.round(value * 10) / 10;

// Two spin boxes that agree. Change one, and the other follows.
export class TemperatureConverter extends BaseComponent {
  static properties = {
    celsius: {type: Number, default: 20, reflect: true},
  };

  connectedCallback() {
    super.connectedCallback();
    if (!this.querySelector('spin-box')) {
      this.innerHTML = `
        <spin-box label="Celsius" step="0.1" data-unit="celsius"></spin-box>
        <spin-box label="Fahrenheit" step="0.1" data-unit="fahrenheit"></spin-box>`;
    }
    // A change event bubbles from each spin box, so one listener serves both
    this.listen(this, 'change', (e) => {
      const box = e.target.closest('spin-box');
      if (!box || box.value === '' || box.value === null) { return; }
      this.celsius = box.dataset.unit === 'celsius' ? box.value : (box.value - 32) * 5 / 9;
    });
    this.render();
  }

  // A change of `celsius` asks for one render
  render() {
    const [celsius, fahrenheit] = this.querySelectorAll('spin-box');
    if (!celsius) { return; }
    celsius.value = round(this.celsius);
    fahrenheit.value = round(this.celsius * 9 / 5 + 32);
  }
}
