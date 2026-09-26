import React from "react";
import RouteSkeleton from "@/components/ui/RouteSkeleton";

/** Settings stacks account, security, wallet and privacy panels. */
export default function Loading() {
  return <RouteSkeleton variant="form" maxWidthClass="max-w-[900px]" count={4} />;
}
