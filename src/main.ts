import './style.css'

import EventBroker from '@catalystsquad/event-broker'


let components : string[] = [
  'test-comp-a',
  'test-comp-b',
]

let appHtml: string = '<div>\n'

for (let component of components) {
  appHtml += '<div class="component">\n'
  appHtml += `<${component}></${component}>\n`
  appHtml += '</div>\n'
}

appHtml += '</div>\n'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = appHtml
