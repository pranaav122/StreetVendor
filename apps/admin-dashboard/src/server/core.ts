import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import {
  ApiClient,
  ApiError,
  type TokenPair,
} from "@mystreetvendor/api-client";
import {
  tokenSchema,
  userSchema,
  type User,
} from "@mystreetvendor/shared-types";

type Config = {
  apiOrigin: string;
  publicOrigin: string;
  production: boolean;
  internalApiHttp?: boolean;
  maxSessions?: number;
  now?: () => number;
  fetch?: typeof fetch;
};
type Entry = { key: string; client: ApiClient; expiresAt: number };
const lifetime = 8 * 3600;
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const writePath = new RegExp(
  `^/(?:admin/vendors/${uuid}/(?:verification|suspension|reinstatement)|admin/users/${uuid}/suspension|admin/reports/${uuid}/resolution|admin/requests/${uuid}/cancel)$`,
  "i",
);
const inspectPath = new RegExp(`^/requests/${uuid}$`, "i");
const profilePath = new RegExp(`^/vendors/${uuid}$`, "i");
const loginSchema = z
  .object({
    email: z.string().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

async function jsonBody(request: Request, maximum: number) {
  if (
    request.headers.get("Content-Type")?.split(";")[0]?.trim() !==
    "application/json"
  )
    throw new ApiError(415, "JSON_REQUIRED", "Send JSON for this action.");
  if (Number(request.headers.get("Content-Length")) > maximum)
    throw new ApiError(
      413,
      "BODY_TOO_LARGE",
      "The submitted form is too large.",
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new ApiError(400, "INVALID_FORM", "Check the submitted form.");
  let size = 0,
    expired = false;
  const chunks: Uint8Array[] = [];
  // Bound both chunked input and a stalled sender before parsing/forwarding JSON.
  const timer = setTimeout(() => {
    expired = true;
    void reader.cancel().catch(() => {});
  }, 5000);
  try {
    while (true) {
      const next = await reader.read();
      if (expired)
        throw new ApiError(
          408,
          "BODY_TIMEOUT",
          "The form took too long to arrive.",
        );
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new ApiError(
          413,
          "BODY_TOO_LARGE",
          "The submitted form is too large.",
        );
      }
      chunks.push(next.value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    } catch {
      throw new ApiError(400, "INVALID_FORM", "Check the submitted form.");
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export class AdminServer {
  private readonly sessions = new Map<string, Entry>();
  private readonly origin: string;
  private readonly name: string;
  private readonly now: () => number;
  constructor(private readonly config: Config) {
    const api = new URL(config.apiOrigin);
    if (
      api.username ||
      api.password ||
      api.pathname !== "/" ||
      api.search ||
      api.hash ||
      !["http:", "https:"].includes(api.protocol)
    )
      throw new Error("Configure an API origin without a path or credentials.");
    // HTTP is permitted only on explicitly selected local/container links, never
    // as a fallback for sending staff credentials to a public plaintext service.
    if (
      api.protocol === "http:" &&
      (!config.internalApiHttp ||
        !["api", "localhost", "127.0.0.1", "[::1]"].includes(api.hostname))
    )
      throw new Error("HTTP API transport requires an explicit private host.");
    const origin = new URL(config.publicOrigin);
    if (
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      !["http:", "https:"].includes(origin.protocol)
    )
      throw new Error(
        "Configure an admin origin without a path or credentials.",
      );
    if (config.production && origin.protocol !== "https:")
      throw new Error("Production administration requires HTTPS.");
    if (
      !config.production &&
      !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    )
      throw new Error("Development administration must use a loopback origin.");
    this.origin = origin.origin;
    this.name = config.production ? "__Host-msv_admin" : "msv_admin";
    this.now = config.now ?? Date.now;
    if (
      !Number.isInteger(config.maxSessions ?? 256) ||
      (config.maxSessions ?? 256) < 1 ||
      (config.maxSessions ?? 256) > 256
    )
      throw new Error("Use a staff session limit between 1 and 256.");
  }
  private cookie(value: string, remove = false) {
    return `${this.name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${remove ? 0 : lifetime}${this.config.production ? "; Secure" : ""}`;
  }
  private response(value: unknown, status = 200, cookie?: string) {
    const headers = new Headers({
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    });
    if (cookie) headers.set("Set-Cookie", cookie);
    if (status === 204) return new Response(null, { status, headers });
    return Response.json(value, { status, headers });
  }
  private rawCookie(request: Request) {
    const values = (request.headers.get("Cookie") ?? "")
      .split(";")
      .map((value) => value.trim())
      .filter((value) => value.startsWith(`${this.name}=`));
    if (values.length !== 1) return null;
    const raw = values[0]!.slice(this.name.length + 1);
    return /^[A-Za-z0-9_-]{43}$/.test(raw) ? raw : null;
  }
  private lookup(request: Request) {
    const raw = this.rawCookie(request);
    if (!raw) return null;
    const entry = this.sessions.get(digest(raw));
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.sessions.delete(entry.key);
      void entry.client.clearSession().catch(() => {});
      return null;
    }
    return entry;
  }
  private originCheck(request: Request) {
    // SameSite is additional protection; an exact configured Origin also stops
    // login CSRF and requests from another subdomain on the same site.
    if (request.headers.get("Origin") !== this.origin)
      throw new ApiError(
        403,
        "ORIGIN_DENIED",
        "Open this form from the administration site.",
      );
  }
  private failure(error: unknown, request: Request, clear = false) {
    const known = error instanceof ApiError;
    const status = known ? error.status : 502;
    const raw = this.rawCookie(request);
    const expired =
      raw && !this.sessions.has(digest(raw)) && [401, 403].includes(status);
    return this.response(
      {
        error: {
          code: known ? error.code : "API_UNAVAILABLE",
          message: known ? error.message : "The API is unavailable. Try again.",
        },
      },
      status,
      clear || expired ? this.cookie("", true) : undefined,
    );
  }
  private async release(entry: Entry) {
    // Remove local authority before awaiting revocation, including network failures.
    this.sessions.delete(entry.key);
    try {
      await entry.client.request("/auth/logout", { method: "POST" });
    } finally {
      await entry.client.clearSession();
    }
  }
  private async liveUser(entry: Entry): Promise<User> {
    const user = userSchema.parse(await entry.client.request("/users/me"));
    if (user.role !== "admin" || user.status !== "ACTIVE") {
      await this.release(entry).catch(() => {});
      throw new ApiError(
        403,
        "ADMIN_REQUIRED",
        "An active operator account is required.",
      );
    }
    return user;
  }
  private prune() {
    for (const entry of this.sessions.values())
      if (entry.expiresAt <= this.now()) {
        this.sessions.delete(entry.key);
        void entry.client.clearSession().catch(() => {});
      }
  }
  private async signIn(request: Request) {
    const parsed = loginSchema.safeParse(await jsonBody(request, 4096));
    if (!parsed.success)
      throw new ApiError(
        400,
        "INVALID_FORM",
        "Enter a valid email and password.",
      );
    // Production Node has no public port. Caddy overwrites this private header
    // with its peer address; browser X-Forwarded-For is never used as identity.
    const clientAddress = this.config.production
      ? request.headers.get("X-Msv-Client-IP")
      : null;
    if (this.config.production && (!clientAddress || !isIP(clientAddress)))
      throw new ApiError(
        503,
        "PROXY_IDENTITY_REQUIRED",
        "The administration proxy needs operator attention.",
      );
    const raw = randomBytes(32).toString("base64url"),
      key = digest(raw);
    let saved: TokenPair | null = null;
    const client = new ApiClient({
      baseUrl: this.config.apiOrigin,
      fetch: this.config.fetch,
      allowInsecureDevelopment: this.config.internalApiHttp === true,
      store: {
        read: async () => saved,
        write: async (value) => {
          saved = value;
        },
        clear: async () => {
          saved = null;
        },
      },
      onSignedOut: () => {
        this.sessions.delete(key);
      },
    });
    const entry = { key, client, expiresAt: this.now() + lifetime * 1000 };
    try {
      await client.setSession(
        tokenSchema.parse(
          await client.request("/auth/login", {
            method: "POST",
            authenticated: false,
            // The API trusts this container's reserved address only. Keeping
            // client identities separate preserves its existing abuse limits.
            headers: clientAddress
              ? { "X-Forwarded-For": clientAddress }
              : undefined,
            body: {
              ...parsed.data,
              device_name: "MyStreetVendor administration",
            },
          }),
        ),
      );
      const user = await this.liveUser(entry);
      const previous = this.lookup(request);
      if (previous) await this.release(previous).catch(() => {});
      this.prune();
      // Check and insert together after authentication: concurrent logins cannot
      // pass a capacity check made before a network await.
      if (this.sessions.size >= (this.config.maxSessions ?? 256))
        throw new ApiError(
          503,
          "SESSIONS_FULL",
          "The staff session limit is reached. Try again later.",
        );
      this.sessions.set(key, entry);
      return this.response({ user }, 200, this.cookie(raw));
    } catch (error) {
      // Failed role checks/capacity must not leave a newly issued family in use.
      if (await client.session()) await this.release(entry).catch(() => {});
      throw error;
    }
  }
  async session(request: Request): Promise<Response> {
    try {
      if (request.method === "POST") {
        this.originCheck(request);
        return await this.signIn(request);
      }
      if (request.method === "DELETE") {
        this.originCheck(request);
        const entry = this.lookup(request);
        try {
          if (entry) await this.release(entry);
        } catch (error) {
          return this.failure(error, request, true);
        }
        return this.response(null, 204, this.cookie("", true));
      }
      if (request.method !== "GET")
        return this.response(
          {
            error: {
              code: "METHOD_DENIED",
              message: "This method is unavailable.",
            },
          },
          405,
        );
      const entry = this.lookup(request);
      if (!entry)
        throw new ApiError(
          401,
          "SIGN_IN_REQUIRED",
          "Sign in to administration.",
        );
      return this.response({ user: await this.liveUser(entry) });
    } catch (error) {
      return this.failure(error, request);
    }
  }
  private target(request: Request, segments: string[]) {
    const path = `/${segments.join("/")}`;
    const url = new URL(request.url);
    const list = ["/admin/verifications", "/admin/reports"].includes(path);
    const allowed =
      request.method === "GET"
        ? list ||
          path === "/admin/summary" ||
          inspectPath.test(path) ||
          profilePath.test(path)
        : request.method === "POST" && writePath.test(path);
    // Never expose auth/token endpoints or turn staff cookies into an open proxy.
    if (!allowed)
      throw new ApiError(
        403,
        "PATH_DENIED",
        "This staff action is unavailable.",
      );
    const permittedKeys = list ? ["status", "limit", "cursor"] : [];
    for (const key of url.searchParams.keys())
      if (
        !permittedKeys.includes(key) ||
        url.searchParams.getAll(key).length !== 1
      )
        throw new ApiError(400, "INVALID_QUERY", "Check the list filters.");
    if (list) {
      const status = url.searchParams.get("status"),
        limit = url.searchParams.get("limit"),
        cursor = url.searchParams.get("cursor");
      const statuses =
        path === "/admin/reports"
          ? ["OPEN", "RESOLVED"]
          : ["PENDING", "VERIFIED", "REJECTED"];
      if (
        (status && !statuses.includes(status)) ||
        (limit && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit)) ||
        (cursor && !z.string().uuid().safeParse(cursor).success)
      )
        throw new ApiError(400, "INVALID_QUERY", "Check the list filters.");
    }
    return path + url.search;
  }
  async backend(request: Request, segments: string[]): Promise<Response> {
    try {
      if (request.method !== "GET") this.originCheck(request);
      const path = this.target(request, segments);
      const entry = this.lookup(request);
      if (!entry)
        throw new ApiError(
          401,
          "SIGN_IN_REQUIRED",
          "Sign in to administration.",
        );
      await this.liveUser(entry);
      let body: unknown;
      if (request.method === "POST") {
        body = await jsonBody(request, 16384);
        if (!z.record(z.string(), z.unknown()).safeParse(body).success)
          throw new ApiError(400, "INVALID_FORM", "Check the submitted form.");
      }
      const data = await entry.client.request(path, {
        method: request.method,
        body,
        signal: request.signal,
      });
      return this.response(data);
    } catch (error) {
      return this.failure(error, request);
    }
  }
}
