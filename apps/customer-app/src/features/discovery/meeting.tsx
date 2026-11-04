/**
 * Keeps the selected public meeting point in memory for the current account.
 * Discovery and request screens share this choice without persisting private coordinates.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import type { Point } from "@mystreetvendor/shared-types";
import { useSession } from "../../session";

export type Meeting = { point: Point; label: string };
const Context = createContext<{
  meeting: Meeting | null;
  setMeeting: (value: Meeting | null) => void;
} | null>(null);
export function MeetingProvider({ children }: PropsWithChildren) {
  const { user } = useSession();
  const [saved, setSaved] = useState<{
    owner: string | undefined;
    value: Meeting | null;
  }>({ owner: undefined, value: null });
  const meeting = saved.owner === user?.id ? saved.value : null;
  const setMeeting = (value: Meeting | null) =>
    setSaved({ owner: user?.id, value });
  // Meeting choices stay in memory and do not cross account boundaries.
  useEffect(() => {
    setSaved({ owner: user?.id, value: null });
  }, [user?.id]);
  return (
    <Context.Provider value={{ meeting, setMeeting }}>
      {children}
    </Context.Provider>
  );
}
export function useMeeting() {
  const value = useContext(Context);
  if (!value) throw new Error("Use the meeting provider.");
  return value;
}
