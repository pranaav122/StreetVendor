import { useState } from "react";
import type { StaffRequest } from "./http";
import { Reviews } from "./Reviews";
import { BusinessControls } from "./BusinessControls";
export function StaffTools({
  request,
  userId,
}: {
  request: StaffRequest;
  userId: string;
}) {
  const [view, setView] = useState<"reviews" | "business">("reviews");
  return (
    <>
      <nav className="tool-nav" aria-label="Staff tools">
        <button
          className="secondary"
          aria-pressed={view === "reviews"}
          onClick={() => setView("reviews")}
        >
          Business reviews
        </button>
        <button
          className="secondary"
          aria-pressed={view === "business"}
          onClick={() => setView("business")}
        >
          Business controls
        </button>
      </nav>
      {view === "reviews" ? (
        <Reviews request={request} userId={userId} />
      ) : (
        <BusinessControls request={request} userId={userId} />
      )}
    </>
  );
}
