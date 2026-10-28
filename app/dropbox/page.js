'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/supabase';
import { useApp, TopBar } from '@/components/AppShell';

function DropboxSetup() {
  const { eng, session } = useApp();
  const q = useSearchParams();
  const [st, setSt] = useState(null);
  const [msg, setMsg] = useState(q.get('connected') ? 'Dropbox is connected. Now pick the folder client files should go into.' : q.get('error') || '');
  const [browse, setBrowse] = useState(null);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const [bErr, setBErr] = useState('');
  const [newName, setNewName] = useState('');

  const load = () => api('/api/dropbox', { action: 'status' }).then((r) => { setSt(r); setTyped(r.root || '/'); }).catch((e) => setMsg(e.message));
  useEffect(() => { if (eng) load(); }, [eng]);
  const open = async (path) => {
    setBusy(true); setBErr('');
    try { setBrowse(await api('/api/dropbox', { action: 'folders', path })); } catch (e) { setBErr(e.message); if (!browse) setBrowse({ path: path || '/', folders: [], failed: true }); }
    setBusy(false);
  };
  const connect = async () => { try { const r = await api('/api/dropbox', { action: 'connect' }); window.location.href = r.url; } catch (e) { setMsg(e.message); } };
  const choose = async (root, create = false) => {
    setBusy(true); setBErr('');
    try {
      const r = await api('/api/dropbox', { action: 'root', root, create });
      setSt((s) => ({ ...s, root: r.root })); setTyped(r.root || '/'); setBrowse(null);
      setMsg(`Saved. Client files will go into ${r.root || 'the top of your Dropbox'}/Artist name.`);
    } catch (e) { setBErr(e.message); }
    setBusy(false);
  };
  const mkdir = async () => {
    const name = newName.trim().replace(/\//g, '-'); if (!name) return;
    setBusy(true); setBErr('');
    try { const base = browse?.path && browse.path !== '/' ? browse.path : ''; await api('/api/dropbox', { action: 'mkdir', path: `${base}/${name}` }); setNewName(''); await open(`${base}/${name}`); } catch (e) { setBErr(e.message); }
    setBusy(false);
  };
  const disconnect = async () => { if (!confirm('Disconnect Dropbox? Portal uploads will stop until you connect again.')) return; await api('/api/dropbox', { action: 'disconnect' }); load(); };
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); setMsg('Copied.'); } catch {} };

  if (!session) return null;
  if (!eng) return <><TopBar crumbs={[{ label: 'Dropbox' }]} /><section className="page"><p className="muted">This page is for your engineer.</p></section></>;

  const crumbs = browse ? browse.path.split('/').filter(Boolean) : [];
  return (
    <>
      <TopBar crumbs={[{ label: 'Home', href: '/' }, { label: 'Portal', href: '/portal/inbox' }, { label: 'Dropbox' }]} />
      <section className="page">
        <div className="hhead"><h1 className="up">Dropbox</h1><p className="lede">Files clients send through the Portal land here, sorted into a folder for each artist. Clients never see Dropbox.</p></div>
        {msg && <p className="toast-inline" style={{ marginBottom: 16 }}>{msg}</p>}
        {!st ? <p className="muted">Checking…</p> : (
          <div className="dbx">
            {!st.hasKeys && (
              <div className="panel dbxsteps">
                <h3>One-time setup (about 2 minutes)</h3>
                <ol>
                  <li>Go to <a className="link" href="https://www.dropbox.com/developers/apps/create" target="_blank" rel="noopener noreferrer">dropbox.com/developers/apps</a> and click <b>Create app</b>. Choose <b>Scoped access</b>, then <b>Full Dropbox</b> (so you can pick any folder), and name it something like <b>CTRL ROOM Portal</b>.</li>
                  <li>Open the <b>Permissions</b> tab, tick <b>files.metadata.read</b>, <b>files.content.write</b>, <b>files.content.read</b> and <b>account_info.read</b>, then click <b>Submit</b>.</li>
                  <li>Open the <b>Settings</b> tab. Under <b>OAuth 2 › Redirect URIs</b>, paste this and click <b>Add</b>:
                    <div className="share-link"><code>{st.redirect}</code><button className="btn small" onClick={() => copy(st.redirect)}>Copy</button></div></li>
                  <li>On the same tab, copy the <b>App key</b> and <b>App secret</b>. In Vercel, open your project › <b>Settings › Environment Variables</b> and add them as <code>DROPBOX_APP_KEY</code> and <code>DROPBOX_APP_SECRET</code>.</li>
                  <li>In Vercel, go to <b>Deployments</b> › ••• on the top one › <b>Redeploy</b>. Then come back here and click <b>Connect Dropbox</b>.</li>
                </ol>
              </div>
            )}
            <div className="panel dbxcard">
              <div className="dbxrow">
                <span className={`dbxdot ${st.connected ? 'on' : ''}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{st.connected ? 'Connected' : 'Not connected'}</b>
                  <p className="muted small" style={{ margin: 0 }}>{st.connected ? (st.account ? `${st.account.name} · ${st.account.email}${st.account.team ? ` · ${st.account.team} (business)` : ' · personal'}` : 'Your Dropbox') : st.hasKeys ? 'Click Connect and approve in Dropbox.' : 'Finish the setup above first.'}</p>
                  {st.connected && !st.account?.team && <p className="muted small" style={{ margin: '4px 0 0' }}>Wrong account? Click <b>Reconnect</b>. Dropbox will ask you to sign in, so pick your business account there.</p>}
                </div>
                {st.connected
                  ? <><button className="btn small" onClick={connect}>Reconnect</button><button className="btn small quiet" onClick={disconnect}>Disconnect</button></>
                  : <button className="btn primary" disabled={!st.hasKeys} onClick={connect}>Connect Dropbox</button>}
              </div>
              {st.connected && st.problem === 'APP_FOLDER' && (
                <div className="dbxwarn">
                  <b>Your Dropbox app is set to “App folder”, so it can only see its own empty folder.</b>
                  <p>To use your business folders it needs <b>Full Dropbox</b> access. Dropbox doesn’t let you change that on an existing app, so make a new one:</p>
                  <ol>
                    <li>At <a className="link" href="https://www.dropbox.com/developers/apps/create" target="_blank" rel="noopener noreferrer">dropbox.com/developers/apps/create</a> choose <b>Scoped access › Full Dropbox</b>.</li>
                    <li>Permissions tab: tick files.metadata.read, files.content.read, files.content.write, account_info.read › <b>Submit</b>.</li>
                    <li>Settings tab: add the redirect URI <code>{st.redirect}</code>, and under Development users click <b>Enable additional users</b>.</li>
                    <li>In Vercel, replace <code>DROPBOX_APP_KEY</code> and <code>DROPBOX_APP_SECRET</code> with the new app’s, then Redeploy.</li>
                    <li>Come back here and click <b>Reconnect</b>.</li>
                  </ol>
                </div>
              )}
              {st.connected && st.problem && st.problem !== 'APP_FOLDER' && <p className="ferr" style={{ margin: 0 }}>{st.problem}</p>}
              {st.connected && (
                <div className="dbxfolder">
                  {st.account?.teamRoot && (
                    <label className="shrow" style={{ marginBottom: 8 }}>
                      <span><b>Use team folders</b><span className="muted small">{st.teamSpace ? `Showing ${st.account.team}’s shared team space.` : 'Showing only your own folder.'}</span></span>
                      <button className="switch" role="switch" aria-checked={st.teamSpace} disabled={busy} onClick={async () => { setBusy(true); try { const r = await api('/api/dropbox', { action: 'space', team: !st.teamSpace }); setSt((x) => ({ ...x, teamSpace: r.teamSpace })); setBrowse(null); open(''); } catch (e) { setBErr(e.message); } setBusy(false); }}><i /></button>
                    </label>
                  )}
                  <p className="muted small" style={{ margin: 0 }}>Client files go into</p>
                  <div className="dbxpath mono">{st.root || '/'}<span className="muted">/Artist name/</span></div>
                  <form className="dbxtype" onSubmit={(e) => { e.preventDefault(); choose(typed, true); }}>
                    <label htmlFor="dbx-p" className="muted small">Folder in your Dropbox</label>
                    <div className="aerow">
                      <input id="dbx-p" className="mono" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="/Clients" spellCheck={false} />
                      <button className="btn small primary" disabled={busy || (typed || '/') === (st.root || '/')}>{busy ? 'Saving…' : 'Save'}</button>
                      {!browse && <button type="button" className="btn small" disabled={busy} onClick={() => open(st.root || '')}>Browse…</button>}
                    </div>
                    <p className="muted small" style={{ margin: 0 }}>Type a path like <b>/Mixing/Clients</b>. If the folder doesn’t exist yet, it gets made for you.</p>
                  </form>
                </div>
              )}
              {browse && (
                <div className="dbxbrowse">
                  <div className="dbxcrumbs">
                    <button onClick={() => open('')}>Dropbox</button>
                    {crumbs.map((c, i) => <span key={i}> / <button onClick={() => open('/' + crumbs.slice(0, i + 1).join('/'))}>{c}</button></span>)}
                  </div>
                  {!browse.failed && <ul className="dbxlist">
                    {browse.folders.map((f) => <li key={f.path}><button onClick={() => open(f.path)} disabled={busy}><span aria-hidden="true">📁</span> {f.name}</button></li>)}
                    {!browse.folders.length && <li className="muted small">{browse.path === '/' ? (st.account?.teamRoot && !st.teamSpace ? 'Nothing here. Turn on “Use team folders” above to see your business folders.' : browse.files ? 'Only files here, no folders. Make one below.' : 'Dropbox shows nothing at the top level. If you expected your business folders, check that your Dropbox app has Full Dropbox access.') : 'No folders in here.'}</li>}
                  </ul>}
                  {!browse.failed && <div className="aerow">
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New folder name" aria-label="New folder name" />
                    <button className="btn small" disabled={busy || !newName.trim()} onClick={mkdir}>Make folder here</button>
                  </div>}
                  <div className="row-actions">
                    {!browse.failed && <button className="btn small primary" disabled={busy} onClick={() => choose(browse.path === '/' ? '' : browse.path)}>Use {browse.path === '/' ? 'the top of Dropbox' : `“${crumbs.at(-1)}”`}</button>}
                    <button className="btn small quiet" onClick={() => { setBrowse(null); setBErr(''); }}>Close</button>
                  </div>
                </div>
              )}
              {bErr && <p className="ferr" style={{ margin: 0 }}>{bErr}</p>}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export default function DropboxPage() {
  return <Suspense fallback={null}><DropboxSetup /></Suspense>;
}
