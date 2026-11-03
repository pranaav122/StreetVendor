import { ApiError } from "@mystreetvendor/api-client";
export type Options = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};
export type StaffRequest = (
  path: string,
  options?: Options,
) => Promise<unknown>;
export async function cookieRequest(path: string, options: Options = {}) {
  // Form data stays on this origin; only the server chooses the backend target.
  if (!path.startsWith("/api/") || path.includes(".."))
    throw new Error("Use a local administration API path.");
  const deadline = AbortSignal.timeout(20000);
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: options.signal
      ? AbortSignal.any([deadline, options.signal])
      : deadline,
    headers: {
      Accept: "application/json",
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 204) return undefined;
  let value;
  try {
    value = await response.json();
  } catch {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "The server returned an unexpected response. Try again.",
    );
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof value?.error?.code === "string"
        ? value.error.code
        : "REQUEST_FAILED",
      typeof value?.error?.message === "string"
        ? value.error.message
        : "The request could not be completed.",
    );
  return value as unknown;
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to complete this action. Try again.";
}
