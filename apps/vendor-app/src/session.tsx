/**
 * Coordinates the vendor identity, query cache and realtime connection.
 * One lifecycle boundary keeps credentials and private results from surviving sign-out.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import * as Crypto from "expo-crypto";
import { AppState, Platform } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiClient, ApiError } from "@mystreetvendor/api-client";
import { apiOrigin, store } from "./auth-store";
import { stopDeviceSharing } from "./location/lifecycle";
import {
  RealtimeClient,
  type SocketLike,
} from "@mystreetvendor/api-client/src/realtime";
import {
  tokenSchema,
  userSchema,
  type User,
} from "@mystreetvendor/shared-types";

const role = "vendor" as const;

type Session = {
  client: ApiClient;
  realtime: RealtimeClient;
  user: User | null;
  ready: boolean;
  restoreError: string | null;
  connection: string;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  restore(): Promise<void>;
  reloadUser(): Promise<User>;
};
const Context = createContext<Session | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [connection, setConnection] = useState("disconnected");
  const socketRef = useRef<RealtimeClient | null>(null);
  const [queries] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (count, error) =>
              count < 1 && !(error instanceof ApiError && error.status < 500),
            staleTime: 10000,
          },
          mutations: { retry: false },
        },
      }),
  );
  const [client] = useState(
    () =>
      new ApiClient({
        baseUrl: apiOrigin,
        store,
        allowInsecureDevelopment: __DEV__,
        onSignedOut: async () => {
          // Sensor cleanup failures must not retain private account/query state.
          await stopDeviceSharing().catch(() => {});
          socketRef.current?.stop();
          // Cancel before clearing so a late request cannot repopulate private data.
          await queries.cancelQueries();
          queries.clear();
          setUser(null);
        },
      }),
  );
  const [realtime] = useState(
    () =>
      new RealtimeClient({
        baseUrl: apiOrigin,
        session: client,
        makeId: () => Crypto.randomUUID(),
        createSocket: (url) => new WebSocket(url) as unknown as SocketLike,
        onStatus: setConnection,
        onResync: () => {
          void queries.invalidateQueries();
        },
        onMessage: (message) => {
          if ("request_id" in message && message.request_id) {
            if (message.type !== "VENDOR_LOCATION_UPDATED") {
              queries.removeQueries({
                queryKey: ["tracking", message.request_id],
              });
            } else {
              void queries.invalidateQueries({
                queryKey: ["tracking", message.request_id],
              });
            }
          }
          void queries.invalidateQueries({ queryKey: ["visits"] });
          void queries.invalidateQueries({ queryKey: ["vendor"] });
        },
      }),
  );
  socketRef.current = realtime;
  const reloadUser = useCallback(async () => {
    const account = userSchema.parse(await client.request("/users/me"));
    if (account.role !== role) {
      try {
        await client.request("/auth/logout", { method: "POST" });
      } finally {
        await client.clearSession();
      }
      throw new Error("Use the application for your account type.");
    }
    setUser(account);
    return account;
  }, [client]);
  const restore = useCallback(async () => {
    setRestoreError(null);
    setReady(false);
    try {
      if (await client.session()) await reloadUser();
    } catch (error) {
      setRestoreError(
        error instanceof Error
          ? error.message
          : "Cannot restore your session. Try again.",
      );
    } finally {
      setReady(true);
    }
  }, [client, reloadUser]);
  useEffect(() => {
    void restore();
    return () => realtime.stop();
  }, [restore, realtime]);
  useEffect(() => {
    if (!user) return;
    void realtime.start();
    return () => realtime.stop();
  }, [user?.id, realtime]);
  useEffect(() => {
    if (!user || Platform.OS === "web") return;
    let mounted = true;
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        realtime.pause();
        return;
      }
      // Recheck the live account before reconnecting after a possibly long pause.
      void reloadUser()
        .then(() => {
          if (!mounted) return;
          void queries.invalidateQueries();
          void realtime.start();
        })
        .catch(() => {});
    });
    return () => {
      mounted = false;
      listener.remove();
    };
  }, [user?.id, reloadUser, realtime, queries]);
  async function signIn(email: string, password: string) {
    // A new family needs new sharing consent, including password reconfirmation.
    await stopDeviceSharing().catch(() => {});
    const tokens = tokenSchema.parse(
      await client.request("/auth/login", {
        method: "POST",
        authenticated: false,
        body: { email, password, device_name: "MyStreetVendor Partner" },
      }),
    );
    await client.setSession(tokens);
    await reloadUser();
  }
  async function signOut() {
    await stopDeviceSharing().catch(() => {});
    try {
      await client.request("/auth/logout", { method: "POST" });
    } finally {
      await client.clearSession();
    }
  }
  return (
    <QueryClientProvider client={queries}>
      <Context.Provider
        value={{
          client,
          realtime,
          user,
          ready,
          restoreError,
          connection,
          signIn,
          signOut,
          restore,
          reloadUser,
        }}
      >
        {children}
      </Context.Provider>
    </QueryClientProvider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Use the session provider.");
  return value;
}
