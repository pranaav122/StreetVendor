import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { errorMessage, type StaffRequest } from "./http";
const resultSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});
export function AccountControls({
  request,
  userId,
}: {
  request: StaffRequest;
  userId: string;
}) {
  const queries = useQueryClient();
  const [id, setId] = useState("");
  const [reason, setReason] = useState("");
  const action = useMutation({
    mutationFn: async (suspended: boolean) => {
      const account = z.string().uuid().parse(id.trim());
      return resultSchema.parse(
        await request(`/api/backend/admin/users/${account}/suspension`, {
          method: "POST",
          body: { suspended, reason: reason.trim() },
        }),
      );
    },
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ["staff", userId] });
    },
  });
  const valid =
    z.string().uuid().safeParse(id.trim()).success &&
    reason.trim().length >= 10;
  return (
    <section className="card" aria-labelledby="account-controls-title">
      <h2 id="account-controls-title">Account controls</h2>
      <p>
        Use an account ID from a report or visit inspection. Suspension signs
        the person out and stops their business from sharing. Restoration
        requires a new sign-in and does not restart sharing.
      </p>
      <label>
        Account ID
        <input
          value={id}
          onChange={(event) => setId(event.target.value)}
          maxLength={36}
          disabled={action.isPending}
          autoComplete="off"
        />
      </label>
      <label>
        Account reason
        <textarea
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={action.isPending}
        />
      </label>
      <p className="muted">
        Use at least 10 characters explaining this recorded action. Another
        operator must change your own account status.
      </p>
      <div className="actions">
        <button
          disabled={action.isPending || !valid}
          onClick={() => action.mutate(true)}
        >
          Suspend account
        </button>
        <button
          className="secondary"
          disabled={action.isPending || !valid}
          onClick={() => action.mutate(false)}
        >
          Restore account
        </button>
      </div>
      {action.error ? <p role="alert">{errorMessage(action.error)}</p> : null}
      {action.data ? (
        <div className="details" role="status">
          <p>
            Account ID: <code>{action.data.id}</code>
          </p>
          <p>Last confirmed account status: {action.data.status}</p>
        </div>
      ) : null}
    </section>
  );
}
