export type RecoveryKind = "reset-password" | "verify-email";
export function extractRecoveryLink(
  raw: string,
): { kind: RecoveryKind; token: string } | null {
  try {
    const url = new URL(raw);
    if (
      ![
        "http:",
        "https:",
        "exp:",
        "exps:",
        "mystreetvendor-customer:",
      ].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.searchParams.has("token")
    )
      return null;
    const segments = url.pathname.split("/").filter(Boolean);
    const path =
      segments.at(-1) ??
      (url.protocol === "mystreetvendor-customer:" ? url.hostname : "");
    if (path !== "reset-password" && path !== "verify-email") return null;
    // Query parameters travel to servers and proxies. Only the fragment is read.
    const values = new URLSearchParams(url.hash.slice(1)).getAll("token");
    const token = values[0];
    if (values.length !== 1 || !token || !/^[-_A-Za-z0-9]{32,256}$/.test(token))
      return null;
    return { kind: path, token };
  } catch {
    return null;
  }
}
