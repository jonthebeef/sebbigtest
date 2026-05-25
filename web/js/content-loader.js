const cache = new Map();
export async function loadSubject(slug) {
  if (cache.has(slug)) return cache.get(slug);
  const resp = await fetch(`content/${slug}.json`);
  if (!resp.ok) throw new Error(`Cannot load content/${slug}.json`);
  const data = await resp.json();
  cache.set(slug, data);
  return data;
}
