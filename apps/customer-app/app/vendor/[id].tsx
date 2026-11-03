import { Redirect, useLocalSearchParams } from "expo-router";
import { z } from "zod";
import { useSession } from "../../src/session";
import { VendorScreen } from "../../src/features/vendors/VendorScreen";
import { Loading, Page, Problem } from "../../src/ui";
export default function VendorRoute() {
  const { ready, user } = useSession();
  const { id } = useLocalSearchParams();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/" />;
  const parsed = z.string().uuid().safeParse(id);
  return parsed.success ? (
    <VendorScreen id={parsed.data} />
  ) : (
    <Page title="Vendor">
      <Problem message="Invalid vendor link." />
    </Page>
  );
}
