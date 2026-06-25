"use client";

import { useNetworkContext } from "@/app/context/NetworkContext";
import type { StellarNetwork } from "@/app/lib/networkConfig";

/**
 * Hook for reading and updating the runtime network override. Uses
 * `NetworkProvider` to broadcast changes to the whole React tree so a
 * full page reload is not required.
 */
export function useNetworkOverride() {
  const { network, setNetwork } = useNetworkContext();
  return { network, setNetwork };
}
