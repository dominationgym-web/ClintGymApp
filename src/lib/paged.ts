// Supabase hands back at most 1000 rows a request. With weekly sessions
// filled months ahead (0237) a trainer's calendar window can hold several
// thousand, so ask page by page until a short page comes back. The query
// must have a stable order (e.g. starts_at then id) so pages don't overlap.
export const PAGE_SIZE = 1000;

export async function fetchPaged<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ data: T[]; error: unknown }> {
  const all: T[] = [];
  for (let n = 0; n < 50; n++) {
    const { data, error } = await page(n * PAGE_SIZE, n * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) return { data: all, error };
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: all, error: null };
}
