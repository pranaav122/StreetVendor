import { useState } from "react";
import { View } from "react-native";
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
  const [section, setSection] = useState<"New" | "Active" | "Past">("New");
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
  // These are views of loaded server records; pagination still reaches older requests.
  const items = (visits.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (visit) => {
      if (section === "New") return visit.status === "PENDING";
      if (section === "Active")
        return (
          visit.status !== "PENDING" && activeVisitStatuses.has(visit.status)
        );
      return !activeVisitStatuses.has(visit.status);
    },
  );
  const emptyMessages = {
    New: "No new requests in the loaded results.",
    Active: "No active visits in the loaded results.",
    Past: "No past visits in the loaded results.",
  };
  return (
    <Page title="Customer visits">
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["New", "Active", "Past"] as const).map((label) => (
          <View key={label} style={{ flex: 1, minWidth: 0 }}>
            <Button
              label={label}
              selected={section === label}
              secondary={section !== label}
              onPress={() => setSection(label)}
            />
          </View>
        ))}
      </View>
      {visits.isPending ? <Loading /> : null}
      <Problem message={visits.error ? errorMessage(visits.error) : null} />
      {visits.isSuccess && items.length === 0 ? (
        <Body copy>{emptyMessages[section]}</Body>
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
