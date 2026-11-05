import { useEffect, useMemo, useState } from "react";
import { ScrollView } from "react-native";
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
  Disclosure,
  Field,
  Loading,
  Page,
  Problem,
  errorMessage,
} from "../../ui";
import { useMeeting } from "./meeting";
import AreaMap from "../../components/AreaMap";
import { useCopy } from "../../language";
import { locationTimestampFresh } from "../visits/intent";

const pageSchema = z.object({
  items: z.array(nearbySchema),
  next_cursor: z.string().nullable(),
});
export function NearbyScreen() {
  const { client } = useSession();
  const { language, text } = useCopy();
  const { meeting, setMeeting } = useMeeting();
  const [latitude, setLatitude] = useState(
    meeting ? String(meeting.point.latitude) : "",
  );
  const [longitude, setLongitude] = useState(
    meeting ? String(meeting.point.longitude) : "",
  );
  const [label, setLabel] = useState(meeting?.label ?? "");
  const [editing, setEditing] = useState(!meeting);
  const [mapVisible, setMapVisible] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [clock, setClock] = useState(Date.now());
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
    // More loaded pages cost more searches; preserve the server's privacy/rate budget.
    refetchInterval: (query) =>
      Math.max(30000, (query.state.data?.pages.length ?? 1) * 30000),
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
    setEditing(false);
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
  const items = useMemo(
    () =>
      (nearby.data?.pages.flatMap((page) => page.items) ?? []).filter((item) =>
        locationTimestampFresh(item.location_updated_at, Date.now()),
      ),
    [nearby.data, clock],
  );
  const outdated =
    items.length === 0 &&
    (nearby.data?.pages.some((page) => page.items.length > 0) ?? false);
  useEffect(() => {
    if (!items.length) return;
    const expires = Math.min(
      ...items.map((item) => Date.parse(item.location_updated_at) + 90000),
    );
    // Expire cached public points even when a request cannot reach the server.
    const timer = setTimeout(
      () => setClock(Date.now()),
      Math.max(10, expires - Date.now() + 1),
    );
    return () => clearTimeout(timer);
  }, [items]);
  const pins = useMemo(
    () =>
      items.map((item) => ({
        id: item.vendor_id,
        label: item.display_name,
        point: {
          latitude: item.approximate_location.latitude,
          longitude: item.approximate_location.longitude,
        },
        radiusM: item.approximate_location.radius_m,
      })),
    [items],
  );
  return (
    <Page title="Around your meeting point">
      <Body copy muted>
        Choose a public place where the vendor can meet you. Your home address
        is not required.
      </Body>
      {editing || !meeting ? (
        <Card>
          <Field
            label="Meeting label"
            value={label}
            onChangeText={setLabel}
            autoCapitalize="sentences"
            maxLength={250}
          />
          <Button
            label={locating ? "Finding location…" : "Use current location"}
            secondary
            disabled={locating}
            onPress={() => {
              void locate();
            }}
          />
          <Disclosure title="Enter coordinates">
            <Body copy muted>
              Use coordinates for a public place if location access is
              unavailable.
            </Body>
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
          </Disclosure>
          <Button label="Set meeting point" onPress={choosePoint} />
        </Card>
      ) : null}
      <Problem message={problem} />
      {meeting ? (
        <Card>
          <Body>{meeting.label}</Body>
          <Button
            label="Edit meeting point"
            secondary
            onPress={() => setEditing(true)}
          />
          <Body copy muted>
            Search within approximately 1.5 km. Vendor positions and distance
            bands are approximate.
          </Body>
        </Card>
      ) : (
        <Body copy>Select a meeting point to find nearby vendors.</Body>
      )}
      {meeting ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
        >
          <Button
            label="All categories"
            secondary={category !== null}
            onPress={() => setCategory(null)}
          />
          {categories.data?.items.map((item) => (
            <Button
              key={item.id}
              label={language === "ta" ? item.name_ta : item.name_en}
              secondary={category !== item.id}
              onPress={() => setCategory(item.id)}
            />
          ))}
        </ScrollView>
      ) : null}
      {meeting ? (
        <>
          <Body copy muted>
            Opening a map shares the viewed area with the map provider. The list
            works without loading a map.
          </Body>
          <Button
            label={mapVisible ? "Show list" : "Show map"}
            secondary
            onPress={() => setMapVisible((value) => !value)}
          />
        </>
      ) : null}
      {meeting && mapVisible ? (
        <AreaMap origin={meeting.point} pins={pins} />
      ) : null}
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
      {outdated ? (
        <Body copy>
          Cached results are out of date. Refresh to check availability.
        </Body>
      ) : null}
      {meeting && nearby.isSuccess && items.length === 0 && !outdated ? (
        <Body copy>No available vendors nearby.</Body>
      ) : null}
      {!mapVisible
        ? items.map((item) => (
            <Card key={item.vendor_id}>
              <Body>{item.display_name}</Body>
              <Body muted>
                {text("Available")} · {item.distance_band_m.min}–
                {item.distance_band_m.max} {text("metres away")}
              </Body>
              <Link
                accessibilityLabel={`View ${item.display_name}`}
                href={`/vendor/${item.vendor_id}`}
              >
                {text("View vendor")}
              </Link>
            </Card>
          ))
        : null}
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
