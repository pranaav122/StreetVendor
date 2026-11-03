import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createSessionStore } from "@mystreetvendor/api-client/src/storage";
import { tokenSchema } from "@mystreetvendor/shared-types";
const sessionKey = "mystreetvendor.vendor.session";
export async function readBackgroundSession() {
  if (Platform.OS === "web") return null;
  const raw = await SecureStore.getItemAsync(sessionKey);
  if (!raw) return null;
  // Unlike foreground recovery, headless reads never erase corrupt credentials:
  // a foreground login may have replaced them while this read was in flight.
  try {
    const parsed = tokenSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export const apiOrigin =
  process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
export const store = createSessionStore(
  Platform.OS === "web"
    ? null
    : {
        getItem: (key) => SecureStore.getItemAsync(key),
        setItem: (key, value) =>
          SecureStore.setItemAsync(key, value, {
            // Authorized background work needs access after unlock, without keychain migration.
            keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
          }),
        removeItem: (key) => SecureStore.deleteItemAsync(key),
      },
  sessionKey,
);
