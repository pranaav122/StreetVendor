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
import { Link, usePathname } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
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
/** Keeps destinations outside scrolling content so a long form cannot hide the way back. */
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
  const pathname = usePathname();
  const destinations = [
    { href: "/", label: "Nearby" },
    { href: "/visits", label: "Your visits" },
    { href: "/account", label: "Account" },
  ] as const;
  return (
    <SafeAreaView
      style={styles.shell}
      edges={["top", "bottom", "left", "right"]}
    >
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.page}
      >
        {!navigation ? (
          <Text style={styles.eyebrow}>MyStreetVendor</Text>
        ) : null}
        <Text accessibilityRole="header" style={styles.title}>
          {translateTitle ? text(title) : title}
        </Text>
        {children}
      </ScrollView>
      {navigation ? (
        <View
          role="navigation"
          accessibilityLabel={text("Main navigation")}
          style={styles.navigation}
        >
          {destinations.map((destination) => {
            const active =
              pathname === destination.href ||
              (destination.href === "/visits" &&
                pathname.startsWith("/visit/"));
            return (
              // Link’s slot flattens styles; give it a plain object rather than a Pressable style callback.
              <Link
                key={destination.href}
                href={destination.href}
                replace
                style={StyleSheet.flatten([
                  styles.navItem,
                  active ? styles.navSelected : null,
                ])}
                asChild
              >
                <Pressable
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  aria-selected={active}
                >
                  <Text
                    style={[
                      styles.navText,
                      active ? styles.navTextSelected : null,
                    ]}
                  >
                    {text(destination.label)}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      ) : null}
    </SafeAreaView>
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
  shell: { flex: 1, backgroundColor: tokens.color.background },
  scroll: { flex: 1 },
  page: {
    padding: 24,
    paddingTop: 24,
    paddingBottom: 32,
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
    fontSize: 18,
    lineHeight: 28,
    color: tokens.color.text,
  },
  muted: { color: tokens.color.muted },
  navigation: {
    flexDirection: "row",
    gap: 4,
    padding: 8,
    borderTopWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  navItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  navSelected: { backgroundColor: tokens.color.subtle },
  // A centred label needs a width bound; otherwise long translations can cover adjacent targets.
  navText: {
    width: "100%",
    fontFamily: tokens.font.regular,
    fontSize: 14,
    lineHeight: 22,
    color: tokens.color.muted,
    textAlign: "center",
    flexShrink: 1,
  },
  navTextSelected: {
    fontFamily: tokens.font.bold,
    color: tokens.color.primary,
  },
  button: {
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: tokens.color.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    width: "100%",
    fontFamily: tokens.font.bold,
    color: tokens.color.onPrimary,
    fontSize: 18,
    lineHeight: 28,
    textAlign: "center",
  },
  secondary: { backgroundColor: tokens.color.subtle },
  disabled: { opacity: 0.5 },
  field: { gap: 8 },
  input: {
    minHeight: 56,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 12,
    backgroundColor: tokens.color.surface,
    color: tokens.color.text,
    fontFamily: tokens.font.regular,
    fontSize: 18,
    lineHeight: 28,
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
    fontSize: 18,
    lineHeight: 28,
    color: tokens.color.danger,
  },
  loading: { gap: 12, padding: 24 },
});
