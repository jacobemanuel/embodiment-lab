export type FetchPageResult<T> = {
  data: T[] | null;
  error: unknown | null;
};

export type FetchAllPagesOptions = {
  pageSize?: number;
  maxPages?: number;
};

/**
 * Fetches all rows for a query using PostgREST range pagination.
 * This is required because the backend enforces a max rows cap per request (commonly 1000).
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<FetchPageResult<T>>,
  options?: FetchAllPagesOptions
): Promise<T[]> {
  const pageSize = options?.pageSize ?? 1000;
  const maxPages = options?.maxPages ?? 50;

  const all: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await fetchPage(from, to);
    if (error) throw error;

    const rows = data ?? [];
    all.push(...rows);

    if (rows.length < pageSize) return all;
  }

  // If we hit maxPages, return what we have (better than silently truncating).
  console.warn(`fetchAllPages reached maxPages=${maxPages}; results may be truncated.`);
  return all;
}

/**
 * Fetches rows for a set of session IDs by batching the IN filter and paginating each batch.
 * Use this when the session list is large to avoid query size limits.
 */
export async function fetchAllBySessionIds<T>(
  sessionIds: string[],
  fetchPage: (sessionIds: string[], from: number, to: number) => Promise<FetchPageResult<T>>,
  options?: FetchAllPagesOptions & { chunkSize?: number }
): Promise<T[]> {
  const chunkSize = options?.chunkSize ?? 200;
  const chunks: string[][] = [];
  for (let i = 0; i < sessionIds.length; i += chunkSize) {
    chunks.push(sessionIds.slice(i, i + chunkSize));
  }

  const all: T[] = [];
  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    const rows = await fetchAllPages((from, to) => fetchPage(chunk, from, to), options);
    all.push(...rows);
  }
  return all;
}
