import { Platform } from "react-native";
import Constants from "expo-constants";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { tokens } from "@mystreetvendor/design-tokens";
import type { AreaMapProps } from "./map-types";
import { Body } from "../ui";

export default function AreaMap({
  origin,
  pins,
  label = "Nearby map",
}: AreaMapProps) {
  if (
    Platform.OS === "android" &&
    !Constants.expoConfig?.extra?.androidMapsConfigured
  )
    return (
      <Body muted>
        Maps are unavailable in this build. You can still use the vendor list.
      </Body>
    );
  return (
    <MapView
      key={`${origin.latitude}:${origin.longitude}`}
      accessibilityLabel={label}
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      style={{ height: 300, width: "100%", borderRadius: 16 }}
      initialRegion={{ ...origin, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
    >
      <Marker coordinate={origin} title="Selected meeting point" />
      {pins.map((pin) => (
        <Circle
          key={pin.id}
          center={pin.point}
          radius={pin.radiusM ?? 20}
          strokeColor={tokens.color.primary}
          fillColor="#185C4220"
        />
      ))}
    </MapView>
  );
}
