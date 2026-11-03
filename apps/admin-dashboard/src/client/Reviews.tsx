import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import { vendorSchema } from "@mystreetvendor/shared-types";
import { errorMessage, type StaffRequest } from "./http";

const reviewSchema = z.object({
  id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  display_name: z.string(),
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  evidence_note: z.string(),
  submitted_at: z.string(),
});
const pageSchema = z.object({
  items: z.array(reviewSchema),
  next_cursor: z.string().nullable(),
});
type Review = z.infer<typeof reviewSchema>;
type Props = { request: StaffRequest; userId: string };

function ReviewCard({
  review,
  request,
  userId,
  decided,
  failed,
}: Props & {
  review: Review;
  decided(status: string): void;
  failed(message: string): void;
}) {
  const queries = useQueryClient();
  const [reason, setReason] = useState("");
  const [expanded, setExpanded] = useState(false);
  const details = useQuery({
    queryKey: ["staff", userId, "business", review.vendor_id],
    enabled: expanded,
    queryFn: async ({ signal }) =>
      vendorSchema.parse(
        await request(`/api/backend/vendors/${review.vendor_id}`, { signal }),
      ),
  });
  const decision = useMutation({
    mutationFn: async (value: "VERIFIED" | "REJECTED") =>
      vendorSchema.parse(
        await request(
          `/api/backend/admin/vendors/${review.vendor_id}/verification`,
          { method: "POST", body: { decision: value, reason: reason.trim() } },
        ),
      ),
    onSuccess: (row) => {
      // Render only the committed decision and refresh competing staff changes.
      queries.setQueryData(["staff", userId, "business", row.id], row);
      decided(row.verification_status);
      void queries.invalidateQueries({ queryKey: ["staff", userId] });
    },
    onError: (error) => {
      failed(errorMessage(error));
      void queries.invalidateQueries({ queryKey: ["staff", userId] });
    },
  });
  return (
    <article className="card" aria-label={review.display_name}>
      <h3>{review.display_name}</h3>
      <p className="muted">Submission status: {review.status}</p>
      <p>
        <strong>Business ID:</strong> <code>{review.vendor_id}</code>
      </p>
      <p className="note">{review.evidence_note}</p>
      <p className="muted">
        Submitted {new Date(review.submitted_at).toLocaleString()}
      </p>
      <button className="secondary" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Hide business details" : "View business details"}
      </button>
      {expanded ? (
        <div className="details">
          {details.isPending ? (
            <p role="status">Loading business details…</p>
          ) : null}
          {details.error ? (
            <p role="alert">{errorMessage(details.error)}</p>
          ) : null}
          {details.data ? (
            <>
              <p>
                {details.data.description ||
                  "No business description supplied."}
              </p>
              <p>
                Categories:{" "}
                {details.data.categories.map((item) => item.name_en).join(", ")}
              </p>
              <p>Business status: {details.data.verification_status}</p>
            </>
          ) : null}
        </div>
      ) : null}
      {review.status === "PENDING" ? (
        <>
          <label>
            Review reason
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              disabled={decision.isPending}
            />
          </label>
          <p className="muted">
            Use at least 10 characters. Your reason is recorded with the staff
            decision.
          </p>
          <div className="actions">
            <button
              disabled={decision.isPending || reason.trim().length < 10}
              onClick={() => decision.mutate("VERIFIED")}
            >
              Approve business
            </button>
            <button
              className="secondary"
              disabled={decision.isPending || reason.trim().length < 10}
              onClick={() => decision.mutate("REJECTED")}
            >
              Reject business
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}

export function Reviews({ request, userId }: Props) {
  const [status, setStatus] = useState<Review["status"]>("PENDING");
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const reviews = useInfiniteQuery({
    queryKey: ["staff", userId, "reviews", status],
    initialPageParam: null as string | null,
    queryFn: async ({ signal, pageParam }) =>
      pageSchema.parse(
        await request(
          `/api/backend/admin/verifications?status=${status}&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
          { signal },
        ),
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    refetchInterval: 30000,
  });
  return (
    <section aria-labelledby="reviews-title">
      <div className="section-heading">
        <h2 id="reviews-title">Business reviews</h2>
        <button
          className="secondary"
          disabled={reviews.isFetching}
          onClick={() => {
            void reviews.refetch();
          }}
        >
          Refresh reviews
        </button>
      </div>
      <label className="filter">
        Review status
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as Review["status"])
          }
        >
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </label>
      {notice ? <p role="status">{notice}</p> : null}
      {problem ? <p role="alert">{problem}</p> : null}
      {reviews.error ? <p role="alert">{errorMessage(reviews.error)}</p> : null}
      {reviews.isPending ? <p role="status">Loading reviews…</p> : null}
      {reviews.data?.pages[0]?.items.length === 0 ? (
        <p>No reviews in this view.</p>
      ) : null}
      <div className="review-grid">
        {reviews.data?.pages
          .flatMap((page) => page.items)
          .map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              request={request}
              userId={userId}
              decided={(value) => {
                setProblem(null);
                setNotice(`Review saved: ${value}.`);
              }}
              failed={(message) => {
                setNotice(null);
                setProblem(message);
              }}
            />
          ))}
      </div>
      {reviews.hasNextPage ? (
        <button
          className="secondary"
          disabled={reviews.isFetchingNextPage}
          onClick={() => {
            void reviews.fetchNextPage();
          }}
        >
          Load more reviews
        </button>
      ) : null}
    </section>
  );
}
