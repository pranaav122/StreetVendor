import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "MyStreetVendor Partner",
  slug: "mystreetvendor-partner",
  scheme: "mystreetvendor-partner",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: { bundleIdentifier: "com.mystreetvendor.partner", supportsTablet: true },
  android: { package: "com.mystreetvendor.partner" },
  web: { bundler: "metro", output: "single" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    "expo-notifications",
    "expo-status-bar",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Share your vendor location only while you choose to be online.",
        locationAlwaysAndWhenInUsePermission:
          "Keep your vendor location current during an online session, including when the app is in the background.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
  ],
  extra: process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
    : {},
};
export default config;
