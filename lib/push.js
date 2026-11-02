// Phone / desktop push notifications (Web Push), with no outside service and nothing to set up:
// the server makes its own key pair once (saved in app_config) and encrypts each message itself (RFC 8291 / 8292).
import { createECDH, createHmac, createCipheriv, createPrivateKey, randomBytes, sign } from 'crypto';
import { admin, getConfig, setConfig } from '@/lib/server';
import { prefOf } from '@/lib/notify';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

/** The server's key pair (made once). pub is what browsers subscribe with. */
export async function vapidKeys() {
  const saved = await getConfig('vapid_keys');
  if (saved) { try { const k = JSON.parse(saved); if (k.pub && k.priv) return k; } catch {} }
  const ec = createECDH('prime256v1'); ec.generateKeys();
  const k = { pub: b64u(ec.getPublicKey()), priv: b64u(ec.getPrivateKey()) };
  await setConfig('vapid_keys', JSON.stringify(k));
  return k;
}

function vapidHeader(endpoint, keys) {
  const pub = unb64u(keys.pub);
  const key = createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: keys.priv } });
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:mix@ctrl-room.app' }));
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.pub}`;
}

function encrypt(sub, payload) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const ec = createECDH('prime256v1'); ec.generateKeys();
  const asPub = ec.getPublicKey(), secret = ec.computeSecret(uaPub);
  const ikm = hmac(hmac(auth, secret), Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])]));
  const salt = randomBytes(16), prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const c = createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}

async function subsAll() { try { return JSON.parse((await getConfig('push_subs')) || '{}'); } catch { return {}; } }

export async function saveSub(email, sub, device) {
  const all = await subsAll(), e = String(email).toLowerCase();
  const list = (all[e] || []).filter((x) => x.endpoint !== sub.endpoint);
  list.unshift({ endpoint: sub.endpoint, keys: sub.keys, device: device || '', at: new Date().toISOString() });
  all[e] = list.slice(0, 6);
  await setConfig('push_subs', JSON.stringify(all));
}
export async function removeSub(email, endpoint) {
  const all = await subsAll(), e = String(email).toLowerCase();
  all[e] = (all[e] || []).filter((x) => !endpoint || x.endpoint !== endpoint);
  if (!all[e].length) delete all[e];
  await setConfig('push_subs', JSON.stringify(all));
}
export async function subsFor(email) { return (await subsAll())[String(email).toLowerCase()] || []; }

/** Which of these people want a push for this kind (follows their in-app setting in Settings › Notifications). */
async function wanting(db, emails, kind) {
  if (!kind) return emails;
  const want = new Set(emails.map((e) => e.toLowerCase())), out = [];
  for (let page = 1; page <= 20 && want.size; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    for (const u of data.users || []) {
      const e = (u.email || '').toLowerCase();
      if (!want.has(e)) continue;
      want.delete(e);
      if (prefOf(u.user_metadata?.notify, kind, 'push') && prefOf(u.user_metadata?.notify, kind, 'app')) out.push(e);
    }
    if ((data.users || []).length < 200) break;
  }
  return [...out, ...want]; // people with no account record: just send
}

/** Push { title, body, url } to these emails' phones and computers. Best effort, never throws. */
export async function pushTo(emails, msg, { kind = null } = {}) {
  try {
    const all = await subsAll();
    let list = [...new Set((emails || []).map((e) => String(e).toLowerCase()))].filter((e) => all[e]?.length);
    if (!list.length) return { sent: 0 };
    list = await wanting(admin(), list, kind);
    const keys = await vapidKeys();
    const payload = JSON.stringify({ title: msg.title || 'CTRL ROOM', body: msg.body || '', url: msg.url || '/', tag: msg.tag || undefined });
    let sent = 0, dirty = false;
    await Promise.all(list.flatMap((e) => (all[e] || []).map(async (s) => {
      try {
        const r = await fetch(s.endpoint, { method: 'POST', signal: AbortSignal.timeout(8000),
          headers: { Authorization: vapidHeader(s.endpoint, keys), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal' },
          body: encrypt(s, payload) });
        if (r.status === 404 || r.status === 410) { all[e] = all[e].filter((x) => x.endpoint !== s.endpoint); dirty = true; }
        else if (r.ok) sent++;
      } catch {}
    })));
    if (dirty) await setConfig('push_subs', JSON.stringify(all));
    return { sent };
  } catch { return { sent: 0 }; }
}
