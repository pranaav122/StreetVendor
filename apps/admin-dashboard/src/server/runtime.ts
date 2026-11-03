import "server-only";
import { AdminServer } from "./core";

const state = globalThis as typeof globalThis & {
  mystreetvendorAdmin?: AdminServer;
};
export function adminServer() {
  if (!state.mystreetvendorAdmin) {
    const environment = process.env.ADMIN_APP_ENV ?? process.env.NODE_ENV;
    const production = environment !== "development";
    if (
      production &&
      (!process.env.ADMIN_API_URL || !process.env.ADMIN_PUBLIC_ORIGIN)
    )
      throw new Error(
        "Production requires ADMIN_API_URL and ADMIN_PUBLIC_ORIGIN.",
      );
    const apiOrigin = process.env.ADMIN_API_URL ?? "http://127.0.0.1:8000";
    // Share one bounded registry across route bundles and development reloads.
    // This deployment intentionally runs one self-hosted Node process.
    state.mystreetvendorAdmin = new AdminServer({
      apiOrigin,
      publicOrigin: process.env.ADMIN_PUBLIC_ORIGIN ?? "http://127.0.0.1:3000",
      production,
      internalApiHttp: new URL(apiOrigin).protocol === "http:",
    });
  }
  return state.mystreetvendorAdmin;
}
