import { Redirect, router } from "expo-router";
import { useSession } from "../src/session";
import { Body, Button, Loading, Page } from "../src/ui";
export default function AccountRoute() {
  const { ready, user, signOut } = useSession();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/" />;
  return (
    <Page title="Your account">
      <Body>{user.email}</Body>
      <Button
        label="Sign out"
        onPress={() => {
          void signOut().finally(() => router.replace("/"));
        }}
      />
    </Page>
  );
}
