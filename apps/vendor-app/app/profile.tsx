import { Redirect } from "expo-router";
import { useSession } from "../src/session";
import { ProfileScreen } from "../src/features/profile/ProfileScreen";
import { Loading } from "../src/ui";
export default function ProfileRoute() {
  const { ready, user } = useSession();
  if (!ready) return <Loading />;
  return user ? <ProfileScreen /> : <Redirect href="/" />;
}
