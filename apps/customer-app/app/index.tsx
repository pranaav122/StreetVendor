import { ScrollView, Text } from "react-native";
import { tokens } from "@mystreetvendor/design-tokens";
import { useSession } from "../src/session";

export default function Home() {
  const { ready, restoreError } = useSession();
  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: tokens.font.bold,
          fontSize: 28,
          lineHeight: 40,
          color: tokens.color.text,
        }}
      >
        MyStreetVendor
      </Text>
      <Text
        style={{
          fontFamily: tokens.font.regular,
          fontSize: 16,
          lineHeight: 26,
        }}
      >
        {ready
          ? "Application foundation ready. Feature screens are being built."
          : "Restoring session…"}
      </Text>
      {restoreError ? (
        <Text accessibilityRole="alert">{restoreError}</Text>
      ) : null}
    </ScrollView>
  );
}
