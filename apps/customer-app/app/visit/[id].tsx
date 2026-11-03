import { Redirect, useLocalSearchParams } from "expo-router";
import { z } from "zod";
import { useSession } from "../../src/session";
import { VisitScreen } from "../../src/features/visits/VisitScreen";
import { Loading, Page, Problem } from "../../src/ui";
export default function VisitRoute() {
  const { ready, user } = useSession();
  const { id } = useLocalSearchParams();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/" />;
  const parsed = z.string().uuid().safeParse(id);
  return parsed.success ? (
    <VisitScreen id={parsed.data} />
  ) : (
    <Page title="Visit">
      <Problem message="Invalid visit link." />
    </Page>
  );
}
