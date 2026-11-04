/**
 * Checks consent, session identity and location fixes before a background send.
 * Keeping this policy separate from Expo callbacks lets tests exercise it without an OS task.
 */
import { usableFix, type Fix } from "./controller";
export type Consent = {
  userId: string;
  familyId: string;
  nonce: string;
  startedAt: number;
  lastCapturedAt?: string;
  lastAttemptAt?: number;
};
export function sessionIdentity(access: string) {
  try {
    const encoded = access.split(".")[1];
    if (!encoded || encoded.length > 8192) return null;
    // This is an identity hint for local consent, not signature verification.
    // The backend still verifies the JWT and live session for every write.
    const claims = JSON.parse(
      atob(encoded.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (
      typeof claims.sub !== "string" ||
      typeof claims.sid !== "string" ||
      !Number.isFinite(claims.exp)
    )
      return null;
    return {
      userId: claims.sub as string,
      familyId: claims.sid as string,
      expiresAt: (claims.exp * 1000) as number,
    };
  } catch {
    return null;
  }
}
export async function processBackgroundFixes(options: {
  now: number;
  consent: Consent | null;
  access: string | null;
  fixes: Fix[];
  send(fix: Fix): Promise<void>;
  stop(): Promise<void>;
}) {
  const { consent, now } = options;
  const identity = options.access ? sessionIdentity(options.access) : null;
  if (
    !consent ||
    !identity ||
    consent.userId !== identity.userId ||
    consent.familyId !== identity.familyId ||
    identity.expiresAt <= now
  ) {
    await options.stop();
    return;
  }
  if (now - (consent.lastAttemptAt ?? -Infinity) < 5000) return;
  const newest = options.fixes
    .slice(-100)
    .filter(
      (fix) =>
        usableFix(fix, now) &&
        Date.parse(fix.captured_at) >= consent.startedAt &&
        Date.parse(fix.captured_at) >
          Date.parse(consent.lastCapturedAt ?? "1970-01-01"),
    )
    .sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at))[0];
  if (!newest) return;
  try {
    await options.send(newest);
  } catch (error) {
    if ([401, 403, 409].includes((error as { status?: number }).status ?? 0))
      await options.stop();
    // Connectivity errors are not queued: a later callback must supply a new fix.
  }
}
