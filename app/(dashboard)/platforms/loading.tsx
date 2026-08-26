import React from "react";
import RouteSkeleton from "@/components/ui/RouteSkeleton";

/** Platforms is a grid of connection cards. */
export default function Loading() {
  return <RouteSkeleton variant="cards" maxWidthClass="max-w-[1200px]" count={6} />;
}
