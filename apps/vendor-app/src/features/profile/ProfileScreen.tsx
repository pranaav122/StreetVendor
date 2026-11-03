import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { categorySchema, vendorSchema } from "@mystreetvendor/shared-types";
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
import { ownBusiness } from "./queries";
type Values = { name: string; description: string; review: string };
export function ProfileScreen() {
  const { client } = useSession();
  const { language } = useCopy();
  const queries = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { control, reset, handleSubmit, getValues } = useForm<Values>({
    defaultValues: { name: "", description: "", review: "" },
  });
  const profile = useQuery({
    queryKey: ["vendor", "own"],
    queryFn: ({ signal }) => ownBusiness(client, signal),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async ({ signal }) =>
      z
        .object({ items: z.array(categorySchema) })
        .parse(await client.request("/categories", { signal })),
  });
  useEffect(() => {
    if (profile.data) {
      reset({
        name: profile.data.display_name,
        description: profile.data.description,
        review: "",
      });
      setSelected(profile.data.categories.map((category) => category.id));
    }
  }, [profile.data?.id, reset]);
  const save = useMutation({
    mutationFn: async (values: Values) => {
      setNotice(null);
      if (!values.name.trim() || !selected.length)
        throw new Error(
          "Enter a business name and choose at least one category.",
        );
      return vendorSchema.parse(
        await client.request("/vendors/me/profile", {
          method: "PUT",
          body: {
            display_name: values.name.trim(),
            description: values.description.trim(),
            category_ids: selected,
          },
        }),
      );
    },
    onSuccess: (row) => {
      queries.setQueryData(["vendor", "own"], row);
      setNotice("Business profile saved.");
    },
  });
  const review = useMutation({
    mutationFn: async () => {
      setNotice(null);
      const details = getValues("review").trim();
      if (!profile.data || details.length < 10)
        throw new Error(
          "Save your profile and provide at least 10 characters for the review.",
        );
      return client.request("/vendors/me/verifications", {
        method: "POST",
        body: { evidence_note: details },
      });
    },
    onSuccess: () => {
      setSent(true);
      setNotice("Review requested.");
      void queries.invalidateQueries({ queryKey: ["vendor"] });
    },
  });
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }
  if (profile.isPending || categories.isPending)
    return (
      <Page title="Your business profile">
        <Loading />
      </Page>
    );
  if (profile.error || categories.error)
    return (
      <Page title="Your business profile">
        <Problem message={errorMessage(profile.error ?? categories.error)} />
        <Button
          label="Retry"
          onPress={() => {
            void profile.refetch();
            void categories.refetch();
          }}
        />
      </Page>
    );
  return (
    <Page title="Your business profile">
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <Field
            label="Business name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoCapitalize="words"
            maxLength={100}
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <Field
            label="Business description"
            multiline
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            maxLength={1000}
          />
        )}
      />
      <Body copy>Choose the categories you sell.</Body>
      {categories.data?.items.map((category) => (
        <Button
          key={category.id}
          label={language === "ta" ? category.name_ta : category.name_en}
          secondary={!selected.includes(category.id)}
          onPress={() => toggle(category.id)}
        />
      ))}
      {categories.data?.items.length === 0 ? (
        <Problem message="No product categories are configured. Contact the operator." />
      ) : null}
      <Problem message={save.error ? errorMessage(save.error) : null} />
      <Button
        label={save.isPending ? "Saving…" : "Save business profile"}
        disabled={save.isPending}
        onPress={handleSubmit((values) => save.mutate(values))}
      />
      {notice ? <Body copy>{notice}</Body> : null}
      {profile.data &&
      profile.data.verification_status !== "VERIFIED" &&
      profile.data.verification_status !== "SUSPENDED" ? (
        <Card>
          <Body copy>
            Share public business details only. Do not send identity documents,
            passwords or private customer information.
          </Body>
          <Controller
            control={control}
            name="review"
            render={({ field }) => (
              <Field
                label="Review details"
                multiline
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                maxLength={1000}
              />
            )}
          />
          <Problem message={review.error ? errorMessage(review.error) : null} />
          <Button
            label="Request staff review"
            disabled={review.isPending || sent}
            onPress={() => review.mutate()}
          />
        </Card>
      ) : null}
    </Page>
  );
}
