import { Redirect } from "expo-router";
import { useSession } from "../src/session";
import { AccountScreen } from "../src/features/account/AccountScreen";
import { Loading } from "../src/ui";

export default function AccountRoute() {
  const { user, ready } = useSession();
  if (!ready) return <Loading />;
  return user ? <AccountScreen /> : <Redirect href="/" />;
}
