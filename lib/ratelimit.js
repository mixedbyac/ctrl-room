// Simple per-IP rate limits for public endpoints (per server instance; stops floods and scripted abuse).
const buckets = new Map();
export function clientIp(req) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
/** Returns a 429 Response if this caller went over `max` requests per `windowMs` for `name`, else null. */
export function limit(req, name, max, windowMs, key = clientIp(req)) {
  const k = `${name}:${key}`, now = Date.now();
  const hits = (buckets.get(k) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(k, hits);
  if (buckets.size > 20000) for (const [kk, v] of buckets) if (!v.length || now - v[v.length - 1] > 3600_000) buckets.delete(kk);
  if (hits.length > max) {
    return Response.json({ error: 'Too many requests. Wait a minute and try again.' }, { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } });
  }
  return null;
}
