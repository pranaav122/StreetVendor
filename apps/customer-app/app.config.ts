import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "MyStreetVendor",
  slug: "mystreetvendor-customer",
  scheme: "mystreetvendor-customer",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "com.mystreetvendor.customer",
    supportsTablet: true,
  },
  android: { package: "com.mystreetvendor.customer" },
  web: { bundler: "metro", output: "single" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    "expo-notifications",
    "expo-status-bar",
    ...(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      ? [
          [
            "react-native-maps",
            {
              androidGoogleMapsApiKey:
                process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
            },
          ] as [string, Record<string, string>],
        ]
      : []),
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Use your location to choose a public meeting point. You can also choose it manually.",
      },
    ],
  ],
  // EAS ownership is supplied by the owner; a fabricated project UUID cannot enable push.
  extra: {
    ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
      : {}),
    androidMapsConfigured: Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY),
  },
};
export default config;
