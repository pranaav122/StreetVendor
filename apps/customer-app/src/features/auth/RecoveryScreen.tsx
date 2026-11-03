import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { useSession } from "../../session";
import { useCopy } from "../../language";
import {
  Body,
  Button,
  Card,
  Field,
  Page,
  Problem,
  errorMessage,
} from "../../ui";
import { useRecoveryLink } from "./RecoveryLinks";
import type { RecoveryKind } from "./recovery-link";

export function RecoveryScreen({ kind }: { kind: RecoveryKind }) {
  const { client, user, reloadUser } = useSession();
  const { text } = useCopy();
  const { token, readLink, clear } = useRecoveryLink(kind);
  const [link, setLink] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    if (token) setSuccess(false);
  }, [token]);
  const reset = kind === "reset-password";
  async function confirm() {
    // Opening or previewing an email link must not consume its one-use token.
    // Only this explicit confirmation submits it to the API.
    if (!token) return;
    setProblem(null);
    if (
      reset &&
      (password.length < 15 || password.length > 128 || password !== repeat)
    ) {
      setProblem("Use matching passwords with 15 to 128 characters.");
      return;
    }
    setBusy(true);
    try {
      await client.request(
        reset ? "/auth/password/reset/confirm" : "/auth/email/verify",
        {
          method: "POST",
          authenticated: false,
          body: reset ? { token, password } : { token },
        },
      );
      clear(token);
      setPassword("");
      setRepeat("");
      setSuccess(true);
      if (reset) await client.clearSession();
      else if (user) void reloadUser().catch(() => {});
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title={reset ? "Choose a new password" : "Confirm your email"}
      navigation={false}
    >
      {success ? (
        <Body copy>
          {reset
            ? "Password changed. Sign in with your new password."
            : "Email link confirmed. You can return to your account."}
        </Body>
      ) : (
        <>
          {!token ? (
            <Card>
              <Body copy>
                This link is missing or invalid. Paste the full link from your
                email.
              </Body>
              <Field
                label="Email link"
                value={link}
                onChangeText={setLink}
                secureTextEntry
                autoCorrect={false}
              />
              <Button
                label="Use email link"
                onPress={() => {
                  const parsed = readLink(link);
                  setLink("");
                  if (!parsed || parsed.kind !== kind)
                    setProblem(
                      "Use the link for this action from your latest email.",
                    );
                }}
              />
            </Card>
          ) : null}
          {reset ? (
            <>
              <Field
                label="New password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                maxLength={128}
              />
              <Field
                label="Repeat new password"
                secureTextEntry
                value={repeat}
                onChangeText={setRepeat}
                maxLength={128}
              />
            </>
          ) : (
            <Body copy>
              Confirming this link marks its email address as verified.
            </Body>
          )}
          <Problem message={problem} />
          <Button
            label={
              busy
                ? "Please wait…"
                : reset
                  ? "Save new password"
                  : "Confirm email"
            }
            disabled={busy || !token}
            onPress={() => {
              void confirm();
            }}
          />
          {token ? (
            <Button
              label="Use a different link"
              secondary
              onPress={() => clear(token)}
            />
          ) : null}
        </>
      )}
      <Link href="/">{text("Return to sign in")}</Link>
    </Page>
  );
}
