import { admin, getConfig } from '@/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A private calendar feed (.ics) of every song's due date and every release date.
// Subscribe to it in Apple Calendar or Google Calendar; it refreshes on its own.
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const day = (iso) => iso.replace(/-/g, '');
const nextDay = (iso) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
const fold = (line) => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); };
const STATUS = { progress: 'In progress', review: 'Waiting on the client', changes: 'Changes requested', approved: 'Approved' };

export async function GET(req, { params }) {
  const token = String(params.token || '').replace(/\.ics$/i, '');
  const want = await getConfig('calendar_token');
  if (!want || token !== want) return new Response('Not found', { status: 404 });
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const db = admin();
  const { data: projects } = await db.from('projects').select('id,title,artist,type,release,archived, songs(id,title,status,eta)').eq('archived', false);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const ev = [];
  for (const p of projects || []) {
    for (const s of p.songs || []) {
      if (!s.eta || s.status === 'approved') continue;
      ev.push([
        'BEGIN:VEVENT', `UID:song-${s.id}@ctrlroom`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day(s.eta)}`, `DTEND;VALUE=DATE:${nextDay(s.eta)}`,
        `SUMMARY:${esc(`Due: ${s.title} · ${p.artist}`)}`,
        `DESCRIPTION:${esc(`${p.title} (${p.type})\n${STATUS[s.status] || ''}\n${site}/s/${s.id}`)}`,
        `URL:${site}/s/${s.id}`, 'TRANSP:TRANSPARENT', 'CATEGORIES:CTRL ROOM',
        'BEGIN:VALARM', 'TRIGGER:-PT15H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${s.title} is due tomorrow`)}`, 'END:VALARM',
        'END:VEVENT',
      ]);
    }
    if (p.release) {
      ev.push([
        'BEGIN:VEVENT', `UID:release-${p.id}@ctrlroom`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day(p.release)}`, `DTEND;VALUE=DATE:${nextDay(p.release)}`,
        `SUMMARY:${esc(`Release: ${p.title} · ${p.artist}`)}`,
        `DESCRIPTION:${esc(`${p.type} out today\n${site}/p/${p.id}`)}`, `URL:${site}/p/${p.id}`, 'TRANSP:TRANSPARENT', 'END:VEVENT',
      ]);
    }
  }
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CTRL ROOM//Due dates//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:CTRL ROOM', 'X-WR-CALDESC:Mix due dates and releases', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    ...ev.flat(), 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="ctrl-room.ics"', 'Cache-Control': 'no-store' } });
}
