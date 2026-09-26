import React from "react";
import RouteSkeleton from "@/components/ui/RouteSkeleton";

/** Multisig is a signer form plus a thresholds form. */
export default function Loading() {
  return <RouteSkeleton variant="form" maxWidthClass="max-w-[900px]" count={2} />;
}
