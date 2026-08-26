import React from "react";
import RouteSkeleton from "@/components/ui/RouteSkeleton";

/** Billing renders the plan tiers as a card grid. */
export default function Loading() {
  return <RouteSkeleton variant="cards" maxWidthClass="max-w-[1200px]" count={3} />;
}
