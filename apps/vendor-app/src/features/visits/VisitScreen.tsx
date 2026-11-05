import { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activeVisitStatuses,
  trackableVisitStatuses,
  visitSchema,
  type Visit,
} from "@mystreetvendor/shared-types";
import { useSession } from "../../session";
import { useCopy } from "../../language";
import {
  Body,
  Button,
  Card,
  Field,
  Disclosure,
  Loading,
  Page,
  Problem,
  errorMessage,
} from "../../ui";

type Action = Visit["allowed_actions"][number];
const labels: Record<Action, string> = {
  accept: "Accept visit",
  decline: "Decline visit",
  approach: "I’m on my way",
  complete: "Complete visit",
  cancel: "Confirm cancellation",
};
export function VisitScreen({ id }: { id: string }) {
  const { client } = useSession();
  const { text, language } = useCopy();
  const queries = useQueryClient();
  const [reason, setReason] = useState("");
  const [mapProblem, setMapProblem] = useState<string | null>(null);
  const [report, setReport] = useState("");
  const [category, setCategory] = useState<"SAFETY" | "NO_SHOW" | "OTHER">(
    "OTHER",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const visit = useQuery({
    queryKey: ["visits", id],
    queryFn: async ({ signal }) =>
      visitSchema.parse(await client.request(`/requests/${id}`, { signal })),
    refetchInterval: (query) =>
      query.state.data && activeVisitStatuses.has(query.state.data.status)
        ? 5000
        : false,
  });
  useEffect(() => {
    // A new committed version is a new decision: never reuse a reason from an older state.
    setReason("");
  }, [visit.data?.version]);
  const change = useMutation({
    mutationFn: async (action: Action) => {
      const row = visit.data;
      if (!row || !row.allowed_actions.includes(action))
        throw new Error("Refresh this visit before changing it.");
      if ((action === "decline" || action === "cancel") && !reason.trim())
        throw new Error("Enter a reason before declining or cancelling.");
      return visitSchema.parse(
        await client.request(`/requests/${id}/${action}`, {
          method: "POST",
          body: {
            expected_version: row.version,
            ...(action === "decline" || action === "cancel"
              ? { reason: reason.trim() }
              : {}),
          },
        }),
      );
    },
    onSuccess: (row) => {
      // Display only committed server state; an action never advances optimistically.
      queries.setQueryData(["visits", id], row);
      setReason("");
      void queries.invalidateQueries({ queryKey: ["visits"] });
      void queries.invalidateQueries({ queryKey: ["vendor"] });
    },
    onError: () => {
      void visit.refetch();
    },
  });
  const sendReport = useMutation({
    mutationFn: async () => {
      if (report.trim().length < 10)
        throw new Error("Use at least 10 characters to describe the problem.");
      return client.request(`/requests/${id}/reports`, {
        method: "POST",
        body: { category, reason: report.trim() },
      });
    },
    onSuccess: () => {
      setNotice("Report sent.");
      setReport("");
    },
  });
  if (visit.isPending)
    return (
      <Page title="Visit">
        <Loading />
      </Page>
    );
  if (visit.error)
    return (
      <Page title="Visit">
        <Problem message={errorMessage(visit.error)} />
        <Button
          label="Retry visit"
          onPress={() => {
            void visit.refetch();
          }}
        />
      </Page>
    );
  const row = visit.data;
  const meeting = trackableVisitStatuses.has(row.status)
    ? row.meeting_point
    : null;
  async function openMaps() {
    if (!meeting) return;
    setMapProblem(null);
    const destination = `${meeting.latitude},${meeting.longitude}`;
    const url =
      Platform.OS === "ios"
        ? `https://maps.apple.com/?daddr=${destination}&dirflg=w`
        : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      setMapProblem(errorMessage(error));
    }
  }
  const reasonAction = row.allowed_actions.find(
    (action) => action === "decline" || action === "cancel",
  );
  const mainActions = row.allowed_actions.filter(
    (action) => action !== "decline" && action !== "cancel",
  );
  return (
    <Page title={`Visit ${row.status.toLowerCase()}`}>
      <Card>
        <Body>{row.customer_name}</Body>
        <Body>
          {text("Meeting point")}:{" "}
          {row.meeting_label ?? text("Selected public point")}
        </Body>
        <Body muted>
          {text("Deadline")}:{" "}
          {new Date(row.expires_at).toLocaleString(
            language === "ta" ? "ta-IN" : "en-IN",
          )}
        </Body>
        {row.reason ? <Body>{row.reason}</Body> : null}
      </Card>
      {row.status === "PENDING" ? (
        <Body copy>
          Accepting lets this customer see your exact location during the visit.
        </Body>
      ) : null}
      {mainActions.map((action) => (
        <Button
          key={action}
          label={change.isPending ? "Please wait…" : labels[action]}
          disabled={change.isPending}
          onPress={() => change.mutate(action)}
        />
      ))}
      {meeting ? (
        <Card>
          <Disclosure title="Meeting details">
            <Body>
              {text("Latitude")}: {meeting.latitude} · {text("Longitude")}:{" "}
              {meeting.longitude}
            </Body>
          </Disclosure>
          <Body copy>
            Opening maps shares this meeting point with the map provider.
          </Body>
          <Button
            label="Open directions"
            secondary={mainActions.length > 0}
            onPress={() => {
              void openMaps();
            }}
          />
          <Problem message={mapProblem} />
          <Body copy>
            Keep location sharing on while travelling. Arrival is checked
            automatically.
          </Body>
        </Card>
      ) : null}
      {reasonAction ? (
        <Disclosure
          key={reasonAction}
          title={
            reasonAction === "decline" ? "I can’t make it" : "Cancel visit"
          }
        >
          <Field
            label="Reason"
            value={reason}
            onChangeText={setReason}
            maxLength={500}
          />
          <Button
            label={change.isPending ? "Please wait…" : labels[reasonAction]}
            secondary
            disabled={change.isPending || !reason.trim()}
            onPress={() => change.mutate(reasonAction)}
          />
        </Disclosure>
      ) : null}
      <Problem message={change.error ? errorMessage(change.error) : null} />
      <Button
        label="Refresh visit"
        secondary
        onPress={() => {
          void visit.refetch();
        }}
      />
      {row.status === "COMPLETED" ? (
        <Body copy>
          This visit is complete. No purchase or payment was recorded.
        </Body>
      ) : null}
      <Disclosure title="Need help with this visit?">
        <Body copy>
          Arrival needs two accurate server-received location fixes at least
          five seconds apart near the meeting point.
        </Body>
        <Body copy muted>
          Keep location sharing on. Check location permission and your
          connection. If arrival has not registered, wait for another accurate
          update and refresh the visit.
        </Body>
        <Body copy>Report a problem with this visit</Body>
        <Button
          label="Safety"
          secondary={category !== "SAFETY"}
          onPress={() => setCategory("SAFETY")}
        />
        <Button
          label="No show"
          secondary={category !== "NO_SHOW"}
          onPress={() => setCategory("NO_SHOW")}
        />
        <Button
          label="Other"
          secondary={category !== "OTHER"}
          onPress={() => setCategory("OTHER")}
        />
        <Field
          label="Report details"
          multiline
          value={report}
          onChangeText={setReport}
          maxLength={1000}
        />
        <Button
          label="Send report"
          disabled={sendReport.isPending}
          onPress={() => sendReport.mutate()}
        />
        <Problem
          message={sendReport.error ? errorMessage(sendReport.error) : null}
        />
        {notice ? <Body copy>{notice}</Body> : null}
      </Disclosure>
    </Page>
  );
}
