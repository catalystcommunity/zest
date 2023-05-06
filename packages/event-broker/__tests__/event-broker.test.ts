import EventBroker from '../lib/index';

test('basic test', () => {
    expect(EventBroker()).toBe('Hello from EventBroker');
});
