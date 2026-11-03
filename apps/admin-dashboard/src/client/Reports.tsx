import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import { visitSchema, type Visit } from "@mystreetvendor/shared-types";
import { errorMessage, type StaffRequest } from "./http";
const reportSchema = z.object({
  id: z.string().uuid(),
  request_id: z.string().uuid(),
  reporter_id: z.string().uuid(),
  category: z.enum(["SAFETY", "NO_SHOW", "OTHER"]),
  reason: z.string(),
  status: z.enum(["OPEN", "RESOLVED"]),
  created_at: z.string(),
});
const pageSchema = z.object({
  items: z.array(reportSchema),
  next_cursor: z.string().nullable(),
});
type Report = z.infer<typeof reportSchema>;
type Props = {
  request: StaffRequest;
  userId: string;
  inspected(visit: Visit): void;
};
function ReportCard({
  report,
  request,
  userId,
  inspected,
  resolved,
  failed,
}: Props & {
  report: Report;
  resolved(): void;
  failed(message: string): void;
}) {
  const queries = useQueryClient();
  const [reason, setReason] = useState("");
  const inspect = useMutation({
    mutationFn: async () =>
      visitSchema.parse(
        await request(`/api/backend/requests/${report.request_id}`),
      ),
    onSuccess: inspected,
  });
  const resolve = useMutation({
    mutationFn: async () =>
      z
        .object({
          id: z.string().uuid(),
          status: z.literal("RESOLVED"),
          resolved_at: z.string(),
        })
        .parse(
          await request(`/api/backend/admin/reports/${report.id}/resolution`, {
            method: "POST",
            body: { reason: reason.trim() },
          }),
        ),
    onSuccess: () => {
      resolved();
      void queries.invalidateQueries({ queryKey: ["staff", userId] });
    },
    onError: (error) => {
      failed(errorMessage(error));
      void queries.invalidateQueries({ queryKey: ["staff", userId] });
    },
  });
  const busy = inspect.isPending || resolve.isPending;
  return (
    <article className="card" aria-label={`Report ${report.id}`}>
      <h3>
        {report.category} · {report.status}
      </h3>
      <p className="note">{report.reason}</p>
      <p>
        Report ID: <code>{report.id}</code>
      </p>
      <p>
        Visit ID: <code>{report.request_id}</code>
      </p>
      <p>
        Reporter account ID: <code>{report.reporter_id}</code>
      </p>
      <p className="muted">
        Submitted {new Date(report.created_at).toLocaleString()}
      </p>
      <button
        className="secondary"
        disabled={busy}
        onClick={() => inspect.mutate()}
      >
        Inspect visit
      </button>
      {inspect.error ? <p role="alert">{errorMessage(inspect.error)}</p> : null}
      {report.status === "OPEN" ? (
        <>
          <label>
            Resolution reason
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
              disabled={busy || reason.trim().length < 10}
              onClick={() => resolve.mutate()}
            >
              Resolve report
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}
export function Reports({ request, userId, inspected }: Props) {
  const [status, setStatus] = useState<Report["status"]>("OPEN");
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const reports = useInfiniteQuery({
    queryKey: ["staff", userId, "reports", status],
    initialPageParam: null as string | null,
    queryFn: async ({ signal, pageParam }) =>
      pageSchema.parse(
        await request(
          `/api/backend/admin/reports?status=${status}&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
          { signal },
        ),
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: 30000,
  });
  return (
    <section aria-labelledby="reports-title">
      <div className="section-heading">
        <h2 id="reports-title">Reports</h2>
        <button
          className="secondary"
          disabled={reports.isFetching}
          onClick={() => {
            void reports.refetch();
          }}
        >
          Refresh reports
        </button>
      </div>
      <label className="filter">
        Report status
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as Report["status"])
          }
        >
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </label>
      {notice ? <p role="status">{notice}</p> : null}
      {problem ? <p role="alert">{problem}</p> : null}
      {reports.error ? <p role="alert">{errorMessage(reports.error)}</p> : null}
      {reports.isPending ? <p role="status">Loading reports…</p> : null}
      {reports.data?.pages[0]?.items.length === 0 ? (
        <p>No reports in this view.</p>
      ) : null}
      <div className="review-grid">
        {reports.data?.pages
          .flatMap((page) => page.items)
          .map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              request={request}
              userId={userId}
              inspected={inspected}
              resolved={() => {
                setProblem(null);
                setNotice("Report resolved.");
              }}
              failed={(message) => {
                setNotice(null);
                setProblem(message);
              }}
            />
          ))}
      </div>
      {reports.hasNextPage ? (
        <button
          className="secondary"
          disabled={reports.isFetchingNextPage}
          onClick={() => {
            void reports.fetchNextPage();
          }}
        >
          Load more reports
        </button>
      ) : null}
    </section>
  );
}
