import pino from 'pino';
import { config } from '../../config'; // Use validated config

// Interface for logging (useful for dependency injection/testing)
export interface ILogger {
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string | Error, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    child(bindings: pino.Bindings): ILogger; // Allow creating child loggers
}

// Pino logger implementation
export class PinoLogger implements ILogger {
    private pinoInstance: pino.Logger;

    constructor(options?: pino.LoggerOptions) {
        const defaultOptions: pino.LoggerOptions = {
            level: config.LOG_LEVEL, // Use level from config
             // Add base context if needed
             base: { service: 'AgentBus' }, // Add service name
             timestamp: pino.stdTimeFunctions.isoTime, // ISO format timestamp
             formatters: {
                level: (label) => { // Use standard level labels
                    return { level: label };
                },
             },
        };

        // Pretty print for development, JSON for production/Vercel
        const transport = config.NODE_ENV === 'development'
            ? pino.transport({
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname,service' } // Ignore some fields for cleaner dev logs
              })
            : undefined; // Standard JSON output for production/Vercel logs

        this.pinoInstance = pino(
            { ...defaultOptions, ...options },
            transport! // Pass transport directly to pino constructor if defined
        );
    }

    info(message: string, ...args: any[]): void {
        this.pinoInstance.info(message, ...args);
    }
    warn(message: string, ...args: any[]): void {
        this.pinoInstance.warn(message, ...args);
    }
    error(message: string | Error, ...args: any[]): void {
        if (message instanceof Error) {
             this.pinoInstance.error({ err: message }, message.message, ...args); // Log error object correctly
        } else {
             this.pinoInstance.error(message, ...args);
        }
    }
    debug(message: string, ...args: any[]): void {
        this.pinoInstance.debug(message, ...args);
    }
    child(bindings: pino.Bindings): ILogger {
        // Pino's child method returns a pino.Logger, wrap it in PinoLogger
        const childPino = this.pinoInstance.child(bindings);
        // Create a new PinoLogger instance wrapping the child logger
        // This is a bit inefficient but ensures the ILogger interface is maintained
        const childLogger = new PinoLogger();
        childLogger.pinoInstance = childPino;
        return childLogger;
    }
}

// Export a default instance (can be used if DI is not strictly needed everywhere)
// export const DefaultLogger: ILogger = new PinoLogger(); 