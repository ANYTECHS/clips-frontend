"use client";

import { useState, useEffect, useRef } from "react";
import { loadActiveJob } from "./processingStore";

const STORAGE_PREFIX = "clipcash_free_agent_job_";

function resolveAllIdentifiers(
  userIdentifiers?: (string | null | undefined)[] | string | null
): string[] {
  const ids: string[] = [];

  const add = (val: any) => {
    if (val && typeof val === "string" && val.trim()) {
      const clean = val.trim().toLowerCase();
      if (!ids.includes(clean)) ids.push(clean);
    }
  };

  if (Array.isArray(userIdentifiers)) {
    userIdentifiers.forEach(add);
  } else if (userIdentifiers) {
    add(userIdentifiers);
  }

  if (typeof window !== "undefined") {
    try {
      add(localStorage.getItem("clipcash_current_user_id"));
      add(localStorage.getItem("clipcash_current_user_email"));
      add(localStorage.getItem("clipcash_current_user_address"));
    } catch {}
  }

  return ids;
}

// Checks if the user or device has already used or claimed their free welcome job
export function hasClaimedFreeJob(
  userIdentifiers?: (string | null | undefined)[] | string | null
): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(`${STORAGE_PREFIX}claimed`) === "used") return true;
    if (localStorage.getItem(`${STORAGE_PREFIX}device_used`) === "used") return true;
    if (localStorage.getItem("clipcash_has_clipped_first_project") === "true") return true;

    const active = loadActiveJob();
    if (active && active.videoId) return true;

    const list = resolveAllIdentifiers(userIdentifiers);
    for (const id of list) {
      if (localStorage.getItem(`${STORAGE_PREFIX}${id}`) === "used") return true;
      if (localStorage.getItem(`clipcash_user_has_clipped_${id}`) === "true") return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function markFreeJobAsClaimed(
  userIdentifiers?: (string | null | undefined)[] | string | null
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}claimed`, "used");
    localStorage.setItem(`${STORAGE_PREFIX}device_used`, "used");
    localStorage.setItem("clipcash_has_clipped_first_project", "true");

    const list = resolveAllIdentifiers(userIdentifiers);
    for (const id of list) {
      localStorage.setItem(`${STORAGE_PREFIX}${id}`, "used");
      localStorage.setItem(`clipcash_user_has_clipped_${id}`, "true");
    }

    window.dispatchEvent(new Event("clipcash_free_job_updated"));
  } catch {}
}

export function useFreeJobClaimed(
  userIdentifiers?: (string | null | undefined)[] | string | null
): boolean {
  const [claimed, setClaimed] = useState<boolean>(() => hasClaimedFreeJob(userIdentifiers));

  const list = resolveAllIdentifiers(userIdentifiers);
  const cacheKey = list.sort().join(":");

  const idsRef = useRef(userIdentifiers);
  idsRef.current = userIdentifiers;

  useEffect(() => {
    setClaimed(hasClaimedFreeJob(idsRef.current));

    const onUpdate = () => {
      setClaimed(hasClaimedFreeJob(idsRef.current));
    };

    window.addEventListener("clipcash_free_job_updated", onUpdate);
    window.addEventListener("storage", onUpdate);

    return () => {
      window.removeEventListener("clipcash_free_job_updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, [cacheKey]);

  return claimed;
}
