'use client';
// Reads everything out of a drag-and-drop, including the files inside dropped folders
// (browsers hand a dropped folder over as an empty item). Each file keeps its path, like "He Is Holy/Kick.wav".

function readAllEntries(dirReader) {
  return new Promise((resolve) => {
    const out = [];
    const next = () => dirReader.readEntries((batch) => { if (!batch.length) return resolve(out); out.push(...batch); next(); }, () => resolve(out));
    next();
  });
}

async function walk(entry, prefix, out) {
  if (entry.isFile) {
    const file = await new Promise((res) => entry.file(res, () => res(null)));
    if (file && !file.name.startsWith('.')) {
      const path = prefix ? `${prefix}/${file.name}` : '';
      if (path) { try { Object.defineProperty(file, 'webkitRelativePath', { value: path }); } catch {} }
      out.push(file);
    }
  } else if (entry.isDirectory) {
    const kids = await readAllEntries(entry.createReader());
    for (const k of kids) await walk(k, prefix ? `${prefix}/${entry.name}` : entry.name, out);
  }
}

/** Returns { files, folders }: loose files, and one { name, files } per top-level dropped folder. */
export async function filesFromDrop(dt) {
  const items = Array.from(dt?.items || []).filter((i) => i.kind === 'file');
  const entries = items.map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
  if (!entries.some(Boolean)) {
    return { files: Array.from(dt?.files || []).filter((f) => f.size > 0 && !f.name.startsWith('.')), folders: [] };
  }
  const files = [], folders = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e) { const f = items[i].getAsFile(); if (f && f.size > 0) files.push(f); continue; }
    if (e.isDirectory) { const out = []; await walk(e, '', out); if (out.length) folders.push({ name: e.name, files: out }); }
    else { const out = []; await walk(e, '', out); files.push(...out); }
  }
  return { files, folders };
}

export const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
