import { admin, getConfig, json, fail, sendText } from '@/lib/server';
import { limit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

// For Zapier (Invoice2go › "Invoice paid" › Webhooks by Zapier POST here).
// URL: /api/invoices/hook?key=YOUR_KEY   body: { "number": "1042", "status": "paid" }
export async function POST(req) {
  const slow = limit(req, 'invoice-hook', 60, 600_000); if (slow) return slow;
  const key = new URL(req.url).searchParams.get('key') || req.headers.get('x-ctrl-room-key') || '';
  const want = await getConfig('invoice_hook_key');
  if (!want || key !== want) return fail('Not allowed.', 403);
  let b = await req.json().catch(() => null);
  if (!b) { const f = await req.formData().catch(() => null); b = f ? Object.fromEntries(f) : {}; }
  const number = String(b.number || b.invoice_number || b.document_number || '').replace(/^#/, '').trim();
  if (!number) return fail('Send the invoice number as "number".');
  const status = /void|cancel/i.test(String(b.status || '')) ? 'void' : /unpaid|due|open/i.test(String(b.status || '')) ? 'unpaid' : 'paid';
  const db = admin();
  const { data: rows } = await db.from('invoices').select('id, project_id, number, status').ilike('number', number);
  if (!rows?.length) return fail(`No invoice ${number} in CTRL ROOM.`, 404);
  for (const r of rows) {
    await db.from('invoices').update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null }).eq('id', r.id);
    if (status === 'paid' && r.status !== 'paid') {
      const { data: songs } = await db.from('songs').select('id').eq('project_id', r.project_id).limit(1);
      if (songs?.[0]) await db.from('updates').insert({ song_id: songs[0].id, body: `Invoice ${number} is paid. Thank you!` });
      if (process.env.ENGINEER_PHONE) await sendText(process.env.ENGINEER_PHONE, `CTRL ROOM: invoice ${number} was paid.`).catch(() => {});
    }
  }
  return json({ ok: true, updated: rows.length, status });
}
