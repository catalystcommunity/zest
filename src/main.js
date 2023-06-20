const AppGlobal = window;
import './style.css'

// import EventBroker from '@catalystsquad/event-broker'
import BasicDataRegistry from '@catalystsquad/basic-data-registry';
import ShadowTwoTierSectionMenu from '@catalystsquad/two-tier-section-menu';
import MenuItem from '@catalystsquad/menu-item';
import MenuLogo from '@catalystsquad/menu-logo';
import MenuGutter from '@catalystsquad/menu-gutter';
import MenuGutterIcon from '@catalystsquad/menu-gutter-icon';
import MenuSectionHeader from '@catalystsquad/menu-section-header';

const dataRegistryName = 'appDataRegistry'

AppGlobal[dataRegistryName] = new BasicDataRegistry();

AppGlobal[dataRegistryName].AddDataFunction('menuDataFunc', function menuDataFunc() {
  return {
    unregisterFunc: function(){},
    menuData: {
      logo: {img: 'cslogo.png'},
      sections: [
        {
          name: "Home Section",
          icon: "caldo.svg",
          link: "/home",
          items: [
            {name: "Home Again", link: "/home/again"},
            {name: "Item 2", icon: "icons8-open-source-150.png"},
            {name: "Item 3"}
          ]
        },
        {
          name: "Second Section",
          items: [
            {name: "Item 1"},
            {name: "Item 2", subItems: [
              {name: "SubItem 1"},
              {name: "SubItem 2", icon: "icons8-open-source-150.png"},
            ]},
            {name: "Item 3"}
          ]
        }
      ]
    }
  }
})


let components = [
  {compTag: 'two-tier-section-menu', compClass: ShadowTwoTierSectionMenu, dataFunc: 'menuDataFunc'},
  {compTag: 'menu-item', compClass: MenuItem},
  {compTag: 'menu-logo', compClass: MenuLogo},
  {compTag: 'menu-gutter-icon', compClass: MenuGutterIcon},
  {compTag: 'menu-gutter', compClass: MenuGutter},
  {compTag: 'menu-section-header', compClass: MenuSectionHeader},
]



let appDiv = document.createElement('div')
appDiv.id = 'inner-app-div'

for (let component of components) {
  customElements.define(component.compTag, component.compClass);
  let theComponent = new component.compClass;
  if (component.dataFunc) {
    theComponent.registryName = dataRegistryName
    theComponent.dataRegisterFuncName = component.dataFunc;
  }
  appDiv.appendChild(theComponent)
}

document.querySelector('#app').appendChild(appDiv)
