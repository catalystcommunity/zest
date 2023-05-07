import './style.css'

import EventBroker from '@catalystsquad/event-broker'
import TestCompA from '@catalystsquad/test-comp-a';

const eventBroker = EventBroker();

let components: any[] = [
  TestCompA,
]

let appDiv = document.createElement('div')

for (let component of components) {
  appDiv.appendChild(new component)
}
let foo = document.createElement('span')
foo.innerHTML = eventBroker
appDiv.appendChild(
  foo
)

document.querySelector<HTMLDivElement>('#app')!.appendChild(appDiv)
