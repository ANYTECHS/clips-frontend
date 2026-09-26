/**
 * parallelLimit — concurrency-capped Promise execution.
 *
 * Runs an array of async task factories with at most `concurrency` tasks
 * in flight at once. Results are returned in the same order as the input
 * tasks, matching the behaviour of Promise.all.
 *
 * This is intentionally a thin utility with no external dependencies.
 *
 * @example
 * const results = await parallelLimit(
 *   files.map((f) => () => processFile(f)),
 *   3,
 * );
 */
export async function parallelLimit<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  if (concurrency < 1) {
    throw new RangeError(`parallelLimit: concurrency must be >= 1, got ${concurrency}`);
  }

  const results: T[] = new Array(tasks.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]!();
    }
  };

  const slots = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: slots }, worker));

  return results;
}
