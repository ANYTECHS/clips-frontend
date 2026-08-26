import { useState, useEffect } from "react";
import { DEBOUNCE_DEFAULT_DELAY_MS } from "@/app/lib/constants";

/**
 * Debounces a value by the given delay (ms).
 * Returns the debounced value only after the input has been
 * stable for `delay` milliseconds.
 */
export function useDebounce<T>(value: T, delay = DEBOUNCE_DEFAULT_DELAY_MS): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}