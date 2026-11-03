import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { ApiClient } from "@mystreetvendor/api-client";
import { apiOrigin, readBackgroundSession } from "../auth-store";
import {
  processBackgroundFixes,
  sessionIdentity,
  type Consent,
} from "./background-policy";
import type { Fix } from "./controller";

const task = "mystreetvendor-partner-latest-location";
const key = "mystreetvendor.vendor.location-consent";
const statusKey = `${key}.status`;
let running = false;
export function locationFix(value: Location.LocationObject): Fix {
  return {
    latitude: value.coords.latitude,
    longitude: value.coords.longitude,
    accuracy_m: value.coords.accuracy ?? Infinity,
    captured_at: new Date(value.timestamp).toISOString(),
  };
}
export async function readBackgroundConsent(): Promise<Consent | null> {
  if (Platform.OS === "web") return null;
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (
      typeof value.userId !== "string" ||
      typeof value.familyId !== "string" ||
      typeof value.nonce !== "string" ||
      !Number.isFinite(value.startedAt)
    )
      return null;
    const status = JSON.parse(
      (await SecureStore.getItemAsync(statusKey)) ?? "null",
    );
    if (status?.nonce === value.nonce)
      return {
        ...value,
        lastCapturedAt: status.lastCapturedAt,
        lastAttemptAt: status.lastAttemptAt,
      } as Consent;
    return value as Consent;
  } catch {
    return null;
  }
}
async function saveConsent(consent: Consent) {
  await SecureStore.setItemAsync(key, JSON.stringify(consent), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}
export async function stopBackgroundSharing(nonce?: string) {
  if (Platform.OS === "web") return;
  // Ignore cleanup for consent already replaced by a new online action.
  if (nonce && (await readBackgroundConsent())?.nonce !== nonce) return;
  try {
    await SecureStore.deleteItemAsync(key);
  } finally {
    // A keychain error must not skip the operating-system sensor cleanup.
    if (await Location.hasStartedLocationUpdatesAsync(task))
      await Location.stopLocationUpdatesAsync(task);
  }
}
export async function allowBackgroundSharing() {
  if (Platform.OS === "web" || !(await TaskManager.isAvailableAsync()))
    throw new Error(
      "Background location needs a native development build. Browser sharing works while this screen stays open.",
    );
  if (
    !(await Location.requestForegroundPermissionsAsync()).granted ||
    !(await Location.requestBackgroundPermissionsAsync()).granted
  )
    throw new Error(
      "Background permission was not granted. You can use foreground sharing instead.",
    );
}
export async function startBackgroundSharing() {
  if (!(await Location.getBackgroundPermissionsAsync()).granted)
    throw new Error("Background location permission is required.");
  const tokens = await readBackgroundSession();
  const identity = tokens ? sessionIdentity(tokens.access_token) : null;
  if (!identity || identity.expiresAt <= Date.now())
    throw new Error("Sign in again before starting background sharing.");
  const consent: Consent = {
    userId: identity.userId,
    familyId: identity.familyId,
    nonce: Crypto.randomUUID(),
    startedAt: Date.now(),
  };
  await saveConsent(consent);
  try {
    await Location.startLocationUpdatesAsync(task, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 0,
      deferredUpdatesInterval: 5000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "MyStreetVendor location sharing",
        notificationBody:
          "Your business is online. Open Partner to go offline.",
        killServiceOnDestroy: true,
      },
    });
  } catch (error) {
    await stopBackgroundSharing(consent.nonce);
    throw error;
  }
  return consent.nonce;
}

// Module-scope registration also runs when the OS launches a headless callback.
if (Platform.OS !== "web")
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    task,
    async ({ data, error }) => {
      if (running) return;
      running = true;
      try {
        const consent = await readBackgroundConsent();
        if (error) {
          await stopBackgroundSharing(consent?.nonce);
          return;
        }
        const tokens = await readBackgroundSession();
        const client = new ApiClient({
          baseUrl: apiOrigin,
          allowInsecureDevelopment: __DEV__,
          refreshOnUnauthorized: false,
          store: {
            read: async () => tokens,
            write: async () => {
              throw new Error("Headless credentials are read-only.");
            },
            clear: async () => {
              throw new Error("Headless credentials are read-only.");
            },
          },
        });
        await processBackgroundFixes({
          now: Date.now(),
          consent,
          access: tokens?.access_token ?? null,
          fixes: (data?.locations ?? []).map(locationFix),
          stop: () => stopBackgroundSharing(consent?.nonce),
          send: async (fix) => {
            if (
              !consent ||
              (await readBackgroundConsent())?.nonce !== consent.nonce
            )
              return;
            // Status is separate from consent: an old task must never recreate consent
            // after foreground logout deletes it. Old-nonce status is ignored.
            await SecureStore.setItemAsync(
              statusKey,
              JSON.stringify({
                nonce: consent.nonce,
                lastAttemptAt: Date.now(),
                lastCapturedAt: consent.lastCapturedAt,
              }),
            );
            await client.request("/vendors/me/location", {
              method: "PUT",
              body: fix,
            });
            if ((await readBackgroundConsent())?.nonce === consent.nonce)
              await SecureStore.setItemAsync(
                statusKey,
                JSON.stringify({
                  nonce: consent.nonce,
                  lastAttemptAt: Date.now(),
                  lastCapturedAt: fix.captured_at,
                }),
              );
          },
        });
      } catch {
        // OS callbacks must finish on storage/network failure; no coordinates are logged.
      } finally {
        running = false;
      }
    },
  );
