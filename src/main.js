const AppGlobal = window;
import './style.css';

// import EventBroker from '@catalystsquad/event-broker'
import BasicDataRegistry from '@catalystsquad/basic-data-registry';
import {ShadowTwoTierMenu} from '@catalystsquad/two-tier-menu';
import MenuItem from '@catalystsquad/menu-item';
import MenuLogo from '@catalystsquad/menu-logo';
import MenuGutter from '@catalystsquad/menu-gutter';
import MenuGutterIcon from '@catalystsquad/menu-gutter-icon';

const dataRegistryName = 'appDataRegistry'

AppGlobal[dataRegistryName] = new BasicDataRegistry();

AppGlobal[dataRegistryName].AddDataFunction('demoMenuDataFunc', function menuDataFunc() {
  return {
    unregisterFunc: function(){},
    menuConfig: {
      logo: {img: 'cslogo.png'},
      sections: [
        {
          display: "Demo Home",
          icon: "caldo.svg",
          link: "/home",
          items: [
            {display: "Home Item", link: "/home/again"},
            {display: "Item 2", icon: "icons8-open-source-150.png"},
            {display: "Item 3"}
          ]
        },
        {
          display: "Second Section",
          items: [
            {display: "Item 1"},
            {display: "Item 2"},
            {display: "Item 3", icon: "icons8-open-source-150.png"}
          ]
        }
      ]
    }
  }
})

AppGlobal[dataRegistryName].AddDataFunction('menuDataFunc', function menuDataFunc() {
  return {
    unregisterFunc: function(){},
    menuConfig: {
      logo: {img: 'cslogo.png'},
      sections: [
        {
          display: "Home Section",
          icon: "caldo.svg",
          link: "/home",
          items: [
            {display: "Home Again", link: "/home/again"},
            {display: "Item 2", icon: "icons8-open-source-150.png"},
            {display: "Item 3"}
          ]
        },
        {
          display: "Second Section",
          items: [
            {display: "Item 1"},
            {display: "Item 2"},
            {display: "Item 3", icon: "icons8-open-source-150.png"}
          ]
        }
      ]
    }
  }
})

let components = [
  {compTag: 'two-tier-menu', compClass: ShadowTwoTierMenu, dataFunc: 'menuDataFunc'},
  {compTag: 'menu-item', compClass: MenuItem},
  {compTag: 'menu-logo', compClass: MenuLogo},
  {compTag: 'menu-gutter-icon', compClass: MenuGutterIcon},
  {compTag: 'menu-gutter', compClass: MenuGutter},
]

// We want this to be the menu, so we pull it out of the inner-app div
// {compTag: 'two-tier-menu', compClass: ShadowTwoTierMenu, styleClass: "demo", dataFunc: 'demoMenuDataFunc', styleOverride: 'demo-menu-styles'},
customElements.define('two-tier-menu', ShadowTwoTierMenu);
let menu = new ShadowTwoTierMenu();
menu.setAttribute('override-style-template-id', 'demo-menu-styles');
menu.setAttribute('class', 'demo');
menu.registryName = dataRegistryName;
menu.dataRegisterFuncName = 'demoMenuDataFunc';

let appDiv = document.createElement('div');
appDiv.id = 'inner-app-div';
appDiv.setAttribute('id', 'inner-app');

// First define them all so there's no dependency issues
for (let component of components) {
  if (customElements.get(component.compTag) === undefined) {
    customElements.define(component.compTag, component.compClass);
  }
}
// Now add them in order
for (let component of components) {
  let theComponent = new component.compClass();
  if (component.styleOverride) {
    theComponent.setAttribute('override-style-template-id', component.styleOverride);
  }
  if (component.templateOverride) {
    theComponent.setAttribute('override-template-id', component.templateOverride);
  }
  if (component.styleClass){
    theComponent.setAttribute("class", component.styleClass);
  } else {
    theComponent.setAttribute("class", component.compTag);
  }
  if (component.dataFunc) {
    theComponent.registryName = dataRegistryName;
    theComponent.dataRegisterFuncName = component.dataFunc;
  }
  appDiv.appendChild(theComponent);
}

document.querySelector('#app').appendChild(menu);
document.querySelector('#app').appendChild(appDiv);
