/**
 * Connects the sharing controller to Expo sensors, the API and React lifecycle.
 * Screens request online/offline actions here instead of creating competing location watchers.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import { useQueryClient } from "@tanstack/react-query";
import { vendorSchema } from "@mystreetvendor/shared-types";
import { useSession } from "../session";
import { SharingController, type Fix, type SharingState } from "./controller";
import { registerSharingCleanup } from "./lifecycle";
import { revalidateSharing } from "./resume";
import {
  allowBackgroundSharing,
  startBackgroundSharing,
  stopBackgroundSharing,
  readBackgroundConsent,
} from "./background";

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
  background: boolean;
  enableBackground(): Promise<void>;
} | null>(null);
export function SharingProvider({ children }: PropsWithChildren) {
  const { client, user } = useSession();
  const queries = useQueryClient();
  const backgroundRef = useRef(false);
  const [background, setBackground] = useState(false);
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
          // A cold app launch may inherit an OS task from the prior process.
          // Replace it before starting a new feed, so only one sensor publishes.
          await stopBackgroundSharing();
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
          if (backgroundRef.current) {
            const nonce = await startBackgroundSharing();
            return () => {
              void stopBackgroundSharing(nonce).catch(() => {});
            };
          }
          const subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 0,
            },
            (value) => next(point(value)),
            (message) => controller.pause(message),
          );
          return () => subscription.remove();
        },
        online: async (location) => {
          const generation = controller.generation;
          const response = await client.request("/vendors/me/availability", {
            method: "PATCH",
            body: {
              is_available: true,
              location_sharing_enabled: true,
              location,
            },
          });
          if (generation !== controller.generation) return;
          queries.setQueryData(["vendor", "own"], vendorSchema.parse(response));
          await queries.invalidateQueries({ queryKey: ["vendor"] });
        },
        upload: async (location) => {
          await client.request("/vendors/me/location", {
            method: "PUT",
            body: location,
          });
        },
        offline: async () => {
          const generation = controller.generation;
          await stopBackgroundSharing();
          if (generation !== controller.generation) return;
          const response = await client.request("/vendors/me/availability", {
            method: "PATCH",
            body: { is_available: false, location_sharing_enabled: false },
          });
          if (generation !== controller.generation) return;
          // This is the committed PATCH response, usable even if the next GET fails.
          queries.setQueryData(["vendor", "own"], vendorSchema.parse(response));
          await queries.invalidateQueries({ queryKey: ["vendor"] });
        },
      }),
  );
  useEffect(
    () =>
      registerSharingCleanup(async () => {
        // Local sensors stop even when logout cannot reach the network.
        controller.pause();
        await stopBackgroundSharing();
      }),
    [controller],
  );
  useEffect(() => {
    if (!user) controller.pause("");
    return () => controller.pause("");
  }, [user?.id, controller]);
  useEffect(() => {
    const timer = setInterval(() => {
      controller.checkFreshness();
      if (backgroundRef.current)
        void readBackgroundConsent()
          .then((consent) => {
            if (consent?.lastCapturedAt)
              controller.confirmExternalFix(consent.lastCapturedAt);
            else if (!consent && controller.state.status === "ONLINE")
              controller.pause(
                "Background sharing paused. Check your account and go online again.",
              );
          })
          .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [controller]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background" && !backgroundRef.current) {
        if (
          controller.state.status === "ONLINE" ||
          controller.state.status === "DEGRADED"
        )
          void controller.offline().catch(() => {});
      } else if (next === "active") {
        void revalidateSharing({
          controller,
          requiresBackground: backgroundRef.current,
          permissions: async () => ({
            foreground: (await Location.getForegroundPermissionsAsync())
              .granted,
            background:
              backgroundRef.current &&
              (await Location.getBackgroundPermissionsAsync()).granted,
          }),
          business: async () =>
            vendorSchema.parse(await client.request("/vendors/me")),
          disableBackground: () => {
            backgroundRef.current = false;
            setBackground(false);
          },
        });
        void queries.invalidateQueries();
      }
    });
    return () => subscription.remove();
  }, [controller, queries, client]);
  return (
    <Context.Provider
      value={{
        controller,
        state,
        background,
        enableBackground: async () => {
          await allowBackgroundSharing();
          backgroundRef.current = true;
          setBackground(true);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSharing() {
  const value = useContext(Context);
  if (!value) throw new Error("Use the location sharing provider.");
  return value;
}
