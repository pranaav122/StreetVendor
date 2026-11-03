import { useState } from "react";
import type { Visit } from "@mystreetvendor/shared-types";
import type { StaffRequest } from "./http";
import { Reviews } from "./Reviews";
import { BusinessControls } from "./BusinessControls";
import { Reports } from "./Reports";
import { VisitInspector } from "./VisitInspector";
import { AccountControls } from "./AccountControls";
const tabs = [
  ["reviews", "Business reviews"],
  ["business", "Business controls"],
  ["reports", "Reports"],
  ["inspection", "Visit inspection"],
  ["accounts", "Account controls"],
] as const;
type View = (typeof tabs)[number][0];
export function StaffTools({
  request,
  userId,
}: {
  request: StaffRequest;
  userId: string;
}) {
  const [view, setView] = useState<View>("reviews");
  const [visit, setVisit] = useState<Visit | null>(null);
  const panels = {
    reviews: <Reviews request={request} userId={userId} />,
    business: <BusinessControls request={request} userId={userId} />,
    reports: (
      <Reports
        request={request}
        userId={userId}
        inspected={(value) => {
          setVisit(value);
          setView("inspection");
        }}
      />
    ),
    inspection: (
      <VisitInspector
        request={request}
        userId={userId}
        initialVisit={visit}
        changed={setVisit}
      />
    ),
    accounts: <AccountControls request={request} userId={userId} />,
  };
  return (
    <>
      <nav className="tool-nav" aria-label="Staff tools">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            className="secondary"
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {panels[view]}
    </>
  );
}
