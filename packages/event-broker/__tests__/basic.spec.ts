import EventBroker from '../src';

test('basic test', () => {
    expect(EventBroker()).toBe('Hello from EventBroker');
});
