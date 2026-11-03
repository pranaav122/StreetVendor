import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError } from "@mystreetvendor/api-client";
import {
  activeVisitStatuses,
  visitSchema,
  type Visit,
} from "@mystreetvendor/shared-types";
import { errorMessage, type StaffRequest } from "./http";

export function VisitInspector({
  request,
  userId,
  initialVisit,
  changed,
}: {
  request: StaffRequest;
  userId: string;
  initialVisit: Visit | null;
  changed(visit: Visit): void;
}) {
  const queries = useQueryClient();
  const [id, setId] = useState(initialVisit?.id ?? "");
  const [row, setRow] = useState<Visit | null>(initialVisit);
  const [reason, setReason] = useState("");
  function apply(value: Visit) {
    setRow(value);
    setId(value.id);
    changed(value);
  }
  // Inspection creates a backend audit record, so read only on an explicit
  // operator action rather than polling or refetching on window focus.
  const inspect = useMutation({
    mutationFn: async (value: string) =>
      visitSchema.parse(
        await request(
          `/api/backend/requests/${z.string().uuid().parse(value)}`,
        ),
      ),
    onSuccess: apply,
  });
  const cancel = useMutation({
    mutationFn: async () => {
      if (
        !row ||
        id.trim() !== row.id ||
        !activeVisitStatuses.has(row.status) ||
        reason.trim().length < 10
      )
        throw new Error(
          "Inspect the current visit and provide a cancellation reason.",
        );
      return visitSchema.parse(
        await request(`/api/backend/admin/requests/${row.id}/cancel`, {
          method: "POST",
          body: { expected_version: row.version, reason: reason.trim() },
        }),
      );
    },
    onSuccess: (value) => {
      apply(value);
      setReason("");
      void queries.invalidateQueries({ queryKey: ["staff", userId] });
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        ["SESSION_CHANGED", "SIGN_IN_REQUIRED"].includes(error.code)
      )
        return;
      // A competing decision is re-read, never overwritten or retried as a write.
      if (row) inspect.mutate(row.id);
    },
  });
  const busy = inspect.isPending || cancel.isPending;
  return (
    <section className="card" aria-labelledby="visit-inspection-title">
      <h2 id="visit-inspection-title">Visit inspection</h2>
      <p>
        Each inspection is recorded. General staff lists do not show precise
        vendor locations.
      </p>
      <label>
        Visit ID
        <input
          value={id}
          onChange={(event) => setId(event.target.value)}
          maxLength={36}
          disabled={busy}
          autoComplete="off"
        />
      </label>
      <div className="actions">
        <button
          disabled={busy || !z.string().uuid().safeParse(id.trim()).success}
          onClick={() => {
            cancel.reset();
            inspect.mutate(id.trim());
          }}
        >
          Inspect visit
        </button>
      </div>
      {inspect.error ? <p role="alert">{errorMessage(inspect.error)}</p> : null}
      {cancel.error ? <p role="alert">{errorMessage(cancel.error)}</p> : null}
      {busy ? <p role="status">Loading the committed visit state…</p> : null}
      {row ? (
        <div className="details">
          <h3>Last inspected visit</h3>
          <p>
            <code>{row.id}</code>
          </p>
          <p>Visit status: {row.status}</p>
          <p>Version: {row.version}</p>
          <p>Customer: {row.customer_name}</p>
          <p>
            Customer account ID: <code>{row.customer_id}</code>
          </p>
          <p>Business: {row.vendor_name}</p>
          <p>
            Business ID: <code>{row.vendor_id}</code>
          </p>
          <p>
            Meeting label:{" "}
            {row.meeting_label ?? "Not supplied or no longer retained."}
          </p>
          <p>
            Deadline (India time):{" "}
            {new Date(row.expires_at).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })}
          </p>
          {row.reason ? <p className="note">{row.reason}</p> : null}
          {activeVisitStatuses.has(row.status) ? (
            <>
              <label>
                Cancellation reason
                <textarea
                  rows={3}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={busy}
                />
              </label>
              <div className="actions">
                <button
                  disabled={
                    busy || id.trim() !== row.id || reason.trim().length < 10
                  }
                  onClick={() => cancel.mutate()}
                >
                  Cancel visit
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
