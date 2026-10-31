# `BasicDataRegistry`

A holder of data registration functions.

## Usage

```js
import BasicDataRegistry from '@catalystcommunity/basic-data-registry';

window.appDataRegistry = new BasicDataRegistry();
window.appDataRegistry.AddDataFunction('menuData', (instanceId, registerData) => ({ menuConfig: {} }));
```

`AddDataFunction` throws an error if the name is already registered, or if the value is not a function.
