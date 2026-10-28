'use client';
// Bridge for the CTRL ROOM Mac app. The app hands the page files the user dropped on the Dock icon,
// opened with "Open With › CTRL ROOM", or picked with ⌘U. The page turns them into File objects
// and gives them to the Home upload box, exactly like a drag-and-drop.

export const isMacApp = () => typeof window !== 'undefined' && (!!window.ctrlRoomNative || /CTRLROOM-Mac/.test(navigator.userAgent));

const chunks = {};
function viaChunks(item) {
  return new Promise((resolve, reject) => {
    chunks[item.id] = { parts: [], got: 0, resolve, reject };
    window.webkit?.messageHandlers?.ctrlroom?.postMessage({ type: 'send', id: item.id });
    setTimeout(() => { if (chunks[item.id]) { delete chunks[item.id]; reject(new Error('timeout')); } }, 10 * 60 * 1000);
  });
}
if (typeof window !== 'undefined') {
  window.__ctrlChunk = (id, i, total, b64) => {
    const c = chunks[id]; if (!c) return;
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
    c.parts[i] = u; c.got++;
    if (c.got === total) { delete chunks[id]; c.resolve(new Blob(c.parts)); }
  };
  window.__ctrlChunkFail = (id) => { const c = chunks[id]; if (c) { delete chunks[id]; c.reject(new Error('read failed')); } };
}

async function toFile(item) {
  let blob;
  try {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error(String(r.status));
    blob = await r.blob();
  } catch {
    blob = await viaChunks(item);
  }
  return new File([blob], item.name, { type: item.type || blob.type || 'audio/wav', lastModified: Date.now() });
}

let pending = [];
export const takePending = () => { const p = pending; pending = []; return p; };

/** Installs window.ctrlRoomReceiveFiles. onArrive(files) is called once the files are ready. */
export function installNativeBridge(onArrive) {
  window.ctrlRoomReceiveFiles = async (list) => {
    window.dispatchEvent(new CustomEvent('ctrl-room:files-loading', { detail: { count: list.length } }));
    const files = [];
    for (const item of list) { try { files.push(await toFile(item)); } catch {} }
    if (!files.length) return;
    pending.push(...files);
    onArrive(files);
    window.dispatchEvent(new Event('ctrl-room:files'));
  };
  return () => { delete window.ctrlRoomReceiveFiles; };
}
