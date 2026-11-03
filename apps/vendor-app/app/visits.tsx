import { Redirect } from "expo-router";
import { useSession } from "../src/session";
import { VisitListScreen } from "../src/features/visits/VisitListScreen";
import { Loading } from "../src/ui";
export default function VisitsRoute() {
  const { ready, user } = useSession();
  if (!ready) return <Loading />;
  return user ? <VisitListScreen /> : <Redirect href="/" />;
}
