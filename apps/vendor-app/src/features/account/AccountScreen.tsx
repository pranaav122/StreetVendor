import { useState } from "react";
import { router } from "expo-router";
import { useSession } from "../../session";
import { enableNotifications } from "../../notifications";
import { useCopy } from "../../language";
import { stopDeviceSharing } from "../../location/lifecycle";
import {
  Body,
  Button,
  Card,
  Field,
  Page,
  Problem,
  errorMessage,
} from "../../ui";

export function AccountScreen() {
  const { client, user, reloadUser, signIn, signOut } = useSession();
  const { text } = useCopy();
  const [name, setName] = useState(user?.display_name ?? "");
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="Your account">
      <Body>{user?.email}</Body>
      <Problem message={problem} />
      {notice ? <Body copy>{notice}</Body> : null}
      <Card>
        <Field
          label="Display name"
          value={name}
          onChangeText={setName}
          maxLength={100}
        />
        <Button
          label="Save name"
          disabled={busy || !name.trim()}
          onPress={() => {
            void run(async () => {
              await client.request("/users/me", {
                method: "PATCH",
                body: { display_name: name.trim() },
              });
              await reloadUser();
              setNotice("Name saved.");
            });
          }}
        />
        <Body copy>
          {text("Language")}:{" "}
          {user?.preferred_language === "ta" ? "தமிழ்" : "English"}
        </Body>
        <Button
          label="English"
          secondary
          disabled={busy}
          onPress={() => {
            void run(async () => {
              await client.request("/users/me", {
                method: "PATCH",
                body: { preferred_language: "en" },
              });
              await reloadUser();
            });
          }}
        />
        <Button
          label="தமிழ்"
          secondary
          disabled={busy}
          onPress={() => {
            void run(async () => {
              await client.request("/users/me", {
                method: "PATCH",
                body: { preferred_language: "ta" },
              });
              await reloadUser();
            });
          }}
        />
      </Card>
      <Card>
        <Body copy>
          {user?.email_verified_at
            ? "Email confirmed."
            : "Your email is not confirmed."}
        </Body>
        {!user?.email_verified_at ? (
          <Button
            label="Send confirmation email"
            disabled={busy}
            onPress={() => {
              void run(async () => {
                await client.request("/auth/email/verification", {
                  method: "POST",
                });
                setNotice("Confirmation email requested. Check your inbox.");
              });
            }}
          />
        ) : null}
      </Card>
      <Card>
        <Body copy>
          Visit notifications are optional. Your inbox remains available without
          them.
        </Body>
        <Button
          label="Enable notifications"
          disabled={busy}
          onPress={() => {
            void run(async () => {
              const result = await enableNotifications(client);
              setNotice(result.message);
            });
          }}
        />
      </Card>
      <Button
        label="Sign out"
        disabled={busy}
        onPress={() => {
          void run(async () => {
            try {
              await signOut();
            } finally {
              router.replace("/");
            }
          });
        }}
      />
      <Card>
        <Body copy>
          Account deletion removes your profile, stops sharing and revokes your
          sessions. Minimal anonymous workflow history may remain until
          retention cleanup.
        </Body>
        <Body copy>Sign in again if asked to confirm a recent login.</Body>
        <Field
          label="Confirm password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Button
          label="Confirm recent sign-in"
          secondary
          disabled={busy || !password}
          onPress={() => {
            void run(async () => {
              if (!user?.email) return;
              await signIn(user.email, password);
              setPassword("");
              setNotice("Recent sign-in confirmed.");
            });
          }}
        />
        <Field
          label="Type DELETE to delete your account"
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
        />
        <Button
          label="Delete account"
          disabled={busy || confirmation !== "DELETE"}
          onPress={() => {
            void run(async () => {
              await stopDeviceSharing();
              await client.request("/users/me", {
                method: "DELETE",
                body: { confirmation: "DELETE" },
              });
              await client.clearSession();
              router.replace("/");
            });
          }}
        />
      </Card>
    </Page>
  );
}
