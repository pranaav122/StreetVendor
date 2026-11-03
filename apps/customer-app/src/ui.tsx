import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Link } from "expo-router";
import { tokens } from "@mystreetvendor/design-tokens";
import { useCopy } from "./language";

export function Body({
  children,
  muted = false,
  copy = false,
}: PropsWithChildren<{ muted?: boolean; copy?: boolean }>) {
  const { text } = useCopy();
  // Translate explicit interface copy; business names and meeting labels stay intact.
  return (
    <Text style={[styles.body, muted ? styles.muted : null]}>
      {copy && typeof children === "string" ? text(children) : children}
    </Text>
  );
}
export function Page({
  title,
  children,
  navigation = true,
  translateTitle = true,
}: PropsWithChildren<{
  title: string;
  navigation?: boolean;
  translateTitle?: boolean;
}>) {
  const { text } = useCopy();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.page}
    >
      <Text style={styles.eyebrow}>MYSTREETVENDOR</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {translateTitle ? text(title) : title}
      </Text>
      {navigation ? (
        <View style={styles.navigation}>
          <Link style={styles.link} href="/">
            {text("Nearby")}
          </Link>
          <Link style={styles.link} href="/visits">
            {text("Visits")}
          </Link>
          <Link style={styles.link} href="/account">
            {text("Account")}
          </Link>
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}
export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const { text } = useCopy();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : null,
        disabled ? styles.disabled : null,
        pressed ? { opacity: 0.75 } : null,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary ? { color: tokens.color.primary } : null,
        ]}
      >
        {text(label)}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { text } = useCopy();
  return (
    <View style={styles.field}>
      <Body>{text(label)}</Body>
      <TextInput
        accessibilityLabel={text(label)}
        style={styles.input}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}
export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}
export function Problem({ message }: { message: string | null | undefined }) {
  const { text } = useCopy();
  return message ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {text(message)}
    </Text>
  ) : null;
}
export function Loading({ label = "Loading…" }: { label?: string }) {
  const { text } = useCopy();
  return (
    <View style={styles.loading}>
      <ActivityIndicator accessibilityLabel={text(label)} />
      <Body>{text(label)}</Body>
    </View>
  );
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to finish this action. Check your connection and try again.";
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 48,
    gap: 16,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },
  eyebrow: {
    fontFamily: tokens.font.bold,
    fontSize: 14,
    color: tokens.color.primary,
    lineHeight: 24,
  },
  title: {
    fontFamily: tokens.font.bold,
    fontSize: 28,
    lineHeight: 40,
    color: tokens.color.text,
  },
  body: {
    fontFamily: tokens.font.regular,
    fontSize: 16,
    lineHeight: 26,
    color: tokens.color.text,
  },
  muted: { color: tokens.color.muted },
  navigation: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  link: {
    fontFamily: tokens.font.bold,
    fontSize: 16,
    color: tokens.color.primary,
    paddingVertical: 12,
    paddingRight: 16,
    minHeight: 48,
  },
  button: {
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: tokens.color.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontFamily: tokens.font.bold,
    color: tokens.color.onPrimary,
    fontSize: 16,
    lineHeight: 28,
    textAlign: "center",
  },
  secondary: { backgroundColor: tokens.color.subtle },
  disabled: { opacity: 0.5 },
  field: { gap: 8 },
  input: {
    minHeight: 52,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 12,
    backgroundColor: tokens.color.surface,
    color: tokens.color.text,
    fontFamily: tokens.font.regular,
    fontSize: 16,
    lineHeight: 26,
  },
  card: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: tokens.color.surface,
    gap: 12,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  error: {
    fontFamily: tokens.font.regular,
    fontSize: 16,
    lineHeight: 26,
    color: tokens.color.danger,
  },
  loading: { gap: 12, padding: 24 },
});
