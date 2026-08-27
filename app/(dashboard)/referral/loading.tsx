import React from "react";
import RouteSkeleton from "@/components/ui/RouteSkeleton";

/** Referral shows three stats above the share panel. */
export default function Loading() {
  return <RouteSkeleton variant="stats" maxWidthClass="max-w-[1000px]" count={3} />;
}
