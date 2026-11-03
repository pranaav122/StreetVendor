import { useState } from "react";
import { Link, router } from "expo-router";
import * as Crypto from "expo-crypto";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vendorSchema, visitSchema } from "@mystreetvendor/shared-types";
import { useSession } from "../../session";
import { useMeeting } from "../discovery/meeting";
import { VisitIntent } from "../visits/intent";
import {
  Body,
  Button,
  Card,
  Loading,
  Page,
  Problem,
  errorMessage,
} from "../../ui";

export function VendorScreen({ id }: { id: string }) {
  const { client } = useSession();
  const { meeting } = useMeeting();
  const queries = useQueryClient();
  const [intent] = useState(() => new VisitIntent(() => Crypto.randomUUID()));
  const vendor = useQuery({
    queryKey: ["vendor", id],
    queryFn: async ({ signal }) =>
      vendorSchema.parse(await client.request(`/vendors/${id}`, { signal })),
  });
  const create = useMutation({
    mutationFn: async () => {
      if (!meeting)
        throw new Error("Choose a public meeting point on Nearby first.");
      const prepared = intent.prepare(id, meeting);
      return visitSchema.parse(
        await client.request("/requests", {
          method: "POST",
          headers: { "Idempotency-Key": prepared.key },
          body: prepared.body,
        }),
      );
    },
    onSuccess: (visit) => {
      void queries.invalidateQueries({ queryKey: ["visits"] });
      router.replace(`/visit/${visit.id}`);
    },
  });
  if (vendor.isPending)
    return (
      <Page title="Vendor">
        <Loading />
      </Page>
    );
  if (vendor.error)
    return (
      <Page title="Vendor">
        <Problem message={errorMessage(vendor.error)} />
        <Button
          label="Retry vendor"
          onPress={() => {
            void vendor.refetch();
          }}
        />
      </Page>
    );
  const row = vendor.data;
  return (
    <Page title={row.display_name}>
      <Body>{row.description}</Body>
      <Body muted>
        Review: {row.verification_status} ·{" "}
        {row.is_available ? "Available" : "Offline"}
      </Body>
      <Body>
        {row.categories.map((category) => category.name_en).join(" · ")}
      </Body>
      <Card>
        {meeting ? (
          <>
            <Body>Meeting point: {meeting.label}</Body>
            <Body muted>
              {meeting.point.latitude}, {meeting.point.longitude}
            </Body>
          </>
        ) : (
          <Body>Choose a public meeting point first.</Body>
        )}
        <Link href="/">Change meeting point</Link>
        <Body muted>
          The vendor will receive this meeting point with your request. Do not
          enter a home address unless you intend to share it.
        </Body>
      </Card>
      <Problem message={create.error ? errorMessage(create.error) : null} />
      <Button
        label={create.isPending ? "Requesting visit…" : "Request visit"}
        disabled={
          create.isPending ||
          !meeting ||
          !row.is_available ||
          row.verification_status !== "VERIFIED"
        }
        onPress={() => create.mutate()}
      />
      <Body muted>
        A request expires after five minutes if it is not accepted. Sending a
        request does not place an order or make a payment.
      </Body>
      {create.error ? (
        <Link href="/visits">
          Check your visits before trying a new request
        </Link>
      ) : null}
    </Page>
  );
}
