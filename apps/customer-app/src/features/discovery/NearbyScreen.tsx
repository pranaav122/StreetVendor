import { useState } from "react";
import { Link } from "expo-router";
import * as Location from "expo-location";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  categorySchema,
  nearbySchema,
  pointSchema,
} from "@mystreetvendor/shared-types";
import { useSession } from "../../session";
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
import { useMeeting } from "./meeting";

const pageSchema = z.object({
  items: z.array(nearbySchema),
  next_cursor: z.string().nullable(),
});
export function NearbyScreen() {
  const { client } = useSession();
  const { meeting, setMeeting } = useMeeting();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async ({ signal }) =>
      z
        .object({ items: z.array(categorySchema) })
        .parse(await client.request("/categories", { signal })),
  });
  const nearby = useInfiniteQuery({
    queryKey: [
      "nearby",
      meeting?.point.latitude,
      meeting?.point.longitude,
      category,
    ],
    enabled: meeting !== null,
    initialPageParam: null as string | null,
    queryFn: async ({ signal, pageParam }) => {
      if (!meeting) throw new Error("Choose a meeting point first.");
      const query = new URLSearchParams({
        latitude: String(meeting.point.latitude),
        longitude: String(meeting.point.longitude),
        radius_m: "1500",
        limit: "20",
      });
      if (category) query.set("category_id", category);
      if (pageParam) query.set("cursor", pageParam);
      return pageSchema.parse(
        await client.request(`/vendors/nearby?${query}`, { signal }),
      );
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  function choosePoint() {
    setProblem(null);
    const point = pointSchema.safeParse({
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
    if (
      !latitude.trim() ||
      !longitude.trim() ||
      !point.success ||
      !label.trim() ||
      label.trim().length > 250
    ) {
      setProblem(
        "Enter valid coordinates and a public meeting label of up to 250 characters.",
      );
      return;
    }
    setMeeting({ point: point.data, label: label.trim() });
  }
  async function locate() {
    setLocating(true);
    setProblem(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setProblem(
          "Location permission is off. Enter a public meeting point manually or enable permission in device settings.",
        );
        return;
      }
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatitude(fix.coords.latitude.toFixed(6));
      setLongitude(fix.coords.longitude.toFixed(6));
      setProblem(
        "Coordinates filled. Add a public meeting label and select Set meeting point.",
      );
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setLocating(false);
    }
  }
  const items = nearby.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <Page title="Around your meeting point">
      <Body muted>
        Choose a public place. Your home address is not required. This
        development build uses the Chennai test area.
      </Body>
      <Card>
        <Field
          label="Meeting latitude"
          keyboardType="decimal-pad"
          value={latitude}
          onChangeText={setLatitude}
        />
        <Field
          label="Meeting longitude"
          keyboardType="decimal-pad"
          value={longitude}
          onChangeText={setLongitude}
        />
        <Field
          label="Meeting label"
          value={label}
          onChangeText={setLabel}
          autoCapitalize="sentences"
          maxLength={250}
        />
        <Button label="Set meeting point" onPress={choosePoint} />
        <Button
          label={locating ? "Finding location…" : "Use current location"}
          secondary
          disabled={locating}
          onPress={() => {
            void locate();
          }}
        />
      </Card>
      <Problem message={problem} />
      {meeting ? (
        <Card>
          <Body>{meeting.label}</Body>
          <Body muted>
            Search within approximately 1.5 km. Vendor positions and distance
            bands are approximate.
          </Body>
        </Card>
      ) : (
        <Body>Select a meeting point to find nearby vendors.</Body>
      )}
      <Button
        label="All categories"
        secondary={category !== null}
        onPress={() => setCategory(null)}
      />
      {categories.data?.items.map((item) => (
        <Button
          key={item.id}
          label={item.name_en}
          secondary={category !== item.id}
          onPress={() => setCategory(item.id)}
        />
      ))}
      {categories.error ? (
        <Problem message={errorMessage(categories.error)} />
      ) : null}
      {meeting && nearby.isPending ? (
        <Loading label="Finding nearby vendors…" />
      ) : null}
      {nearby.error ? (
        <>
          <Problem message={errorMessage(nearby.error)} />
          <Button
            label="Retry search"
            onPress={() => {
              void nearby.refetch();
            }}
          />
        </>
      ) : null}
      {meeting && nearby.isSuccess && items.length === 0 ? (
        <Body>No available vendors nearby.</Body>
      ) : null}
      {items.map((item) => (
        <Card key={item.vendor_id}>
          <Body>{item.display_name}</Body>
          <Body muted>
            Available · {item.distance_band_m.min}–{item.distance_band_m.max}{" "}
            metres away
          </Body>
          <Link
            accessibilityLabel={`View ${item.display_name}`}
            href={`/vendor/${item.vendor_id}`}
          >
            View vendor
          </Link>
        </Card>
      ))}
      {nearby.hasNextPage ? (
        <Button
          label="More vendors"
          disabled={nearby.isFetchingNextPage}
          onPress={() => {
            void nearby.fetchNextPage();
          }}
        />
      ) : null}
      {meeting ? (
        <Button
          label="Refresh vendors"
          secondary
          disabled={nearby.isFetching}
          onPress={() => {
            void nearby.refetch();
          }}
        />
      ) : null}
    </Page>
  );
}
