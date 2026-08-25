import React from "react";
import RouteSkeleton from "@/components/ui/RouteSkeleton";

/** Analytics leads with a stat row above the charts. */
export default function Loading() {
  return <RouteSkeleton variant="stats" maxWidthClass="max-w-[1200px]" count={4} />;
}
