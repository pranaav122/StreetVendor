import { useState } from "react";
import { View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useSession } from "../../session";
import { useCopy } from "../../language";
import { Body, Button, Field, Page, Problem, errorMessage } from "../../ui";

type Values = { name: string; email: string; password: string };
const emailSchema = z.string().email();

export function AuthScreen() {
  const { client, signIn, restoreError, restore } = useSession();
  const { language, setGuestLanguage } = useCopy();
  const [mode, setMode] = useState<"login" | "register" | "recover">("login");
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Values>({ defaultValues: { name: "", email: "", password: "" } });
  const copy = {
    login: { title: "Sign in to your shop", label: "Sign in" },
    register: {
      title: "Create your shop account",
      label: "Create account",
    },
    recover: { title: "Reset your password", label: "Send reset link" },
  }[mode];
  async function submit(values: Values) {
    setProblem(null);
    setNotice(null);
    const email = values.email.trim();
    if (!emailSchema.safeParse(email).success) {
      setProblem("Enter a valid email address.");
      return;
    }
    if (mode === "recover") {
      try {
        await client.request("/auth/password/reset/request", {
          method: "POST",
          authenticated: false,
          body: { email },
        });
        setNotice("If your account is eligible, a reset link will be sent.");
      } catch (error) {
        setProblem(errorMessage(error));
      }
      return;
    }
    if (
      mode === "register" &&
      (values.password.length < 15 ||
        values.password.length > 128 ||
        !values.name.trim())
    ) {
      setProblem("Enter your name and a password with 15 to 128 characters.");
      return;
    }
    if (!values.password) {
      setProblem("Enter your password.");
      return;
    }
    try {
      if (mode === "register")
        await client.request("/auth/register/vendor", {
          method: "POST",
          authenticated: false,
          body: {
            email,
            password: values.password,
            display_name: values.name.trim(),
            preferred_language: language,
          },
        });
      await signIn(email, values.password);
    } catch (error) {
      setProblem(errorMessage(error));
    }
  }
  function change(next: typeof mode) {
    setMode(next);
    setProblem(null);
    setNotice(null);
  }
  return (
    <Page title={copy.title} navigation={false}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          label="English"
          secondary={language !== "en"}
          onPress={() => setGuestLanguage("en")}
        />
        <Button
          label="தமிழ்"
          secondary={language !== "ta"}
          onPress={() => setGuestLanguage("ta")}
        />
      </View>
      <Body muted copy>
        Go online, meet customers and manage your shop.
      </Body>
      {mode === "register" ? (
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Field
              label="Name"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="words"
              maxLength={100}
            />
          )}
        />
      ) : null}
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Field
            label="Email"
            keyboardType="email-address"
            autoComplete="email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            maxLength={254}
          />
        )}
      />
      {mode !== "recover" ? (
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Field
              label="Password"
              secureTextEntry
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              maxLength={128}
            />
          )}
        />
      ) : null}
      <Problem message={problem} />
      {notice ? <Body copy>{notice}</Body> : null}
      <Button
        label={isSubmitting ? "Please wait…" : copy.label}
        disabled={isSubmitting}
        onPress={handleSubmit(submit)}
      />
      {mode !== "register" ? (
        <Button
          label="Create account"
          secondary
          onPress={() => change("register")}
        />
      ) : null}
      {mode !== "login" ? (
        <Button label="Sign in" secondary onPress={() => change("login")} />
      ) : (
        <Button
          label="Forgot password?"
          secondary
          onPress={() => change("recover")}
        />
      )}
      <Problem message={restoreError} />
      {restoreError ? (
        <Button
          label="Retry saved session"
          secondary
          onPress={() => {
            void restore();
          }}
        />
      ) : null}
    </Page>
  );
}
