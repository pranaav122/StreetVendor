/**
 * Keeps a visit retry tied to its original intent and checks tracking freshness.
 * These rules stay independent of React so retries and stale positions can be tested directly.
 */
import type { LocationFix, Point } from "@mystreetvendor/shared-types";

export class VisitIntent {
  private fingerprint = "";
  private key = "";
  private readonly makeId: () => string;
  constructor(makeId: () => string) {
    this.makeId = makeId;
  }
  prepare(vendorId: string, meeting: { point: Point; label: string }) {
    const body = {
      vendor_id: vendorId,
      meeting_point: { ...meeting.point },
      meeting_label: meeting.label,
    };
    const fingerprint = JSON.stringify(body);
    // Preserve an uncertain network attempt's identity; a new page is a new intent.
    if (this.fingerprint !== fingerprint) {
      this.fingerprint = fingerprint;
      this.key = this.makeId();
    }
    return { key: this.key, body };
  }
}
export function locationTimestampFresh(timestamp: string, now = Date.now()) {
  const captured = Date.parse(timestamp);
  return (
    Number.isFinite(captured) &&
    captured >= now - 90000 &&
    captured <= now + 30000
  );
}
export function trackingFresh(fix: LocationFix, now = Date.now()) {
  return (
    locationTimestampFresh(fix.captured_at, now) &&
    Number.isFinite(fix.accuracy_m) &&
    fix.accuracy_m >= 0 &&
    fix.accuracy_m <= 100
  );
}
