'use client';
// Builds one .zip in the browser from a list of download links, reading each file as it arrives
// (no compression: audio doesn't shrink). Returns a Blob to save. Paths keep their folders.
let TABLE;
function crc32(buf, crc) {
  if (!TABLE) { TABLE = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TABLE[n] = c >>> 0; } }
  for (let i = 0; i < buf.length; i++) crc = TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return crc;
}

export async function zipFromUrls(files, onProgress) {
  const enc = new TextEncoder(), parts = [], central = [];
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let offset = 0, done = 0;
  for (const f of files) {
    const name = enc.encode(f.path);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0808, true); // UTF-8 names, sizes after the data
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint16(26, name.length, true);
    parts.push(h.buffer, name);
    const res = await fetch(f.url);
    if (!res.ok || !res.body) throw new Error(`Couldn’t get ${f.path} (${res.status}).`);
    const reader = res.body.getReader();
    let crc = 0xffffffff, size = 0, chunks = [];
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      crc = crc32(value, crc); size += value.length; chunks.push(value);
      if (chunks.length >= 64) { parts.push(new Blob(chunks)); chunks = []; } // hand pieces to the browser as we go
      onProgress?.({ done, total: files.length, file: f.path });
    }
    if (chunks.length) parts.push(new Blob(chunks));
    crc = (crc ^ 0xffffffff) >>> 0;
    const dd = new DataView(new ArrayBuffer(16));
    dd.setUint32(0, 0x08074b50, true); dd.setUint32(4, crc, true); dd.setUint32(8, size, true); dd.setUint32(12, size, true);
    parts.push(dd.buffer);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0808, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(c.buffer, name);
    offset += 30 + name.length + size + 16;
    if (offset > 0xffffffff) throw new Error('This send is over 4 GB, too big for one zip in the browser. Use the Mac app.');
    done++; onProgress?.({ done, total: files.length, file: f.path });
  }
  const cdSize = central.reduce((n, x) => n + x.byteLength, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, e.buffer], { type: 'application/zip' });
}
