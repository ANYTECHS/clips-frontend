"use client";

import { useCallback, useRef } from "react";

type DynamicLoader = () => Promise<unknown>;

export function usePreloadComponent(loader: DynamicLoader) {
  const preloaded = useRef(false);

  const preload = useCallback(() => {
    if (preloaded.current) return;
    preloaded.current = true;
    loader().catch(() => {
      preloaded.current = false;
    });
  }, [loader]);

  return preload;
}
