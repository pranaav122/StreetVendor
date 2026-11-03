import {
  parseServerMessage,
  type ServerMessage,
} from "@mystreetvendor/shared-types";

export interface SocketLike {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: (() => void) | null;
  send(raw: string): void;
  close(): void;
}
interface Config {
  baseUrl: string;
  session: {
    session(): Promise<{ access_token: string } | null>;
    refreshAccess(): Promise<string>;
  };
  createSocket: (url: string) => SocketLike;
  makeId: () => string;
  onMessage: (message: ServerMessage) => void;
  onResync: () => void;
  onStatus?: (status: "connecting" | "connected" | "disconnected") => void;
}

export class RealtimeClient {
  private readonly config: Config;
  private readonly url: string;
  private socket?: SocketLike;
  private running = false;
  private authenticated = false;
  private epoch = 0;
  private attempts = 0;
  private unauthorizedRetries = 0;
  private readonly subscriptions = new Set<string>();
  private heartbeat?: ReturnType<typeof setInterval>;
  private reconnect?: ReturnType<typeof setTimeout>;
  private reauthorize?: ReturnType<typeof setTimeout>;

  constructor(config: Config) {
    this.config = config;
    const url = new URL(config.baseUrl);
    if (
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      !["http:", "https:"].includes(url.protocol)
    )
      throw new Error("Use the configured API origin.");
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/api/v1/ws";
    this.url = url.toString();
  }
  subscribe(requestId: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        requestId,
      )
    )
      throw new Error("Use a valid request identifier.");
    if (this.subscriptions.size >= 10 && !this.subscriptions.has(requestId))
      throw new Error("Too many active tracking subscriptions.");
    this.subscriptions.add(requestId);
    this.send({ type: "SUBSCRIBE_REQUEST", request_id: requestId });
  }
  unsubscribe(requestId: string) {
    // Remove local authorization before a queued network message can be delivered.
    this.subscriptions.delete(requestId);
    this.send({ type: "UNSUBSCRIBE_REQUEST", request_id: requestId });
  }
  private send(message: Record<string, unknown>) {
    if (this.authenticated && this.socket?.readyState === 1)
      this.socket.send(JSON.stringify(message));
  }
  async start() {
    if (this.running) return;
    this.running = true;
    this.attempts = 0;
    this.unauthorizedRetries = 0;
    await this.connect();
  }
  private clearTimers() {
    clearInterval(this.heartbeat);
    clearTimeout(this.reconnect);
    clearTimeout(this.reauthorize);
    this.heartbeat = this.reconnect = this.reauthorize = undefined;
  }
  stop() {
    this.running = false;
    this.epoch++;
    this.authenticated = false;
    this.subscriptions.clear();
    this.clearTimers();
    if (this.socket) {
      this.socket.onopen =
        this.socket.onmessage =
        this.socket.onclose =
        this.socket.onerror =
          null;
      this.socket.close();
      this.socket = undefined;
    }
    this.config.onStatus?.("disconnected");
  }
  private async connect() {
    const epoch = ++this.epoch;
    this.config.onStatus?.("connecting");
    try {
      const session = await this.config.session.session();
      if (!this.running || epoch !== this.epoch) return;
      if (!session) {
        this.stop();
        return;
      }
      const socket = this.config.createSocket(this.url);
      this.socket = socket;
      socket.onopen = () => {
        if (!this.running || epoch !== this.epoch) return;
        // Tokens stay in a bounded frame instead of URLs that proxies may log.
        socket.send(
          JSON.stringify({
            type: "AUTHENTICATE",
            access_token: session.access_token,
          }),
        );
      };
      socket.onmessage = (event) => {
        if (
          !this.running ||
          epoch !== this.epoch ||
          typeof event.data !== "string"
        )
          return;
        const message = parseServerMessage(event.data);
        if (!message) return;
        if (message.type === "AUTHENTICATED") {
          this.authenticated = true;
          this.attempts = 0;
          this.unauthorizedRetries = 0;
          this.config.onStatus?.("connected");
          this.config.onResync();
          for (const request_id of this.subscriptions)
            this.send({ type: "SUBSCRIBE_REQUEST", request_id });
          clearInterval(this.heartbeat);
          this.heartbeat = setInterval(
            () => this.send({ type: "PING", id: this.config.makeId() }),
            25000,
          );
          const expires =
            typeof message.expires_at === "number"
              ? message.expires_at * 1000
              : Date.parse(message.expires_at);
          clearTimeout(this.reauthorize);
          this.reauthorize = setTimeout(
            () => {
              void this.renew(epoch);
            },
            Math.max(1000, expires - Date.now() - 30000),
          );
          return;
        }
        if (message.type === "RESYNC_REQUIRED") {
          this.config.onResync();
          return;
        }
        if (
          message.type === "PONG" ||
          message.type === "SUBSCRIBED_REQUEST" ||
          message.type === "UNSUBSCRIBED_REQUEST"
        )
          return;
        if (
          message.type === "VENDOR_LOCATION_UPDATED" &&
          message.request_id &&
          !this.subscriptions.has(message.request_id)
        )
          return;
        if (
          "request_id" in message &&
          message.request_id &&
          message.type !== "VENDOR_LOCATION_UPDATED" &&
          "data" in message &&
          "status" in message.data &&
          ["COMPLETED", "DECLINED", "CANCELLED", "EXPIRED"].includes(
            message.data.status,
          )
        )
          this.subscriptions.delete(message.request_id);
        this.config.onMessage(message);
      };
      socket.onerror = () => socket.close();
      socket.onclose = (event) => {
        void this.closed(epoch, event.code);
      };
    } catch {
      if (this.running && epoch === this.epoch) this.schedule();
    }
  }
  private async renew(epoch: number) {
    try {
      const access_token = await this.config.session.refreshAccess();
      if (this.running && epoch === this.epoch && this.socket?.readyState === 1)
        this.socket.send(
          JSON.stringify({ type: "AUTHENTICATE", access_token }),
        );
    } catch {
      if (this.running && epoch === this.epoch) this.socket?.close();
    }
  }
  private async closed(epoch: number, code: number) {
    if (!this.running || epoch !== this.epoch) return;
    this.authenticated = false;
    this.clearTimers();
    this.config.onStatus?.("disconnected");
    if (code === 4401) {
      if (this.unauthorizedRetries++ >= 1) return;
      try {
        await this.config.session.refreshAccess();
      } catch {
        return;
      }
    }
    if (this.running && epoch === this.epoch) this.schedule();
  }
  private schedule() {
    this.config.onStatus?.("disconnected");
    if (!this.running || this.attempts >= 8) return;
    const delay = Math.min(30000, 1000 * 2 ** this.attempts++);
    this.reconnect = setTimeout(() => {
      void this.connect();
    }, delay);
  }
}
