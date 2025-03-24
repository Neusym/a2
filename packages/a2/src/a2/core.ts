import type { Logger } from '../logger';
import { createLogger, RegisteredLogger } from '../logger';

/**
 * Configuration options for a framework component
 */
export interface ComponentConfig {
  /** Component type */
  component?: RegisteredLogger;
  /** Optional name for the component instance */
  name?: string;
  /** Custom logger instance */
  logger?: Logger;
  /** Additional configuration options */
  [key: string]: any;
}

/**
 * Event handler function type
 */
export type EventHandler = (data: any) => void | Promise<void>;

/**
 * Component lifecycle events
 */
export enum ComponentLifecycle {
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  STARTED = 'started',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

/**
 * Core component class for the a2 framework
 * Provides common functionality for all framework components
 */
export class CoreComponent {
  /** The component type from the registered logger components */
  component: RegisteredLogger;

  /** Logger instance for this component */
  protected logger: Logger;

  /** Optional name for this component instance */
  name?: string;

  /** Component configuration */
  protected config: Record<string, any> = {};

  /** Component state */
  protected state: Record<string, any> = {};

  /** Component lifecycle status */
  private lifecycleStatus: ComponentLifecycle = ComponentLifecycle.INITIALIZING;

  /** Event listeners registry */
  private eventListeners: Map<string, Set<EventHandler>> = new Map();

  /**
   * Create a new component instance
   * @param options Configuration options
   */
  constructor(options: ComponentConfig = {}) {
    this.component = options.component || RegisteredLogger.AGENT;
    this.name = options.name;

    if (options.logger) {
      this.logger = options.logger;
    } else {
      const loggerName = this.name ? `${this.component}:${this.name}` : this.component;
      this.logger = createLogger({ name: loggerName });
    }

    // Store additional configuration options
    const { component, name, logger, ...rest } = options;
    this.config = { ...rest };

    this.logger.debug(`Initialized component`, {
      component: this.component,
      name: this.name,
    });

    // Mark as initialized
    this.setLifecycle(ComponentLifecycle.INITIALIZED);
  }

  /**
   * Get the current lifecycle status
   * @returns Current lifecycle status
   */
  getLifecycle(): ComponentLifecycle {
    return this.lifecycleStatus;
  }

  /**
   * Set the lifecycle status and emit an event
   * @param status New lifecycle status
   */
  protected setLifecycle(status: ComponentLifecycle): void {
    const previous = this.lifecycleStatus;
    this.lifecycleStatus = status;

    this.debug(`Lifecycle changed`, { previous, current: status });
    this.emit('lifecycle', { previous, current: status });
    this.emit(`lifecycle:${status}`, { previous, current: status });
  }

  /**
   * Set a custom logger for the component
   * @param logger Custom logger instance
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
    this.logger.debug(`Logger updated`, {
      component: this.component,
      name: this.name,
    });
  }

  /**
   * Get the current logger instance
   * @returns The logger instance
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get configuration value
   * @param key Configuration key
   * @param defaultValue Default value if key doesn't exist
   * @returns Configuration value or default value
   */
  getConfig<T = any>(key: string, defaultValue?: T): T {
    return key in this.config ? this.config[key] : (defaultValue as T);
  }

  /**
   * Set configuration value
   * @param key Configuration key
   * @param value Configuration value
   */
  setConfig(key: string, value: any): void {
    this.config[key] = value;
    this.debug(`Configuration updated`, { key, value });
  }

  /**
   * Get component state value
   * @param key State key
   * @param defaultValue Default value if key doesn't exist
   */
  getState<T = any>(key: string, defaultValue?: T): T {
    return key in this.state ? this.state[key] : (defaultValue as T);
  }

  /**
   * Set component state value
   * @param key State key
   * @param value State value
   */
  setState(key: string, value: any): void {
    const oldValue = this.state[key];
    this.state[key] = value;
    this.debug(`State updated`, { key, oldValue, newValue: value });
    this.emit('state:change', { key, oldValue, newValue: value });
    this.emit(`state:change:${key}`, { oldValue, newValue: value });
  }

  /**
   * Start the component if it has an async initialization process
   * Meant to be overridden by subclasses
   */
  async start(): Promise<void> {
    this.setLifecycle(ComponentLifecycle.STARTING);
    // Default implementation does nothing
    this.setLifecycle(ComponentLifecycle.STARTED);
  }

  /**
   * Stop the component and clean up resources
   * Meant to be overridden by subclasses
   */
  async stop(): Promise<void> {
    this.setLifecycle(ComponentLifecycle.STOPPING);
    // Default implementation does nothing
    this.setLifecycle(ComponentLifecycle.STOPPED);
  }

  /**
   * Register an event handler
   * @param event Event name
   * @param handler Event handler function
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
    this.debug(`Event handler registered`, { event });
  }

  /**
   * Remove an event handler
   * @param event Event name
   * @param handler Event handler function to remove
   */
  off(event: string, handler: EventHandler): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(handler);
      this.debug(`Event handler removed`, { event });
    }
  }

  /**
   * Emit an event
   * @param event Event name
   * @param data Event data
   */
  async emit(event: string, data: any = {}): Promise<void> {
    if (this.eventListeners.has(event)) {
      const handlers = this.eventListeners.get(event)!;
      this.debug(`Emitting event`, { event, handlerCount: handlers.size });

      await Promise.all(
        Array.from(handlers).map((handler) => {
          try {
            return Promise.resolve(handler(data));
          } catch (err) {
            this.error(`Error in event handler`, { event, error: err });
            return Promise.resolve();
          }
        }),
      );
    }
  }

  /**
   * Log a message at debug level
   * @param message Message to log
   * @param context Additional context data
   */
  debug(message: string, context: Record<string, any> = {}): void {
    this.logger.debug(message, {
      component: this.component,
      name: this.name,
      ...context,
    });
  }

  /**
   * Log a message at info level
   * @param message Message to log
   * @param context Additional context data
   */
  info(message: string, context: Record<string, any> = {}): void {
    this.logger.info(message, {
      component: this.component,
      name: this.name,
      ...context,
    });
  }

  /**
   * Log a message at warn level
   * @param message Message to log
   * @param context Additional context data
   */
  warn(message: string, context: Record<string, any> = {}): void {
    this.logger.warn(message, {
      component: this.component,
      name: this.name,
      ...context,
    });
  }

  /**
   * Log a message at error level
   * @param message Message to log
   * @param context Additional context data
   */
  error(message: string, context: Record<string, any> = {}): void {
    this.logger.error(message, {
      component: this.component,
      name: this.name,
      ...context,
    });
  }
}
