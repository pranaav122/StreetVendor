/**
 * Runs location-sharing state using injected sensor and network operations.
 * Generations invalidate old callbacks so a late upload cannot undo a newer offline decision.
 */
export type Fix = {
  latitude: number;
  longitude: number;
  accuracy_m: number;
  captured_at: string;
};
export type SharingState = {
  status:
    "OFFLINE" | "STARTING" | "STOPPING" | "ONLINE" | "PAUSED" | "DEGRADED";
  message: string | null;
  capturedAt: string | null;
};
type Driver = {
  now(): number;
  first(): Promise<Fix>;
  watch(next: (fix: Fix) => void): Promise<() => void>;
  online(fix: Fix): Promise<void>;
  upload(fix: Fix): Promise<void>;
  offline(): Promise<void>;
  changed(state: SharingState): void;
};
export function usableFix(fix: Fix, now: number) {
  const captured = Date.parse(fix.captured_at);
  return (
    Number.isFinite(fix.latitude) &&
    Math.abs(fix.latitude) <= 90 &&
    Number.isFinite(fix.longitude) &&
    Math.abs(fix.longitude) <= 180 &&
    Number.isFinite(fix.accuracy_m) &&
    fix.accuracy_m >= 0 &&
    fix.accuracy_m <= 100 &&
    Number.isFinite(captured) &&
    now - captured <= 90000 &&
    captured - now <= 30000
  );
}
export class SharingController {
  state: SharingState = { status: "OFFLINE", message: null, capturedAt: null };
  private epoch = 0;
  private stop?: () => void;
  private starting?: Promise<void>;
  private stopping?: Promise<void>;
  private uploading?: Promise<void>;
  private lastAttempt = -Infinity;
  constructor(private readonly driver: Driver) {}
  get generation() {
    return this.epoch;
  }
  private change(
    status: SharingState["status"],
    message: string | null = null,
    capturedAt = this.state.capturedAt,
  ) {
    this.state = { status, message, capturedAt };
    this.driver.changed(this.state);
  }
  online() {
    if (this.stopping)
      return Promise.reject(
        new Error("Wait for offline confirmation before going online again."),
      );
    if (this.starting) return this.starting;
    if (this.state.status === "ONLINE") return Promise.resolve();
    this.stop?.();
    this.stop = undefined;
    const epoch = ++this.epoch;
    this.change("STARTING", null, null);
    const operation = this.start(epoch);
    this.starting = operation;
    void operation
      .finally(() => {
        if (this.starting === operation) this.starting = undefined;
      })
      .catch(() => {});
    return operation;
  }
  private async start(epoch: number) {
    let published = false;
    try {
      const fix = await this.driver.first();
      if (epoch !== this.epoch) return;
      if (!usableFix(fix, this.driver.now()))
        throw new Error("Wait for an accurate, recent location and try again.");
      await this.driver.online(fix);
      published = true;
      if (epoch !== this.epoch) return;
      // Some sensors invoke their callback before subscription setup resolves.
      // The first fix is already committed; do not publish it a second time.
      this.lastAttempt = this.driver.now();
      this.change("STARTING", null, fix.captured_at);
      const stop = await this.driver.watch((next) => {
        void this.upload(next, epoch);
      });
      if (epoch !== this.epoch) {
        stop();
        return;
      }
      this.stop = stop;
      this.change("ONLINE", null, fix.captured_at);
    } catch (error) {
      if (published) await this.driver.offline().catch(() => {});
      if (epoch === this.epoch)
        this.change(
          "PAUSED",
          error instanceof Error
            ? error.message
            : "Location sharing could not start.",
          null,
        );
      throw error;
    }
  }
  private async upload(fix: Fix, epoch: number) {
    if (
      epoch !== this.epoch ||
      this.uploading ||
      !usableFix(fix, this.driver.now())
    )
      return;
    // Drop intermediate fixes instead of storing a route or replaying old GPS.
    if (
      this.driver.now() - this.lastAttempt < 5000 ||
      Date.parse(fix.captured_at) <= Date.parse(this.state.capturedAt ?? "")
    )
      return;
    this.lastAttempt = this.driver.now();
    const operation = this.driver.upload(fix);
    this.uploading = operation;
    try {
      await operation;
      if (epoch === this.epoch) this.change("ONLINE", null, fix.captured_at);
    } catch (error) {
      if (epoch !== this.epoch) return;
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403 || status === 409) {
        this.pause("Sharing paused. Check your account and go online again.");
      } else
        this.change(
          "DEGRADED",
          "Location update failed. Check your connection; stale points are hidden.",
        );
    } finally {
      if (this.uploading === operation) this.uploading = undefined;
    }
  }
  pause(message = "Location sharing paused on this device.") {
    this.epoch++;
    this.stop?.();
    this.stop = undefined;
    this.change("PAUSED", message, null);
  }
  async resumeAfterValidation(generation: number) {
    // Finish canceled writes before requesting a new first fix. A newer user
    // choice (including offline) wins over this delayed resume operation.
    await Promise.allSettled([this.starting, this.uploading]);
    if (generation !== this.epoch || this.state.status !== "PAUSED") return;
    const restarting = this.online();
    const epoch = this.epoch;
    try {
      await restarting;
    } catch (error) {
      // Validation can succeed while fresh GPS subsequently fails. Attempt
      // erasure of the old server point without stopping a newer consent epoch.
      if (epoch === this.epoch) await this.offline().catch(() => {});
      throw error;
    }
  }
  checkFreshness() {
    if (
      this.state.status === "ONLINE" &&
      this.state.capturedAt &&
      this.driver.now() - Date.parse(this.state.capturedAt) > 90000
    ) {
      this.change(
        "DEGRADED",
        "No recent location update. Stale points are hidden; check location and connection.",
      );
    }
  }
  confirmExternalFix(capturedAt: string) {
    if (
      (this.state.status === "ONLINE" || this.state.status === "DEGRADED") &&
      Date.parse(capturedAt) >
        Date.parse(this.state.capturedAt ?? "1970-01-01") &&
      this.driver.now() - Date.parse(capturedAt) <= 90000 &&
      Date.parse(capturedAt) - this.driver.now() <= 30000
    )
      this.change("ONLINE", null, capturedAt);
  }
  offline() {
    if (this.stopping) return this.stopping;
    // Stop the sensor immediately, then order deletion after any in-flight write.
    this.pause();
    this.change("STOPPING", null, null);
    const operation = this.stopOnServer(this.epoch);
    this.stopping = operation;
    void operation
      .finally(() => {
        if (this.stopping === operation) this.stopping = undefined;
      })
      .catch(() => {});
    return operation;
  }
  private async stopOnServer(epoch: number) {
    await Promise.allSettled([this.starting, this.uploading]);
    if (epoch !== this.epoch) return;
    try {
      await this.driver.offline();
      if (epoch !== this.epoch) return;
      this.change("OFFLINE", null, null);
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.change(
        "PAUSED",
        "Device sharing stopped. Server offline confirmation failed; retry going offline.",
        null,
      );
      throw error;
    }
  }
}
