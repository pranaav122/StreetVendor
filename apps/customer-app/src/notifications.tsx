import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { z } from "zod";
import type { ApiClient } from "@mystreetvendor/api-client";
import {
  registerInstallation,
  type PushDriver,
} from "@mystreetvendor/api-client/src/devices";
import { visitSchema } from "@mystreetvendor/shared-types";
import { useSession } from "./session";

let showForegroundAlerts = false;
if (Platform.OS !== "web")
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: showForegroundAlerts,
      shouldShowList: showForegroundAlerts,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
const nativeBuild =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const project =
  Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
const driver: PushDriver = {
  platform:
    Platform.OS === "ios"
      ? "ios"
      : Platform.OS === "android"
        ? "android"
        : "web",
  physical: Device.isDevice,
  nativeBuild,
  projectId: typeof project === "string" ? project : null,
  async permission(ask) {
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("default", {
        name: "Visits",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    const current = await Notifications.getPermissionsAsync();
    return (
      current.granted ||
      (ask ? (await Notifications.requestPermissionsAsync()).granted : false)
    );
  },
  async token(projectId) {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  },
  async installation() {
    const key = "mystreetvendor.customer.installation";
    const current = await SecureStore.getItemAsync(key);
    const parsed = z.string().uuid().safeParse(current);
    if (parsed.success) return parsed.data;
    const value = Crypto.randomUUID();
    // Keep one installation across account changes; the API clears old-owner jobs.
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    return value;
  },
};
export function enableNotifications(client: ApiClient, askPermission = true) {
  return registerInstallation(client, driver, "customer", askPermission);
}

export function NotificationLifecycle() {
  const { client, user } = useSession();
  useEffect(() => {
    if (!user || Platform.OS === "web" || !Device.isDevice || !nativeBuild) {
      showForegroundAlerts = false;
      return;
    }
    let active = true;
    showForegroundAlerts = true;
    const seen = new Set<string>();
    const refresh = () => {
      void enableNotifications(client, false).catch(() => {});
    };
    async function open(response: Notifications.NotificationResponse) {
      const data = response.notification.request.content.data;
      const requestId = z.string().uuid().safeParse(data?.request_id);
      const notificationId = z.string().uuid().safeParse(data?.notification_id);
      if (
        !active ||
        !requestId.success ||
        !notificationId.success ||
        seen.has(notificationId.data)
      )
        return;
      try {
        // A notification may outlive sign-out or ownership transfer. REST decides access.
        visitSchema.parse(await client.request(`/requests/${requestId.data}`));
        if (!active) return;
        seen.add(notificationId.data);
        if (seen.size > 100) seen.delete(seen.values().next().value!);
        router.push(`/visit/${requestId.data}`);
      } catch {
        /* Expired or another account's alerts cannot open private visit details. */
      } finally {
        await Notifications.clearLastNotificationResponseAsync();
      }
    }
    refresh();
    const tokens = Notifications.addPushTokenListener(refresh);
    const responses = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void open(response).catch(() => {});
      },
    );
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) void open(response).catch(() => {});
      })
      .catch(() => {});
    return () => {
      active = false;
      showForegroundAlerts = false;
      tokens.remove();
      responses.remove();
    };
  }, [client, user]);
  return null;
}
