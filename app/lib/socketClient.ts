export type SocketConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

export type SocketMessage = {
  type: string;
  payload?: unknown;
  [key: string]: unknown;
};

export class SocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private reconnectDelay = 500;
  private maxReconnectDelay = 30000;
  private retries = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connectionState: SocketConnectionState = "connecting";
  private listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
  }

  private setState(nextState: SocketConnectionState) {
    this.connectionState = nextState;
    this.dispatchStateChange(nextState);
  }

  private dispatchStateChange(state: SocketConnectionState) {
    const event = new CustomEvent("socket-state-change", { detail: state });
    window.dispatchEvent(event);
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startHeartbeat() {
    this.clearHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "ping" }));
      }
    }, 20000);
  }

  connect() {
    if (typeof window === "undefined") return;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

    this.setState("connecting");

    const socket = new WebSocket(this.url);

    this.socket = socket;

    socket.onopen = () => {
      this.retries = 0;
      this.reconnectDelay = 500;
      this.setState("connected");
      this.startHeartbeat();
    };

    socket.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (typeof message === "string") {
        try {
          const parsed = JSON.parse(message) as SocketMessage;
          this.emit("message", event);
          if (parsed.type === "pong") return;
          if (parsed.type === "error") {
            console.error("Socket error payload:", parsed);
          }
        } catch {
          this.emit("message", event);
        }
      }
    };

    socket.onerror = () => {
      this.setState("reconnecting");
    };

    socket.onclose = () => {
      this.clearHeartbeat();

      if (navigator.onLine === false) {
        this.setState("offline");
        return;
      }

      this.setState("reconnecting");
      this.reconnect();
    };
  }

  private reconnect() {
    if (typeof window === "undefined") return;

    setTimeout(() => {
      this.retries += 1;
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay,
      );

      this.connect();
    }, this.reconnectDelay);
  }

  disconnect() {
    this.clearHeartbeat();

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.setState("offline");
  }

  on(eventName: string, callback: (event: MessageEvent) => void) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    this.listeners.get(eventName)?.add(callback);
  }

  off(eventName: string, callback: (event: MessageEvent) => void) {
    this.listeners.get(eventName)?.delete(callback);
  }

  private emit(eventName: string, event: MessageEvent) {
    for (const callback of this.listeners.get(eventName) ?? []) {
      callback(event);
    }
  }

  get state() {
    return this.connectionState;
  }
}
