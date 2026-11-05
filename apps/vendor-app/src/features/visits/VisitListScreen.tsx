import { useState } from "react";
import { Link } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { activeVisitStatuses, visitSchema } from "@mystreetvendor/shared-types";
import { useSession } from "../../session";
import { useCopy } from "../../language";
import {
  Body,
  Button,
  Card,
  Loading,
  Page,
  Problem,
  errorMessage,
} from "../../ui";

const pageSchema = z.object({
  items: z.array(visitSchema),
  next_cursor: z.string().nullable(),
});
export function VisitListScreen() {
  const { client } = useSession();
  const { language, text } = useCopy();
  const [history, setHistory] = useState(false);
  const visits = useInfiniteQuery({
    queryKey: ["visits", "list"],
    initialPageParam: null as string | null,
    queryFn: async ({ signal, pageParam }) =>
      pageSchema.parse(
        await client.request(
          `/requests?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
          { signal },
        ),
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: 10000,
  });
  const items = (visits.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (visit) =>
      history
        ? !activeVisitStatuses.has(visit.status)
        : activeVisitStatuses.has(visit.status),
  );
  return (
    <Page title="Customer visits">
      <Button
        label="Active visits"
        secondary={history}
        onPress={() => setHistory(false)}
      />
      <Button
        label="History"
        secondary={!history}
        onPress={() => setHistory(true)}
      />
      {visits.isPending ? <Loading /> : null}
      <Problem message={visits.error ? errorMessage(visits.error) : null} />
      {visits.isSuccess && items.length === 0 ? (
        <Body copy>
          {history
            ? "No past visits in the loaded results."
            : "No active visits in the loaded results."}
        </Body>
      ) : null}
      {items.map((visit) => (
        <Card key={visit.id}>
          <Body>{visit.customer_name}</Body>
          <Body muted>
            {text(`Visit ${visit.status.toLowerCase()}`)} ·{" "}
            {new Date(visit.created_at).toLocaleString(
              language === "ta" ? "ta-IN" : "en-IN",
            )}
          </Body>
          <Link href={`/visit/${visit.id}`}>{text("View visit")}</Link>
        </Card>
      ))}
      {visits.hasNextPage ? (
        <Button
          label="Load more visits"
          disabled={visits.isFetchingNextPage}
          onPress={() => {
            void visits.fetchNextPage();
          }}
        />
      ) : null}
      <Button
        label="Refresh visits"
        secondary
        disabled={visits.isFetching}
        onPress={() => {
          void visits.refetch();
        }}
      />
    </Page>
  );
}
