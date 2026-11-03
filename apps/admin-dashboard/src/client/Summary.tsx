import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { StaffRequest } from "./http";
import { errorMessage } from "./http";
const count = z.number().int().nonnegative();
const schema = z.object({
  verified_vendors: count,
  pending_verifications: count,
  open_reports: count,
  active_visits: count,
  pending_visits: count,
  completed_visits_today: count,
  day_timezone: z.literal("Asia/Kolkata"),
});
export function Summary({
  request,
  userId,
}: {
  request: StaffRequest;
  userId: string;
}) {
  const summary = useQuery({
    queryKey: ["staff", userId, "summary"],
    queryFn: async ({ signal }) =>
      schema.parse(await request("/api/backend/admin/summary", { signal })),
    refetchInterval: 30000,
  });
  return (
    <section aria-labelledby="summary-title">
      <div className="section-heading">
        <h2 id="summary-title">Service overview</h2>
        <button
          className="secondary"
          disabled={summary.isFetching}
          onClick={() => {
            void summary.refetch();
          }}
        >
          Refresh summary
        </button>
      </div>
      {summary.isPending ? <p role="status">Loading service counts…</p> : null}
      {summary.error ? <p role="alert">{errorMessage(summary.error)}</p> : null}
      {summary.data ? (
        <>
          <dl className="counts">
            <div>
              <dt>Verified businesses</dt>
              <dd>{summary.data.verified_vendors}</dd>
            </div>
            <div>
              <dt>Pending reviews</dt>
              <dd>{summary.data.pending_verifications}</dd>
            </div>
            <div>
              <dt>Open reports</dt>
              <dd>{summary.data.open_reports}</dd>
            </div>
            <div>
              <dt>Active visits</dt>
              <dd>{summary.data.active_visits}</dd>
            </div>
            <div>
              <dt>Pending visits</dt>
              <dd>{summary.data.pending_visits}</dd>
            </div>
            <div>
              <dt>Completed today</dt>
              <dd>{summary.data.completed_visits_today}</dd>
            </div>
          </dl>
          <p className="muted">
            Day boundaries use India time. Visit counts are not sales or
            earnings.
          </p>
        </>
      ) : null}
    </section>
  );
}
