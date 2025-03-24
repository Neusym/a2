import { CoreComponent, ComponentLifecycle } from '../../src/a2/core';
import { RegisteredLogger } from '../../src/logger';

describe('CoreComponent', () => {
  let component: CoreComponent;
  
  beforeEach(() => {
    component = new CoreComponent({
      component: RegisteredLogger.AGENT,
      name: 'test-component'
    });
  });
  
  test('should initialize with the correct lifecycle status', () => {
    expect(component.getLifecycle()).toBe(ComponentLifecycle.INITIALIZED);
  });
  
  test('should get and set configuration values', () => {
    expect(component.getConfig('testKey')).toBeUndefined();
    
    component.setConfig('testKey', 'testValue');
    expect(component.getConfig('testKey')).toBe('testValue');
    
    expect(component.getConfig('missingKey', 'defaultValue')).toBe('defaultValue');
  });
  
  test('should get and set state values', () => {
    expect(component.getState('testKey')).toBeUndefined();
    
    component.setState('testKey', 'testValue');
    expect(component.getState('testKey')).toBe('testValue');
    
    expect(component.getState('missingKey', 'defaultValue')).toBe('defaultValue');
  });
  
  test('should register and handle events', async () => {
    const eventHandler = jest.fn();
    component.on('testEvent', eventHandler);
    
    await component.emit('testEvent', { test: true });
    expect(eventHandler).toHaveBeenCalledWith({ test: true });
    
    component.off('testEvent', eventHandler);
    await component.emit('testEvent', { test: true });
    expect(eventHandler).toHaveBeenCalledTimes(1);
  });
  
  test('should change lifecycle through start and stop methods', async () => {
    await component.start();
    expect(component.getLifecycle()).toBe(ComponentLifecycle.STARTED);
    
    await component.stop();
    expect(component.getLifecycle()).toBe(ComponentLifecycle.STOPPED);
  });
  
  test('should emit lifecycle events', async () => {
    const lifecycleHandler = jest.fn();
    component.on('lifecycle', lifecycleHandler);
    
    await component.start();
    expect(lifecycleHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        previous: ComponentLifecycle.INITIALIZED,
        current: ComponentLifecycle.STARTING
      })
    );
    
    expect(lifecycleHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        previous: ComponentLifecycle.STARTING,
        current: ComponentLifecycle.STARTED
      })
    );
  });
}); 