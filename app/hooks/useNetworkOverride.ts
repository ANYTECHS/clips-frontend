"use client";

import { useCallback } from "react";
import { useNetworkContext } from "@/app/context/NetworkContext";
import type { StellarNetwork } from "@/app/lib/networkConfig";
import { NetworkPreferenceStorage } from "@/app/lib/userPreferences";

/**
 * Hook for reading and updating the runtime network override. Uses
 * `NetworkProvider` to broadcast changes to the whole React tree so a
 * full page reload is not required.
 *
 * @returns An object containing the current overridden network state and its setter function.
 */
export function useNetworkOverride() {
  const { network, setNetwork } = useNetworkContext();

  const setNetworkOverride = useCallback(
    (nextNetwork: StellarNetwork) => {
      NetworkPreferenceStorage.set(nextNetwork);
      setNetwork(nextNetwork);
    },
    [setNetwork]
  );

  const persistedNetwork = NetworkPreferenceStorage.get() ?? network;

  return { network: persistedNetwork, setNetwork: setNetworkOverride };
}
