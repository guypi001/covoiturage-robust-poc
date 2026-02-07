declare module 'ws' {
  export class WebSocketServer {
    constructor(options?: any);
    on(event: string, listener: (...args: any[]) => void): void;
  }

  export class WebSocket {
    static OPEN: number;
    readyState: number;
    on(event: string, listener: (...args: any[]) => void): void;
    send(data: any): void;
    close(code?: number, reason?: string): void;
  }
}

export {};
