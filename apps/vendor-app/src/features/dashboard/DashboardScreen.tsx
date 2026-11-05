import { useState, type ReactElement } from "react";
import { Link, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { activeVisitStatuses, visitSchema } from "@mystreetvendor/shared-types";
import { useSession } from "../../session";
import { useCopy } from "../../language";
import {
  Body,
  Button,
  Card,
  Disclosure,
  Loading,
  Page,
  Problem,
  errorMessage,
} from "../../ui";
import { ownBusiness } from "../profile/queries";
import { useSharing } from "../../location/provider";
import type { SharingState } from "../../location/controller";

const summarySchema = z.object({
  active_visits: z.number().int().nonnegative(),
  pending_visits: z.number().int().nonnegative(),
  completed_visits_today: z.number().int().nonnegative(),
  day_timezone: z.literal("Asia/Kolkata"),
});
const recentSchema = z.object({ items: z.array(visitSchema) });

function sharingMessage(state: SharingState, available: boolean): string {
  if (state.status === "STOPPING") return "Stopping location sharing…";
  if (state.status === "STARTING") return "Getting your location…";
  if (state.status === "ONLINE")
    return "Location sharing is active on this device.";
  if (state.status === "DEGRADED")
    return "Location updates are interrupted. Retry sharing or go offline.";
  if (state.status === "PAUSED")
    return "Checking your location permission and account.";
  if (available)
    return "Your business is online. This device has not started location updates.";
  return "You are offline. Your location is not being shared.";
}

/** Shows availability and the next customer; device sharing remains owned by its controller. */
export function DashboardScreen(): ReactElement {
  const { client } = useSession();
  const { text } = useCopy();
  const { controller, state, background, enableBackground } = useSharing();
  const changing = state.status === "STARTING" || state.status === "STOPPING";
  const [backgroundProblem, setBackgroundProblem] = useState<string | null>(
    null,
  );
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
  // This is a recent sample, not the whole inbox; Customers retains pagination.
  const recent = useQuery({
    queryKey: ["visits", "recent"],
    enabled: Boolean(profile.data),
    queryFn: async ({ signal }) =>
      recentSchema.parse(await client.request("/requests?limit=5", { signal })),
    refetchInterval: 10000,
  });
  // Even an unreadable business state can hide a stored OS task: always retain a stop action.
  const offlineControl = (
    <Button
      label={state.status === "STOPPING" ? "Going offline…" : "Go offline"}
      disabled={state.status === "STOPPING"}
      secondary={state.status !== "ONLINE"}
      onPress={() => {
        void controller.offline().catch(() => {});
      }}
    />
  );
  if (profile.isPending)
    return (
      <Page title="Your business today">
        <Loading />
        {offlineControl}
      </Page>
    );
  if (profile.error && !profile.data)
    return (
      <Page title="Your business today">
        <Problem message={errorMessage(profile.error)} />
        <Problem message={state.message} />
        {offlineControl}
        <Button
          label="Retry"
          secondary
          onPress={() => {
            void profile.refetch();
          }}
        />
      </Page>
    );
  const row = profile.data;
  if (!row)
    return (
      <Page title="Set up your shop">
        <Body copy>Create your business profile to request staff review.</Body>
        <Button
          label="Set up my shop"
          onPress={() => router.push("/profile")}
        />
        <Disclosure title="Location settings">{offlineControl}</Disclosure>
      </Page>
    );
  const approved = row.verification_status === "VERIFIED";
  // Only a confirmed offline state can tuck the redundant stop control into settings.
  const needsStop =
    row.is_available || state.status !== "OFFLINE" || Boolean(profile.error);
  const requests =
    recent.data?.items.filter((visit) =>
      activeVisitStatuses.has(visit.status),
    ) ?? [];
  return (
    <Page title={row.display_name} translateTitle={false}>
      <Problem
        message={
          profile.error
            ? "Business status could not refresh. Check your connection; you can still go offline."
            : null
        }
      />
      {!approved ? (
        <>
          {!["PENDING", "REJECTED", "SUSPENDED"].includes(
            row.verification_status,
          ) ? (
            <Body copy>
              Save your shop details, then send them for approval.
            </Body>
          ) : null}
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
          <Link href="/profile">{text("Open business profile")}</Link>
        </>
      ) : null}
      <Body copy>{sharingMessage(state, row.is_available)}</Body>
      <Problem message={state.message} />
      {approved && state.status !== "ONLINE" ? (
        <>
          <Button
            label={
              state.status === "STARTING"
                ? "Getting your location…"
                : "Go online"
            }
            disabled={changing}
            onPress={() => {
              void controller.online().catch(() => {});
            }}
          />
          <Body copy muted>
            Your exact location is shared only with an accepted customer visit.
            Nearby searches show an approximate area.
          </Body>
        </>
      ) : null}
      {needsStop ? offlineControl : null}
      <Body copy>Recent customer requests</Body>
      {recent.isPending ? <Loading label="Loading visits…" /> : null}
      <Problem message={recent.error ? errorMessage(recent.error) : null} />
      {recent.isSuccess && requests.length === 0 ? (
        <Body copy muted>
          No recent active visits. Check Customers for older visits.
        </Body>
      ) : null}
      {requests.map((visit) => (
        <Card key={visit.id}>
          <Body>{visit.customer_name}</Body>
          <Body copy>{`Visit ${visit.status.toLowerCase()}`}</Body>
          <Link href={`/visit/${visit.id}`}>{text("View visit")}</Link>
        </Card>
      ))}
      <Link href="/visits">{text("View all customer visits")}</Link>
      {summary.data ? (
        <Body>
          {text("Completed visits today")}:{" "}
          {summary.data.completed_visits_today}
        </Body>
      ) : null}
      <Problem message={summary.error ? errorMessage(summary.error) : null} />
      <Disclosure title="Location settings">
        <Body copy>
          {background
            ? "Background sharing is enabled for your next online session. It pauses when access expires; open Partner and go online again. Phone settings can stop updates."
            : "Keep this screen open for foreground location updates. Background sharing requires a native development build and separate permission."}
        </Body>
        {approved ? (
          <Button
            label="Allow background location"
            secondary
            disabled={background || changing || state.status === "ONLINE"}
            onPress={() => {
              setBackgroundProblem(null);
              void enableBackground().catch((error) =>
                setBackgroundProblem(errorMessage(error)),
              );
            }}
          />
        ) : null}
        <Problem message={backgroundProblem} />
        {!needsStop ? offlineControl : null}
      </Disclosure>
      <Disclosure title="Today’s visit summary">
        {summary.data ? (
          <>
            <Body>
              {text("Active visits")}: {summary.data.active_visits}
            </Body>
            <Body>
              {text("Pending visits")}: {summary.data.pending_visits}
            </Body>
            <Body copy muted>
              Visit counts are not sales or earnings. The day uses India time.
            </Body>
          </>
        ) : null}
      </Disclosure>
      <Button
        label="Refresh business"
        secondary
        onPress={() => {
          void profile.refetch();
          void summary.refetch();
          void recent.refetch();
        }}
      />
    </Page>
  );
}
