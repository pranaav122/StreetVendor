"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError } from "@mystreetvendor/api-client";
import { userSchema, type User } from "@mystreetvendor/shared-types";
import { cookieRequest, errorMessage, type StaffRequest } from "./http";
import { Summary } from "./Summary";
const sessionSchema = z.object({ user: userSchema });

export function AdminApp() {
  const [queries] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 10000 },
          mutations: { retry: false },
        },
      }),
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  // Responses started under an earlier login must not populate a later account.
  const scope = useRef(0);
  useEffect(() => {
    let mounted = true;
    const generation = scope.current;
    void cookieRequest("/api/session")
      .then((value) => {
        if (mounted && generation === scope.current)
          setUser(sessionSchema.parse(value).user);
      })
      .catch((error) => {
        if (mounted && !(error instanceof ApiError && error.status === 401))
          setProblem(errorMessage(error));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  async function forget() {
    const generation = ++scope.current;
    // Cancel before clearing: a late staff response cannot refill a new account's cache.
    await queries.cancelQueries();
    queries.clear();
    if (generation === scope.current) setUser(null);
  }
  const request: StaffRequest = async (path, options) => {
    const generation = scope.current;
    try {
      const result = await cookieRequest(path, options);
      if (generation !== scope.current)
        throw new ApiError(
          401,
          "SESSION_CHANGED",
          "Sign in again to continue.",
        );
      return result;
    } catch (error) {
      if (generation === scope.current && error instanceof ApiError) {
        if (error.status === 401) await forget();
        else if (error.status === 403) {
          // A business rule can also return 403; clear the UI only if the session
          // check confirms that staff authority has actually disappeared.
          try {
            await cookieRequest("/api/session");
          } catch {
            if (generation === scope.current) await forget();
          }
        }
      }
      throw error;
    }
  };
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    const generation = ++scope.current;
    try {
      const value = sessionSchema.parse(
        await cookieRequest("/api/session", {
          method: "POST",
          body: { email: email.trim(), password },
        }),
      );
      if (generation !== scope.current) return;
      await queries.cancelQueries();
      queries.clear();
      setUser(value.user);
      setPassword("");
    } catch (error) {
      if (generation === scope.current) setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setProblem(null);
    await forget();
    try {
      await cookieRequest("/api/session", { method: "DELETE" });
    } catch {
      setProblem(
        "Local operator data was cleared. Server sign-out could not be confirmed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <QueryClientProvider client={queries}>
      <main>
        <p className="brand">MYSTREETVENDOR · ADMINISTRATION</p>
        {loading ? (
          <p role="status">Checking operator session…</p>
        ) : !user ? (
          <section className="sign-in">
            <h1>Operator sign in</h1>
            <p>Use the operator account created for this service.</p>
            <form
              onSubmit={(event) => {
                void signIn(event);
              }}
            >
              <label>
                Email
                <input
                  type="email"
                  autoComplete="username"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              {problem ? <p role="alert">{problem}</p> : null}
              <button disabled={busy}>
                {busy ? "Please wait…" : "Sign in"}
              </button>
            </form>
          </section>
        ) : (
          <>
            <header className="console-heading">
              <div>
                <h1>Operator console</h1>
                <p>{user.display_name}</p>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  void signOut();
                }}
              >
                Sign out
              </button>
            </header>
            <Summary request={request} userId={user.id} />
          </>
        )}
      </main>
    </QueryClientProvider>
  );
}
