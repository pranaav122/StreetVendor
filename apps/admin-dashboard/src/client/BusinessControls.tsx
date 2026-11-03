import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { vendorSchema } from "@mystreetvendor/shared-types";
import { errorMessage, type StaffRequest } from "./http";
const schema = vendorSchema.extend({ user_id: z.string().uuid() });
export function BusinessControls({
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
    mutationFn: async (value: "suspension" | "reinstatement") => {
      const business = z.string().uuid().parse(id.trim());
      return schema.parse(
        await request(`/api/backend/admin/vendors/${business}/${value}`, {
          method: "POST",
          body: { reason: reason.trim() },
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
    <section className="card" aria-labelledby="business-controls-title">
      <h2 id="business-controls-title">Business controls</h2>
      <p>
        Suspension stops location sharing. Returning to review keeps the
        business offline; approval is a separate action.
      </p>
      <label>
        Business ID
        <input
          value={id}
          onChange={(event) => setId(event.target.value)}
          maxLength={36}
          disabled={action.isPending}
          autoComplete="off"
        />
      </label>
      <label>
        Action reason
        <textarea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          disabled={action.isPending}
        />
      </label>
      <p className="muted">
        Use at least 10 characters to explain this recorded action.
      </p>
      <div className="actions">
        <button
          disabled={action.isPending || !valid}
          onClick={() => action.mutate("suspension")}
        >
          Suspend business
        </button>
        <button
          className="secondary"
          disabled={action.isPending || !valid}
          onClick={() => action.mutate("reinstatement")}
        >
          Return business to review
        </button>
      </div>
      {action.error ? <p role="alert">{errorMessage(action.error)}</p> : null}
      {action.data ? (
        <div className="details" role="status">
          <p>{action.data.display_name}</p>
          <p>
            Last confirmed business status: {action.data.verification_status}
          </p>
          <p>
            Business ID: <code>{action.data.id}</code>
          </p>
          <p>
            Owner account ID: <code>{action.data.user_id}</code>
          </p>
          <p>The business is offline.</p>
        </div>
      ) : null}
    </section>
  );
}
