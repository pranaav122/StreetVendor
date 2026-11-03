import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
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
import { ownBusiness } from "../profile/queries";
const summarySchema = z.object({
  active_visits: z.number().int().nonnegative(),
  pending_visits: z.number().int().nonnegative(),
  completed_visits_today: z.number().int().nonnegative(),
  day_timezone: z.literal("Asia/Kolkata"),
});
export function DashboardScreen() {
  const { client } = useSession();
  const { text } = useCopy();
  const profile = useQuery({
    queryKey: ["vendor", "own"],
    queryFn: ({ signal }) => ownBusiness(client, signal),
    refetchInterval: 10000,
  });
  const summary = useQuery({
    queryKey: ["vendor", "summary", profile.data?.id],
    enabled: Boolean(profile.data),
    queryFn: async ({ signal }) =>
      summarySchema.parse(
        await client.request("/vendors/me/summary", { signal }),
      ),
    refetchInterval: 10000,
  });
  if (profile.isPending)
    return (
      <Page title="Your business today">
        <Loading />
      </Page>
    );
  if (profile.error)
    return (
      <Page title="Your business today">
        <Problem message={errorMessage(profile.error)} />
        <Button
          label="Retry"
          onPress={() => {
            void profile.refetch();
          }}
        />
      </Page>
    );
  const row = profile.data;
  return (
    <Page title="Your business today">
      {!row ? (
        <Card>
          <Body copy>
            Create your business profile to request staff review.
          </Body>
          <Link href="/profile">{text("Open business profile")}</Link>
        </Card>
      ) : (
        <>
          <Card>
            <Body>{row.display_name}</Body>
            <Body>
              {text("Review status")}: {text(row.verification_status)}
            </Body>
            {row.verification_status === "PENDING" ? (
              <Body copy>
                Your business needs staff approval before going online.
              </Body>
            ) : null}
            {row.verification_status === "REJECTED" ? (
              <Body copy>
                Your business was not approved. Update your profile and request
                another review.
              </Body>
            ) : null}
            {row.verification_status === "SUSPENDED" ? (
              <Body copy>
                Your business is suspended. Contact the operator before sharing
                again.
              </Body>
            ) : null}
          </Card>
          <Card>
            <Body copy>
              {row.is_available
                ? "Your business is online. This device has not started location updates."
                : "You are offline. Your location is not being shared."}
            </Body>
            {row.verification_status === "VERIFIED" ? (
              <Body copy>
                Set up location sharing on this device before going online.
              </Body>
            ) : null}
          </Card>
          {summary.data ? (
            <Card>
              <Body>
                {text("Active visits")}: {summary.data.active_visits}
              </Body>
              <Body>
                {text("Pending visits")}: {summary.data.pending_visits}
              </Body>
              <Body>
                {text("Completed visits today")}:{" "}
                {summary.data.completed_visits_today}
              </Body>
              <Body copy muted>
                Visit counts are not sales or earnings. The day uses India time.
              </Body>
            </Card>
          ) : null}
          <Problem
            message={summary.error ? errorMessage(summary.error) : null}
          />
          <Button
            label="Refresh business"
            secondary
            onPress={() => {
              void profile.refetch();
              void summary.refetch();
            }}
          />
        </>
      )}
    </Page>
  );
}
