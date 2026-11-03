import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { extractRecoveryLink, type RecoveryKind } from "./recovery-link";

type Value = ReturnType<typeof extractRecoveryLink>;
const Context = createContext<{
  value: Value;
  readLink: (raw: string) => Value;
  clear: (token: string) => void;
} | null>(null);
export function RecoveryLinksProvider({ children }: PropsWithChildren) {
  const [value, setValue] = useState<Value>(() =>
    Platform.OS === "web" && typeof window !== "undefined"
      ? extractRecoveryLink(window.location.href)
      : null,
  );
  const readLink = useCallback((raw: string) => {
    const parsed = extractRecoveryLink(raw);
    setValue(parsed);
    return parsed;
  }, []);
  useEffect(() => {
    if (Platform.OS === "web") {
      if (new URLSearchParams(window.location.hash.slice(1)).has("token")) {
        // Preserve the router's history state while removing the consumed secret.
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.search,
        );
      }
      return;
    }
    // The root listener handles warm links; the initial URL covers cold launches.
    const listener = Linking.addEventListener("url", ({ url }) => {
      readLink(url);
    });
    let mounted = true;
    void Linking.getInitialURL().then((url) => {
      if (mounted && url) readLink(url);
    });
    return () => {
      mounted = false;
      listener.remove();
    };
  }, [readLink]);
  const clear = (token: string) =>
    setValue((current) => (current?.token === token ? null : current));
  return (
    <Context.Provider value={{ value, readLink, clear }}>
      {children}
    </Context.Provider>
  );
}
export function useRecoveryLink(kind: RecoveryKind) {
  const context = useContext(Context);
  if (!context) throw new Error("Use the recovery link provider.");
  return {
    ...context,
    token: context.value?.kind === kind ? context.value.token : null,
  };
}
