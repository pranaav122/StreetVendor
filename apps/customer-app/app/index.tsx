import { useSession } from "../src/session";
import { AuthScreen } from "../src/features/auth/AuthScreen";
import { NearbyScreen } from "../src/features/discovery/NearbyScreen";
import { Loading } from "../src/ui";

export default function Home() {
  const { ready, user } = useSession();
  if (!ready) return <Loading label="Restoring session…" />;
  return user ? <NearbyScreen /> : <AuthScreen />;
}
