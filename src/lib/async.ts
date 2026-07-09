// Small async primitives shared across the integration layer: a sleep, a bounded
// concurrency map, and a rate-limit-aware retry. Kept dependency-free so any
// adapter (HubSpot, Sillage, FullEnrich) can fan out politely without each one
// re-implementing the same loop.

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run `task` over `items` with at most `limit` promises in flight at once,
// preserving input order in the result. Lets an adapter resolve many per-item
// reads without firing them all at once and tripping the API's rate limit
// (which a bare `Promise.all(items.map(...))` would do).
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
};

// Retry a call that fails transiently, backing off exponentially between
// attempts. By default only HTTP 429 (rate limit) is retried; anything else
// rethrows immediately so real errors surface without delay.
export async function withRetry<T>(call: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const isRetryable = options.isRetryable ?? isRateLimit;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) throw error;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
}

// True for a rate-limit response, covering both the HubSpot SDK's flat `code`
// and an axios-style `response.status`.
export function isRateLimit(error: unknown): boolean {
  const status =
    (error as { code?: number })?.code ??
    (error as { response?: { status?: number } })?.response?.status;
  return status === 429;
}
