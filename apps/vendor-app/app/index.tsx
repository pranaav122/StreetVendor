import { useSession } from "../src/session";
import { AuthScreen } from "../src/features/auth/AuthScreen";
import { DashboardScreen } from "../src/features/dashboard/DashboardScreen";
import { Loading } from "../src/ui";
export default function Home() {
  const { ready, user } = useSession();
  if (!ready) return <Loading label="Restoring session…" />;
  return user ? <DashboardScreen /> : <AuthScreen />;
}
