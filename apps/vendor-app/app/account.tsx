import { Redirect } from "expo-router";
import { useSession } from "../src/session";
import { Loading } from "../src/ui";
import { AccountScreen } from "../src/features/account/AccountScreen";
export default function AccountRoute() {
  const { ready, user } = useSession();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/" />;
  return <AccountScreen />;
}
