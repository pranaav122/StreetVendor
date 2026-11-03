import { tokenSchema, type TokenPair } from "@mystreetvendor/shared-types";

export type { TokenPair } from "@mystreetvendor/shared-types";
export interface SessionStore {
  read(): Promise<TokenPair | null>;
  write(tokens: TokenPair): Promise<void>;
  clear(): Promise<void>;
}
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
type Options = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  authenticated?: boolean;
};
type Config = {
  baseUrl: string;
  store: SessionStore;
  fetch?: typeof fetch;
  onSignedOut?: () => void | Promise<void>;
  allowInsecureDevelopment?: boolean;
  refreshOnUnauthorized?: boolean;
};

export class ApiClient {
  private readonly origin: string;
  private readonly store: SessionStore;
  private readonly transport: typeof fetch;
  private readonly onSignedOut?: Config["onSignedOut"];
  private current: TokenPair | null = null;
  private loaded = false;
  private loading?: Promise<void>;
  // Generation changes identify sign-in/sign-out, not ordinary token rotations.
  private generation = 0;
  private refreshPromise?: Promise<TokenPair>;
  private persistence: Promise<void> = Promise.resolve();
  private readonly refreshOnUnauthorized: boolean;

  constructor(config: Config) {
    const url = new URL(config.baseUrl);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      !["https:", "http:"].includes(url.protocol)
    )
      throw new Error("Use an API origin without a path or credentials.");
    if (url.protocol !== "https:" && !config.allowInsecureDevelopment)
      throw new Error(
        "The API must use HTTPS outside explicit local development.",
      );
    this.origin = url.origin;
    this.store = config.store;
    // Browsers require the Window receiver when native fetch is stored as a method.
    this.transport = (config.fetch ?? globalThis.fetch).bind(globalThis);
    this.onSignedOut = config.onSignedOut;
    this.refreshOnUnauthorized = config.refreshOnUnauthorized !== false;
  }
  private persist(operation: () => Promise<void>) {
    const pending = this.persistence.catch(() => {}).then(operation);
    this.persistence = pending;
    return pending;
  }
  private async load() {
    if (this.loaded) return;
    if (!this.loading) {
      const generation = this.generation;
      this.loading = (async () => {
        const saved = await this.store.read();
        if (generation !== this.generation) return;
        const parsed = tokenSchema.safeParse(saved);
        this.current = parsed.success ? parsed.data : null;
        this.loaded = true;
        if (saved && !parsed.success)
          await this.persist(() => this.store.clear());
      })().finally(() => {
        this.loading = undefined;
      });
    }
    await this.loading;
  }
  async session() {
    await this.load();
    return this.current;
  }
  async refreshAccess() {
    await this.load();
    return (await this.refresh()).access_token;
  }
  async setSession(value: TokenPair) {
    const tokens = tokenSchema.parse(value);
    const generation = ++this.generation;
    this.current = tokens;
    this.loaded = true;
    try {
      await this.persist(() => this.store.write(tokens));
    } catch (error) {
      // A late failure belongs to that sign-in, not an account selected since.
      if (generation === this.generation) await this.clearSession();
      throw error;
    }
  }
  async clearSession() {
    this.generation++;
    this.current = null;
    this.loaded = true;
    try {
      await this.persist(() => this.store.clear());
    } finally {
      await this.onSignedOut?.();
    }
  }
  private changed() {
    return new ApiError(401, "SESSION_CHANGED", "Sign in to continue.");
  }

  private async send(path: string, options: Options, access?: string) {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (options.body !== undefined)
      headers.set("Content-Type", "application/json");
    if (access) headers.set("Authorization", `Bearer ${access}`);
    else headers.delete("Authorization");
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.throwIfAborted();
    options.signal?.addEventListener("abort", abort, { once: true });
    const deadline = setTimeout(() => controller.abort(), 15000);
    try {
      return await this.transport(`${this.origin}/api/v1${path}`, {
        method: options.method ?? "GET",
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(deadline);
      options.signal?.removeEventListener("abort", abort);
    }
  }
  private async decode<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new ApiError(
        response.status,
        "INVALID_RESPONSE",
        "The server returned an unreadable response.",
      );
    }
    if (!response.ok) {
      const body = value as { error?: { code?: unknown; message?: unknown } };
      throw new ApiError(
        response.status,
        typeof body?.error?.code === "string"
          ? body.error.code
          : "REQUEST_FAILED",
        typeof body?.error?.message === "string"
          ? body.error.message
          : "The request could not be completed.",
      );
    }
    return value as T;
  }
  private async refresh() {
    if (this.refreshPromise) return this.refreshPromise;
    const generation = this.generation,
      previous = this.current;
    if (!previous) throw this.changed();
    const operation = (async () => {
      const response = await this.send("/auth/refresh", {
        method: "POST",
        body: { refresh_token: previous.refresh_token },
        authenticated: false,
      });
      if (generation !== this.generation) throw this.changed();
      if (response.status === 401 || response.status === 403) {
        await this.clearSession();
        throw this.changed();
      }
      const tokens = tokenSchema.parse(await this.decode<unknown>(response));
      if (generation !== this.generation) throw this.changed();
      this.current = tokens;
      await this.persist(() => this.store.write(tokens));
      if (generation !== this.generation) throw this.changed();
      return tokens;
    })();
    this.refreshPromise = operation;
    try {
      return await operation;
    } finally {
      if (this.refreshPromise === operation) this.refreshPromise = undefined;
    }
  }
  async request<T>(path: string, options: Options = {}): Promise<T> {
    // An absolute or protocol-relative URL must never receive a bearer token.
    if (
      !/^\/[a-z][a-z0-9/-]*(?:\?[^#]*)?$/i.test(path) ||
      path.startsWith("//") ||
      path.includes("..")
    )
      throw new Error("Use a relative API path.");
    const authenticated = options.authenticated !== false;
    if (authenticated) await this.load();
    const generation = this.generation;
    const sent = this.current;
    if (authenticated && !sent) throw this.changed();
    let response = await this.send(
      path,
      options,
      authenticated ? sent?.access_token : undefined,
    );
    if (authenticated && generation !== this.generation) throw this.changed();
    // Headless runtimes cannot share the foreground refresh lock. They must
    // leave shared credentials untouched and let the foreground renew them.
    if (
      authenticated &&
      response.status === 401 &&
      this.refreshOnUnauthorized
    ) {
      // A delayed 401 may belong to the token another request already replaced.
      const tokens =
        this.current?.access_token !== sent?.access_token
          ? this.current
          : await this.refresh();
      options.signal?.throwIfAborted();
      if (!tokens || generation !== this.generation) throw this.changed();
      response = await this.send(path, options, tokens.access_token);
      if (generation !== this.generation) throw this.changed();
      if (response.status === 401) {
        await this.clearSession();
        throw this.changed();
      }
    }
    const result = await this.decode<T>(response);
    if (authenticated && generation !== this.generation) throw this.changed();
    return result;
  }
}
