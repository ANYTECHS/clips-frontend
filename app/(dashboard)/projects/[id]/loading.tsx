import React from "react";
import RouteSkeleton from "@/components/ui/RouteSkeleton";

/** A project detail page is a clip list under its header. */
export default function Loading() {
  return <RouteSkeleton variant="list" maxWidthClass="max-w-[1200px]" count={5} />;
}
