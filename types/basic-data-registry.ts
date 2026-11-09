// Uses the declarations as an application does. tsc checks it; nothing runs it.
import BasicDataRegistry from '@catalystcommunity/basic-data-registry';

const registry = new BasicDataRegistry();
registry.AddDataFunction('availability', (instanceId, registerData, isActive) => ({
    pickerConfig: {min: '2026-03-01'},
    unregisterFunc: () => { void [instanceId, registerData, isActive()]; },
}));
const found = registry['availability'];
if (typeof found === 'function') { void found('picker-1', null, () => true); }
