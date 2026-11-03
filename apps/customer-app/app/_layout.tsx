import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import {
  useFonts,
  NotoSansTamil_400Regular,
  NotoSansTamil_700Bold,
} from "@expo-google-fonts/noto-sans-tamil";
import { tokens } from "@mystreetvendor/design-tokens";
import { SessionProvider } from "../src/session";
import { MeetingProvider } from "../src/features/discovery/meeting";
import { RecoveryLinksProvider } from "../src/features/auth/RecoveryLinks";
import { NotificationLifecycle } from "../src/notifications";
import { LanguageProvider } from "../src/language";

export default function RootLayout() {
  const [loaded, error] = useFonts({
    NotoSansTamil_400Regular,
    NotoSansTamil_700Bold,
  });
  if (!loaded && !error)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator accessibilityLabel="Loading fonts" />
      </View>
    );
  return (
    <SessionProvider>
      <LanguageProvider>
        <MeetingProvider>
          <RecoveryLinksProvider>
            <NotificationLifecycle />
            <Stack
              screenOptions={{
                headerShown: false,
                headerStyle: { backgroundColor: tokens.color.background },
                headerTintColor: tokens.color.text,
                contentStyle: { backgroundColor: tokens.color.background },
              }}
            />
          </RecoveryLinksProvider>
        </MeetingProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
