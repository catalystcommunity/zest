// Small helpers that the gallery sections and the examples share
export function el(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}

export function card(testId, title, ...children) {
  return el('div', {class: 'card', 'data-testid': testId}, el('h3', {}, title), ...children);
}

export function button(testId, label, onClick) {
  const element = el('button', {type: 'button', 'data-testid': testId}, label);
  element.addEventListener('click', onClick);
  return element;
}

export function makeLog(testId) {
  const element = el('div', {class: 'log', 'data-testid': testId});
  element.add = (line) => {
    element.textContent += line + '\n';
    element.scrollTop = element.scrollHeight;
  };
  return element;
}
