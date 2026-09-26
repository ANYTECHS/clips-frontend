import React from "react";
import RouteSkeleton from "@/components/ui/RouteSkeleton";

/** Processing is a list of in-flight jobs. */
export default function Loading() {
  return <RouteSkeleton variant="list" maxWidthClass="max-w-[900px]" count={4} />;
}
