import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activeVisitStatuses,
  fixSchema,
  trackableVisitStatuses,
  visitSchema,
} from "@mystreetvendor/shared-types";
import { useSession } from "../../session";
import { useCopy } from "../../language";
import {
  Body,
  Button,
  Card,
  Field,
  Loading,
  Page,
  Problem,
  errorMessage,
} from "../../ui";
import { trackingFresh } from "./intent";
import AreaMap from "../../components/AreaMap";

export function VisitScreen({ id }: { id: string }) {
  const { client, realtime } = useSession();
  const { language, text } = useCopy();
  const queries = useQueryClient();
  const [reason, setReason] = useState("");
  const [report, setReport] = useState("");
  const [category, setCategory] = useState<"SAFETY" | "NO_SHOW" | "OTHER">(
    "OTHER",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [mapVisible, setMapVisible] = useState(false);
  const visit = useQuery({
    queryKey: ["visits", id],
    queryFn: async ({ signal }) =>
      visitSchema.parse(await client.request(`/requests/${id}`, { signal })),
    refetchInterval: (query) =>
      query.state.data && activeVisitStatuses.has(query.state.data.status)
        ? 5000
        : false,
  });
  const trackable =
    visit.data !== undefined && trackableVisitStatuses.has(visit.data.status);
  const tracking = useQuery({
    queryKey: ["tracking", id],
    enabled: trackable,
    retry: false,
    queryFn: async ({ signal }) =>
      fixSchema.parse(
        await client.request(`/requests/${id}/vendor-location`, { signal }),
      ),
    refetchInterval: trackable ? 10000 : false,
  });
  const pins = useMemo(
    () =>
      tracking.data
        ? [
            {
              id,
              label: visit.data?.vendor_name ?? "Vendor",
              point: {
                latitude: tracking.data.latitude,
                longitude: tracking.data.longitude,
              },
              radiusM: tracking.data.accuracy_m,
            },
          ]
        : [],
    [id, tracking.data, visit.data?.vendor_name],
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (trackable) realtime.subscribe(id);
    else {
      realtime.unsubscribe(id);
      // Cancel before erasing so a late tracking response cannot refill the cache.
      void queries
        .cancelQueries({ queryKey: ["tracking", id] })
        .then(() => queries.removeQueries({ queryKey: ["tracking", id] }));
    }
    return () => realtime.unsubscribe(id);
  }, [trackable, id, realtime, queries]);
  const cancel = useMutation({
    mutationFn: async () => {
      if (!visit.data || !reason.trim())
        throw new Error("Enter a reason before cancelling.");
      return visitSchema.parse(
        await client.request(`/requests/${id}/cancel`, {
          method: "POST",
          body: { expected_version: visit.data.version, reason: reason.trim() },
        }),
      );
    },
    onSuccess: (row) => {
      queries.setQueryData(["visits", id], row);
      void queries.invalidateQueries({ queryKey: ["visits"] });
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
  const fresh =
    trackable &&
    tracking.data &&
    !tracking.error &&
    trackingFresh(tracking.data, now);
  return (
    <Page title={`Visit ${row.status.toLowerCase()}`}>
      <Card>
        <Body>{row.vendor_name}</Body>
        <Body>
          {text("Status")}: {text(row.status)}
        </Body>
        <Body>
          {text("Meeting point")}:{" "}
          {row.meeting_label ?? "Selected public point"}
        </Body>
        <Body muted>
          {text("Deadline")}:{" "}
          {new Date(row.expires_at).toLocaleString(
            language === "ta" ? "ta-IN" : "en-IN",
          )}
        </Body>
      </Card>
      {fresh ? (
        <Card>
          <Body copy>Vendor location is available.</Body>
          <Body>
            {text("Latitude")}: {tracking.data.latitude} · {text("Longitude")}:{" "}
            {tracking.data.longitude}
          </Body>
          <Body muted>
            {text("Captured")}{" "}
            {new Date(tracking.data.captured_at).toLocaleTimeString(
              language === "ta" ? "ta-IN" : "en-IN",
            )}{" "}
            · {text("accuracy")} {Math.round(tracking.data.accuracy_m)} m
          </Body>
          <Body copy muted>
            Opening the map shares the viewed area with the map provider.
          </Body>
          <Button
            label={mapVisible ? "Hide tracking map" : "Show tracking map"}
            secondary
            onPress={() => setMapVisible((value) => !value)}
          />
          {mapVisible ? (
            <AreaMap
              origin={row.meeting_point ?? tracking.data}
              pins={pins}
              label="Visit tracking map"
            />
          ) : null}
        </Card>
      ) : (
        <Body copy muted>
          {trackable
            ? "A fresh vendor location is unavailable."
            : "Precise tracking is unavailable for this visit state."}
        </Body>
      )}
      <Button
        label="Refresh visit"
        secondary
        onPress={() => {
          void visit.refetch();
          if (trackable) void tracking.refetch();
        }}
      />
      {row.allowed_actions.includes("cancel") ? (
        <Card>
          <Field
            label="Cancellation reason"
            value={reason}
            onChangeText={setReason}
            maxLength={500}
          />
          <Button
            label={cancel.isPending ? "Cancelling…" : "Cancel visit"}
            disabled={cancel.isPending || !reason.trim()}
            onPress={() => cancel.mutate()}
          />
          <Problem message={cancel.error ? errorMessage(cancel.error) : null} />
        </Card>
      ) : null}
      {row.status === "COMPLETED" ? (
        <Body copy muted>
          This visit is complete. No purchase or payment was recorded.
        </Body>
      ) : null}
      <Card>
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
      </Card>
    </Page>
  );
}
