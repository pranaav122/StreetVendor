import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session";
import { SharingController, type Fix, type SharingState } from "./controller";
import { registerSharingCleanup } from "./lifecycle";

function point(value: Location.LocationObject): Fix {
  return {
    latitude: value.coords.latitude,
    longitude: value.coords.longitude,
    accuracy_m: value.coords.accuracy ?? Infinity,
    captured_at: new Date(value.timestamp).toISOString(),
  };
}
const Context = createContext<{
  controller: SharingController;
  state: SharingState;
} | null>(null);
export function SharingProvider({ children }: PropsWithChildren) {
  const { client, user } = useSession();
  const queries = useQueryClient();
  const [state, setState] = useState<SharingState>({
    status: "OFFLINE",
    message: null,
    capturedAt: null,
  });
  const [controller] = useState(
    () =>
      new SharingController({
        now: Date.now,
        changed: setState,
        first: async () => {
          const permission = await Location.requestForegroundPermissionsAsync();
          if (!permission.granted)
            throw new Error(
              "Location permission is required to go online. You can stay offline.",
            );
          return point(
            await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            }),
          );
        },
        watch: async (next) => {
          const subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 0,
            },
            (value) => next(point(value)),
          );
          return () => subscription.remove();
        },
        online: async (location) => {
          await client.request("/vendors/me/availability", {
            method: "PATCH",
            body: {
              is_available: true,
              location_sharing_enabled: true,
              location,
            },
          });
          await queries.invalidateQueries({ queryKey: ["vendor"] });
        },
        upload: async (location) => {
          await client.request("/vendors/me/location", {
            method: "PUT",
            body: location,
          });
        },
        offline: async () => {
          await client.request("/vendors/me/availability", {
            method: "PATCH",
            body: { is_available: false, location_sharing_enabled: false },
          });
          await queries.invalidateQueries({ queryKey: ["vendor"] });
        },
      }),
  );
  useEffect(
    () =>
      registerSharingCleanup(async () => {
        // Local sensors stop even when logout cannot reach the network.
        controller.pause();
      }),
    [controller],
  );
  useEffect(() => {
    if (!user) controller.pause();
    return () => controller.pause();
  }, [user?.id, controller]);
  useEffect(() => {
    const timer = setInterval(() => controller.checkFreshness(), 5000);
    return () => clearInterval(timer);
  }, [controller]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        if (
          controller.state.status === "ONLINE" ||
          controller.state.status === "DEGRADED" ||
          controller.state.status === "STARTING"
        )
          void controller.offline().catch(() => {});
      } else {
        // Returning to the foreground rechecks live permissions and account state.
        void Location.getForegroundPermissionsAsync().then((permission) => {
          if (!permission.granted)
            controller.pause(
              "Location permission was removed. Go online only after enabling it again.",
            );
        });
        void queries.invalidateQueries();
      }
    });
    return () => subscription.remove();
  }, [controller, queries]);
  return (
    <Context.Provider value={{ controller, state }}>
      {children}
    </Context.Provider>
  );
}
export function useSharing() {
  const value = useContext(Context);
  if (!value) throw new Error("Use the location sharing provider.");
  return value;
}
