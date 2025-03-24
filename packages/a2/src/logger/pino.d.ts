declare module 'pino' {
  namespace pino {
    interface Logger {
      debug: (obj: object, msg?: string) => void;
      info: (obj: object, msg?: string) => void;
      warn: (obj: object, msg?: string) => void;
      error: (obj: object, msg?: string) => void;
    }

    function multistream(streams: Array<{ stream: any; level: string }>): any;
  }

  function pino(options?: any, stream?: any): pino.Logger;
  export = pino;
}

declare module 'pino-pretty' {
  function pretty(options?: {
    colorize?: boolean;
    levelFirst?: boolean;
    ignore?: string;
    colorizeObjects?: boolean;
    translateTime?: string;
    singleLine?: boolean;
  }): any;

  export = pretty;
}
