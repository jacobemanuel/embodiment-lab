export type FetchPageResult<T> = {
  data: T[] | null;
  error: unknown | null;
};

/**
 * Fetches all rows for a query using PostgREST range pagination.
 * This is required because the backend enforces a max rows cap per request (commonly 1000).
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<FetchPageResult<T>>,
  options?: { pageSize?: number; maxPages?: number }
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
  return all;
}
